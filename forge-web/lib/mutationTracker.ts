/**
 * Tracks recently-mutated entity IDs with a 5-second TTL.
 * Used to suppress WS echo events from our own mutations.
 */

const DEDUP_TTL_MS = 5_000;

const recentMutations = new Map<string, number>();

/** Mark an entity as recently mutated (suppress WS echo for 5s). */
export function trackMutation(entityId: string): void {
  recentMutations.set(entityId, Date.now());
}

/** Check if an entity was recently mutated by us (within 5s). */
export function isRecentMutation(entityId: string): boolean {
  const ts = recentMutations.get(entityId);
  if (!ts) return false;
  if (Date.now() - ts > DEDUP_TTL_MS) {
    recentMutations.delete(entityId);
    return false;
  }
  return true;
}

/** Cleanup expired entries (call periodically if needed). */
export function cleanupMutations(): void {
  const now = Date.now();
  recentMutations.forEach((ts, key) => {
    if (now - ts > DEDUP_TTL_MS) {
      recentMutations.delete(key);
    }
  });
}
