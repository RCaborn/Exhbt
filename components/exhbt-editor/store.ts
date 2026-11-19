"use client";

import { createContext, useContext, useEffect, useSyncExternalStore } from "react";
import type { ContentSection, ExhbtDoc } from "@/lib/exhbt/blocks";
import type { EditorStore, Store } from "./store-core";

/*
 * The editor's store (decision 0026, "What re-renders") and the hooks each part of the page reads its
 * own slice with. The store itself, with no React in it, is store-core.ts.
 */

export type { EditorStore } from "./store-core";

export const StoreContext = createContext<Store | null>(null);

/** The store with the parts only the editor's own files use (store-core.ts, StoreInternals). */
export function useStoreInternal(): Store {
  const s = useContext(StoreContext);
  if (!s) throw new Error("The editor's hooks need its StoreContext (components/exhbt-editor/EditorShell.tsx).");
  return s;
}

export function useStore(): EditorStore {
  return useStoreInternal();
}

/** One slice of the doc. `select` must return the same object while its slice has not changed. */
export function useDoc<T>(select: (d: ExhbtDoc) => T): T {
  const store = useStoreInternal();
  return useSyncExternalStore(
    store.subscribe,
    () => select(store.get()),
    () => select(store.get()),
  );
}

/** One section by id, fresh on every change to it and to nothing else. */
export function useSection(id: string): ContentSection | undefined {
  const store = useStoreInternal();
  return useSyncExternalStore(
    store.subscribe,
    () => store.section(id),
    () => store.section(id),
  );
}

/** The doc as the shell last changed (store-core.ts, `shell`): what the canvas draws ProjectView with. */
export function useShell(): ExhbtDoc {
  const store = useStoreInternal();
  return useSyncExternalStore(store.subscribe, store.shell, store.shell);
}

declare global {
  interface Window {
    /** How many times each unit of the editing page has rendered: "shell", "flow" and each section's id. For e2e/editor-smooth.spec.ts. */
    __exhbtRenders?: Record<string, number>;
  }
}

/** Counts a unit's renders on window.__exhbtRenders[unit], for e2e/editor-smooth.spec.ts. Units: "shell", "flow", and each section's id. */
export function useRenderCount(unit: string): void {
  // Counted after each commit, so React's second render of a component in development is not counted twice.
  useEffect(() => {
    const counts = (window.__exhbtRenders ??= {});
    counts[unit] = (counts[unit] ?? 0) + 1;
  });
}
