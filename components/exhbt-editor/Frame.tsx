"use client";

import { createContext, memo, useContext, useMemo } from "react";
import { ItemView } from "@/components/portfolio/LayoutMain";
import type { FieldPath, ItemSlot, PageCtx } from "@/components/portfolio/page-ctx";
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
 *
 * Two layers, so a move draws as little as it can. The frame itself follows the item's place on the
 * page and its index in doc.sections, and draws only its own box and toolbar. The part inside
 * (FrameBody) is memoised on the section alone: it draws again when the section's words change, never
 * because the section moved. Its fields' paths are built with FRAME_AT in place of the stored index,
 * and each field puts the frame's current index in (useFieldPath), so `data-path` stays exact while
 * only the fields themselves draw again.
 */

/** The page's context for the parts a frame draws: Sub "h3" under the editor's "h2", the pictures' addresses, the layout, the adapter. */
export const PageCtxContext = createContext<PageCtx | null>(null);

/** What a part inside a frame can ask of it: the item's id and kind, how it is drawn, its index in doc.sections (-1 for a flowchart with no marker), and its place on the page. */
export type FrameInfo = { id: string; kind: ItemSlot["kind"]; as: ItemAs; index: number; place: number; count: number };
const FrameContext = createContext<FrameInfo | null>(null);
/** The frame's index in doc.sections alone, so a field draws again when it changes and for nothing else in FrameInfo. */
const FrameIndexContext = createContext<number | null>(null);

/** The frame a part is drawn in, for a plug that needs the item's `as` or its stored index (an image's description field, a link's address). */
export function useFrame(): FrameInfo | null {
  return useContext(FrameContext);
}

/** What a frame's part is drawn with in place of its stored index: every field path in it starts `sections.-1`. */
export const FRAME_AT = -1;
const PREFIX = `sections.${FRAME_AT}`;

/** A field's path as it is now: inside a frame, the frame's stored index in place of FRAME_AT; anywhere else, the path as given. */
export function useFieldPath(path: FieldPath): FieldPath {
  const index = useContext(FrameIndexContext);
  if (index === null || (path !== PREFIX && !path.startsWith(`${PREFIX}.`))) return path;
  return `sections.${index}${path.slice(PREFIX.length)}`;
}

const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(" ");

export const Frame = memo(function Frame({ id, kind, as, rowClass, index: place, count }: ItemSlot) {
  // A number, so the fields' paths follow when a section before this one is moved or removed.
  const index = useDoc((d) => d.sections.findIndex((x) => x.id === id));
  const info = useMemo<FrameInfo>(() => ({ id, kind, as, index, place, count }), [id, kind, as, index, place, count]);
  // A section just taken out, in the moment before the page stops drawing its frame.
  if (index < 0 && kind !== "flow") return null;
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
        <FrameIndexContext value={index}>
          <Toolbar />
          <FrameBody id={id} kind={kind} as={as} />
        </FrameIndexContext>
      </FrameContext>
    </div>
  );
});

/** The part itself: drawn again when its section (or, for the flowchart, its boxes) changes, or how it is drawn does; never for a move alone. */
const FrameBody = memo(function FrameBody({ id, kind, as }: { id: string; kind: ItemSlot["kind"]; as: ItemAs }) {
  useRenderCount(id);
  const ctx = useContext(PageCtxContext);
  const s = useSection(id);
  const steps = useDoc((d) => (kind === "flow" ? d.flow : null));
  const item = useMemo<PageItem | null>(() => (kind === "flow" ? { id: FLOW_ID, kind: "flow", index: FRAME_AT, steps: steps ?? [] } : s ? { id, kind: s.kind, index: FRAME_AT, s } : null), [id, kind, s, steps]);
  if (!ctx || !item) return null;
  return <ItemView item={item} as={as} ctx={ctx} />;
});
