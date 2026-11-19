"use client";

import { createContext, memo, useContext, useMemo } from "react";
import { ItemView } from "@/components/portfolio/LayoutMain";
import type { ItemSlot, PageCtx } from "@/components/portfolio/page-ctx";
import { FLOW_ID } from "@/lib/exhbt/blocks";
import type { ItemAs, PageItem } from "@/lib/exhbt/layouts";
import { useDoc, useRenderCount, useSection } from "./store";
import { Toolbar } from "./Toolbar";

/*
 * One page item in the editor (decision 0026, "What re-renders"): LayoutMain calls `edit.item` with
 * plain values, and this frame reads the item's own section from the store and draws it with
 * ItemView, the function the read-only page uses. So typing in a finding renders this frame again and
 * nothing else on the page.
 *
 * The frame adds no box: it carries the classes the read-only page puts on the item's root for its
 * place (`rowClass`, with min-w-0), and the part inside is drawn without them. It is positioned, so
 * its toolbar sits over it and takes no room.
 */

/** The page's context for the parts a frame draws: Sub "h3" under the editor's "h2", the pictures' addresses, the layout, the adapter. */
export const PageCtxContext = createContext<PageCtx | null>(null);

/** What a part inside a frame can ask of it: the item's id and kind, how it is drawn, its index in doc.sections (-1 for a flowchart with no marker), and its place on the page. */
export type FrameInfo = { id: string; kind: ItemSlot["kind"]; as: ItemAs; index: number; place: number; count: number };
const FrameContext = createContext<FrameInfo | null>(null);

/** The frame a part is drawn in, for a plug that needs the item's `as` or its stored index (an image's description field, a link's address). */
export function useFrame(): FrameInfo | null {
  return useContext(FrameContext);
}

const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(" ");

export const Frame = memo(function Frame({ id, kind, as, rowClass, index: place, count }: ItemSlot) {
  useRenderCount(id);
  const ctx = useContext(PageCtxContext);
  const s = useSection(id);
  // A number, so the frame draws again when a section before it is removed and its fields' paths would go stale.
  const index = useDoc((d) => d.sections.findIndex((x) => x.id === id));
  const steps = useDoc((d) => (kind === "flow" ? d.flow : null));
  const info = useMemo<FrameInfo>(() => ({ id, kind, as, index, place, count }), [id, kind, as, index, place, count]);

  let item: PageItem | null = null;
  if (kind === "flow") item = { id: FLOW_ID, kind: "flow", index, steps: steps ?? [] };
  else if (s) item = { id, kind: s.kind, index, s };
  if (!ctx || !item) return null;

  return (
    <div
      data-section-id={id}
      data-kind={kind}
      data-as={as}
      // The flowchart's own list carries "flow"; every other frame is where a path with no field of its own lands.
      data-path={kind === "flow" ? undefined : `sections.${index}`}
      className={cx("xe-frame relative min-w-0", rowClass)}
    >
      <FrameContext value={info}>
        <Toolbar />
        <ItemView item={item} as={as} ctx={ctx} />
      </FrameContext>
    </div>
  );
});
