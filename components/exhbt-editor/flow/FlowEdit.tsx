"use client";

import { useMemo } from "react";
import type { FlowEdit } from "@/components/portfolio/page-ctx";
import { useStoreInternal } from "../store";

/*
 * The flowchart's own slots (decision 0026): its list, each box, a box's tools and the "+" between
 * boxes. K's: this is G's stub. The list is its children; each box is the <li> MethodFlow describes,
 * with a key that lasts for the visit (store.flowKeys()), so a box keeps its node when others move.
 */
export function useFlowEdit(): FlowEdit {
  const store = useStoreInternal();
  return useMemo<FlowEdit>(
    () => ({
      list: (o) => o.children,
      box: (o) => (
        <li key={store.flowKeys()[o.index] ?? `box-at-${o.index}`} className={o.className}>
          {o.children}
        </li>
      ),
      tools: () => null,
      add: () => null,
    }),
    [store],
  );
}
