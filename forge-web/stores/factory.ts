import { create } from "zustand";
import type { ForgeEvent } from "@/lib/ws";

// --- Types ---

export interface EntitySliceState<T> {
  items: T[];
  count: number;
  loading: boolean;
  saving: boolean;
  error: string | null;
}

interface WsEventMapping {
  op: "create" | "update" | "remove" | "replace";
  idKey?: string;
}

export interface EntityStoreConfig<T> {
  listFn: (
    slug: string,
    params?: Record<string, string>,
  ) => Promise<{ count: number; [key: string]: unknown }>;
  responseKey: string;
  getItemId: (item: T) => string;
  wsEvents: Record<string, WsEventMapping>;
}

export interface EntityBaseActions<T> {
  fetchAll: (slug: string, params?: Record<string, string>) => Promise<void>;
  handleWsEvent: (event: ForgeEvent) => void;
  clear: () => void;
}

export type EntityStoreType<T> = EntitySliceState<T> & EntityBaseActions<T>;

// --- Factory ---

export function createEntityStore<T>(config: EntityStoreConfig<T>) {
  let _fetchSeq = 0;

  return create<EntityStoreType<T>>((set, get) => ({
    items: [],
    count: 0,
    loading: false,
    saving: false,
    error: null,

    fetchAll: async (slug, params) => {
      const seq = ++_fetchSeq;
      set({ loading: true, error: null });
      try {
        const res = await config.listFn(slug, params);
        if (_fetchSeq !== seq) return;
        const items = (res as Record<string, unknown>)[
          config.responseKey
        ] as T[];
        set({ items, count: res.count, loading: false });
      } catch (e) {
        if (_fetchSeq !== seq) return;
        set({ error: (e as Error).message, loading: false });
      }
    },

    handleWsEvent: (event: ForgeEvent) => {
      const mapping = config.wsEvents[event.event];
      if (!mapping) return;
      const { op, idKey } = mapping;
      const payload = event.payload as Record<string, unknown>;
      const payloadId =
        ((idKey ? payload[idKey] : payload.id) as string) ?? undefined;

      const state = get();
      switch (op) {
        case "update": {
          if (!payloadId) return;
          const mergeData = { ...payload };
          if ("new_status" in mergeData) {
            mergeData.status = mergeData.new_status;
            delete mergeData.new_status;
            delete mergeData.old_status;
          }
          set({
            items: state.items.map((item) =>
              config.getItemId(item) === payloadId
                ? ({ ...item, ...mergeData } as T)
                : item,
            ),
          });
          break;
        }
        case "remove": {
          if (!payloadId) return;
          const filtered = state.items.filter(
            (item) => config.getItemId(item) !== payloadId,
          );
          set({ items: filtered, count: filtered.length });
          break;
        }
        case "replace": {
          const arr = Object.values(payload).find(Array.isArray) as
            | T[]
            | undefined;
          if (arr) set({ items: arr, count: arr.length });
          break;
        }
        case "create":
        default: {
          if (!payloadId) return;
          if (
            state.items.some(
              (item) => config.getItemId(item) === payloadId,
            )
          )
            return;
          const items = [...state.items, payload as unknown as T];
          set({ items, count: items.length });
          break;
        }
      }
    },

    clear: () => set({ items: [], count: 0, loading: false, saving: false, error: null }),
  }));
}

// --- CRUD Helpers ---

import { mutate as swrMutate } from "swr";
import { trackMutation } from "@/lib/mutationTracker";

type StoreApi<T> = {
  getState: () => EntitySliceState<T>;
  setState: (partial: Partial<EntitySliceState<T>>) => void;
};

/** Options for triggering SWR revalidation after mutation. */
export interface SWRRevalidateOpts {
  slug: string;
  entityPath: string;
}

/**
 * Create with saving spinner (no optimistic add — server is truth per D-007).
 * Sets `saving: true` while the API call is in flight.
 * After success, triggers SWR revalidation to fetch the created entity.
 */
export async function withCreateLoading<T>(
  store: StoreApi<T>,
  fn: () => Promise<{ added: string[]; total: number }>,
  swr?: SWRRevalidateOpts,
): Promise<string[]> {
  store.setState({ saving: true, error: null });
  try {
    const res = await fn();
    // Track created IDs to suppress WS echo
    for (const id of res.added) {
      trackMutation(id);
    }
    store.setState({ saving: false });
    // Revalidate SWR cache so migrated pages show the new entity
    if (swr) {
      revalidateSWR(swr);
    }
    return res.added;
  } catch (e) {
    store.setState({ error: (e as Error).message, saving: false });
    throw e;
  }
}

/**
 * Optimistic update with rollback on error.
 * Immediately applies the update to the UI, then confirms via API.
 * If API fails, rolls back to previous state.
 * After success, triggers SWR revalidation for migrated pages.
 */
export async function withUpdate<T>(
  store: StoreApi<T>,
  getItemId: (item: T) => string,
  id: string,
  fn: () => Promise<T>,
  optimisticData?: Partial<T>,
  swr?: SWRRevalidateOpts,
): Promise<void> {
  const prevState = store.getState();
  const prevItem = prevState.items.find((item) => getItemId(item) === id);

  // Optimistic update: apply changes immediately
  if (optimisticData && prevItem) {
    store.setState({
      items: prevState.items.map((item) =>
        getItemId(item) === id ? { ...item, ...optimisticData } : item,
      ),
    } as Partial<EntitySliceState<T>>);
  }

  try {
    const updated = await fn();
    trackMutation(id);
    // Apply server response (authoritative)
    const state = store.getState();
    store.setState({
      items: state.items.map((item) =>
        getItemId(item) === id ? updated : item,
      ),
    } as Partial<EntitySliceState<T>>);
    // Revalidate SWR cache for migrated pages
    if (swr) {
      revalidateSWR(swr);
    }
  } catch (e) {
    // Rollback on error
    if (prevItem) {
      const state = store.getState();
      store.setState({
        items: state.items.map((item) =>
          getItemId(item) === id ? prevItem : item,
        ),
        error: (e as Error).message,
      } as Partial<EntitySliceState<T>>);
    } else {
      store.setState({ error: (e as Error).message });
    }
  }
}

/** Trigger SWR revalidation for an entity list. */
function revalidateSWR(opts: SWRRevalidateOpts): void {
  const pattern = `/projects/${opts.slug}/${opts.entityPath}`;
  swrMutate(
    (key) => typeof key === "string" && key.startsWith(pattern),
    undefined,
    { revalidate: true },
  );
}
