"use client";

import { useMemo } from "react";
import type { FlowEdit } from "@/components/portfolio/page-ctx";
import { useStoreInternal } from "../store";
import { AddBox, BoxTools, FlowBox } from "./FlowBox";
import { FlowList } from "./FlowList";

/*
 * The flowchart's own slots (decision 0026): its list, each box, a box's tools and the "+" in each
 * arrow, so MethodFlow keeps its markup and classes. This hook holds no state and reads nothing that
 * changes: it runs inside the canvas (the shell), and everything that does change lives in the
 * components it returns (FlowList.tsx, FlowBox.tsx). Each box is keyed by the key that lasts for the
 * visit (store.flowKeys()), so typing never remounts a box and a moved box keeps its fields.
 */
export function useFlowEdit(): FlowEdit {
  const store = useStoreInternal();
  return useMemo<FlowEdit>(
    () => ({
      list: (o) => <FlowList>{o.children}</FlowList>,
      box: (o) => {
        const key = store.flowKeys()[o.index] ?? `box-at-${o.index}`;
        return (
          <FlowBox key={key} boxKey={key} className={o.className}>
            {o.children}
          </FlowBox>
        );
      },
      tools: (o) => <BoxTools index={o.index} count={o.count} />,
      add: (o) => <AddBox after={o.after} count={o.count} />,
    }),
    [store],
  );
}
