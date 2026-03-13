import { describe, it, expect, vi } from "vitest";
import { renderHook, act, render, cleanup } from "@testing-library/react";
import React, { useRef, useImperativeHandle, forwardRef } from "react";
import { AIPageProvider, useAIPageContext, useAIPageContextSafe } from "../AIPageProvider";
import { useAIPage } from "../useAIPage";
import { useAIElement } from "../useAIElement";
import type { AIElementDescriptor, AIPageConfig, AIContextSnapshot } from "../types";

// Wrapper with provider
function wrapper({ children }: { children: React.ReactNode }) {
  return <AIPageProvider>{children}</AIPageProvider>;
}

// Shared wrapper that keeps context accessible after child unmount
function createSharedWrapper() {
  let ctxHandle: ReturnType<typeof useAIPageContext> | null = null;

  const ContextCapture = () => {
    ctxHandle = useAIPageContext();
    return null;
  };

  const SharedWrapper = ({ children }: { children: React.ReactNode }) => (
    <AIPageProvider>
      <ContextCapture />
      {children}
    </AIPageProvider>
  );

  return {
    wrapper: SharedWrapper,
    getCtx: () => ctxHandle!,
  };
}

describe("AIPageProvider", () => {
  it("provides context to children", () => {
    const { result } = renderHook(() => useAIPageContext(), { wrapper });
    expect(result.current).toBeDefined();
    expect(result.current.register).toBeInstanceOf(Function);
    expect(result.current.unregister).toBeInstanceOf(Function);
    expect(result.current.setPageConfig).toBeInstanceOf(Function);
    expect(result.current.getSnapshot).toBeInstanceOf(Function);
  });

  it("throws without provider", () => {
    expect(() => {
      renderHook(() => useAIPageContext());
    }).toThrow("useAIPageContext must be used within AIPageProvider");
  });

  it("returns empty snapshot initially", () => {
    const { result } = renderHook(() => useAIPageContext(), { wrapper });
    const snapshot = result.current.getSnapshot();
    expect(snapshot.pageConfig).toBeNull();
    expect(snapshot.elements.size).toBe(0);
  });

  it("register adds element, unregister removes", () => {
    const { result } = renderHook(() => useAIPageContext(), { wrapper });

    act(() => {
      result.current.register({ id: "test-el", type: "button", label: "Test" });
    });

    let snapshot = result.current.getSnapshot();
    expect(snapshot.elements.size).toBe(1);
    expect(snapshot.elements.get("test-el")?.label).toBe("Test");

    act(() => {
      result.current.unregister("test-el");
    });

    snapshot = result.current.getSnapshot();
    expect(snapshot.elements.size).toBe(0);
  });

  it("register overwrites existing element with same ID", () => {
    const { result } = renderHook(() => useAIPageContext(), { wrapper });

    act(() => {
      result.current.register({ id: "el-1", type: "button", label: "V1" });
      result.current.register({ id: "el-1", type: "button", label: "V2" });
    });

    const snapshot = result.current.getSnapshot();
    expect(snapshot.elements.size).toBe(1);
    expect(snapshot.elements.get("el-1")?.label).toBe("V2");
  });

  it("setPageConfig updates page metadata", () => {
    const { result } = renderHook(() => useAIPageContext(), { wrapper });
    const config: AIPageConfig = { id: "tasks", title: "Tasks" };

    act(() => {
      result.current.setPageConfig(config);
    });
    expect(result.current.getSnapshot().pageConfig).toEqual(config);

    act(() => {
      result.current.setPageConfig(null);
    });
    expect(result.current.getSnapshot().pageConfig).toBeNull();
  });

  it("getSnapshot returns a copy (mutations don't affect internal state)", () => {
    const { result } = renderHook(() => useAIPageContext(), { wrapper });

    act(() => {
      result.current.register({ id: "el-1", type: "filter", label: "Filter" });
    });

    const snap1 = result.current.getSnapshot();
    snap1.elements.delete("el-1"); // mutate the copy

    const snap2 = result.current.getSnapshot();
    expect(snap2.elements.size).toBe(1); // original unaffected
  });
});

describe("useAIPageContextSafe", () => {
  it("returns null outside provider", () => {
    const { result } = renderHook(() => useAIPageContextSafe());
    expect(result.current).toBeNull();
  });

  it("returns context inside provider", () => {
    const { result } = renderHook(() => useAIPageContextSafe(), { wrapper });
    expect(result.current).not.toBeNull();
    expect(result.current!.getSnapshot).toBeInstanceOf(Function);
  });
});

describe("useAIPage", () => {
  it("sets page config on mount", () => {
    const config: AIPageConfig = {
      id: "tasks",
      title: "Tasks",
      description: "Task management",
    };

    const { result } = renderHook(
      () => {
        useAIPage(config);
        return useAIPageContext();
      },
      { wrapper },
    );

    expect(result.current.getSnapshot().pageConfig).toEqual(config);
  });

  it("clears page config on unmount", () => {
    const { wrapper: shared, getCtx } = createSharedWrapper();

    const { unmount } = renderHook(
      () => useAIPage({ id: "tasks", title: "Tasks" }),
      { wrapper: shared },
    );

    expect(getCtx().getSnapshot().pageConfig?.id).toBe("tasks");

    unmount();

    expect(getCtx().getSnapshot().pageConfig).toBeNull();
  });

  it("updates page config when fields change", () => {
    const { result, rerender } = renderHook(
      ({ title }) => {
        useAIPage({ id: "tasks", title });
        return useAIPageContext();
      },
      { wrapper, initialProps: { title: "Tasks (5)" } },
    );

    expect(result.current.getSnapshot().pageConfig?.title).toBe("Tasks (5)");

    rerender({ title: "Tasks (10)" });

    expect(result.current.getSnapshot().pageConfig?.title).toBe("Tasks (10)");
  });
});

describe("useAIElement", () => {
  it("registers element on mount", () => {
    const { result } = renderHook(
      () => {
        useAIElement({
          id: "test-filter",
          type: "filter",
          label: "Status",
          value: "TODO",
        });
        return useAIPageContext();
      },
      { wrapper },
    );

    const snapshot = result.current.getSnapshot();
    expect(snapshot.elements.size).toBe(1);
    expect(snapshot.elements.get("test-filter")?.value).toBe("TODO");
  });

  it("unregisters element on unmount", () => {
    const { wrapper: shared, getCtx } = createSharedWrapper();

    const { unmount } = renderHook(
      () => useAIElement({ id: "unmount-test", type: "button", label: "X" }),
      { wrapper: shared },
    );

    expect(getCtx().getSnapshot().elements.has("unmount-test")).toBe(true);

    unmount();

    expect(getCtx().getSnapshot().elements.has("unmount-test")).toBe(false);
  });

  it("updates descriptor on re-render", () => {
    const { result, rerender } = renderHook(
      ({ value }) => {
        useAIElement({
          id: "dynamic-filter",
          type: "filter",
          label: "Status",
          value,
        });
        return useAIPageContext();
      },
      { wrapper, initialProps: { value: "TODO" as string } },
    );

    expect(result.current.getSnapshot().elements.get("dynamic-filter")?.value).toBe("TODO");

    rerender({ value: "DONE" });

    expect(result.current.getSnapshot().elements.get("dynamic-filter")?.value).toBe("DONE");
  });

  it("cleans up old ID when ID changes", () => {
    const { wrapper: shared, getCtx } = createSharedWrapper();

    const { rerender } = renderHook(
      ({ id }) => {
        useAIElement({ id, type: "button", label: "Dynamic" });
      },
      { wrapper: shared, initialProps: { id: "btn-A" } },
    );

    expect(getCtx().getSnapshot().elements.has("btn-A")).toBe(true);

    rerender({ id: "btn-B" });

    const snap = getCtx().getSnapshot();
    expect(snap.elements.has("btn-A")).toBe(false); // old cleaned up
    expect(snap.elements.has("btn-B")).toBe(true); // new registered
  });

  it("handles multiple elements", () => {
    const { result } = renderHook(
      () => {
        useAIElement({ id: "el-1", type: "filter", label: "Filter 1" });
        useAIElement({ id: "el-2", type: "button", label: "Button 1" });
        useAIElement({ id: "el-3", type: "list", label: "List 1" });
        return useAIPageContext();
      },
      { wrapper },
    );

    const snapshot = result.current.getSnapshot();
    expect(snapshot.elements.size).toBe(3);
    expect(snapshot.elements.has("el-1")).toBe(true);
    expect(snapshot.elements.has("el-2")).toBe(true);
    expect(snapshot.elements.has("el-3")).toBe(true);
  });

  it("does not throw outside provider (safe behavior)", () => {
    expect(() => {
      renderHook(() =>
        useAIElement({ id: "orphan", type: "button", label: "Orphan" }),
      );
    }).not.toThrow();
  });

  it("registers actions with endpoints", () => {
    const { result } = renderHook(
      () => {
        useAIElement({
          id: "task-list",
          type: "list",
          label: "Tasks",
          actions: [
            { label: "Start", endpoint: "/projects/{slug}/tasks/{id}", method: "PATCH" },
            { label: "Create", endpoint: "/projects/{slug}/tasks", method: "POST" },
          ],
        });
        return useAIPageContext();
      },
      { wrapper },
    );

    const el = result.current.getSnapshot().elements.get("task-list");
    expect(el?.actions).toHaveLength(2);
    expect(el?.actions?.[0].endpoint).toBe("/projects/{slug}/tasks/{id}");
  });
});
