"use client";

import "../css/drag.css";
import { useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ItemView } from "@/components/portfolio/LayoutMain";
import type { PageCtx } from "@/components/portfolio/page-ctx";
import { formatOf } from "@/lib/exhbt/formats";
import { pageItems, type BlockKind } from "@/lib/exhbt/layouts";
import { useRuntime } from "../context";
import { useFilesController, useImageUrls } from "../files";
import { PageCtxContext } from "../Frame";
import { useStoreInternal } from "../store";
import { BlockIcon } from "./blocks";
import { engineFor, HOW, HOW_ID, type Engine, type Lift } from "./engine";

/*
 * The drag board (decision 0026, "Dragging"): the React side of the engine in engine.ts. It wraps
 * the canvas and the tray, and while something is carried it draws, inside the page's main column
 * (so the copy is drawn by the page's own rules and container queries): the lifted copy on a card
 * with the pack shadow and an outline in the look's link colour, never scaled, drawn with ItemView
 * and no adapter; the dashed box for the room made; the line. The canvas itself is never drawn
 * again during a drag: what DragBoard holds is beside it.
 */

export type Board = {
  /** Props for a section's grip button: the drag sensors, the keyboard handler, the ref. Spread onto the <button data-grip>. */
  grip(id: string): Record<string, unknown>;
  /** Move up (-1) or down (1) one place, with the motion and the words read out; keeps the focus on the button pressed. */
  moveBy(id: string, by: -1 | 1): void;
  /** Take a section off the page, with the motion, the words read out and the focus moved to what took its place. */
  remove(id: string): void;
  /** Add a block at a place, with the motion and the focus put in it. Returns its id, or null when there is no room. A graph then opens its figures sheet (`ui.open("chart", id)`); a link opens its "Web address" popover with the cursor in it (`ui.jumpTo` on its `href` path); an image opens the picture picker instead and is placed when the pictures are chosen; the flowchart, offered only when it is off the page, goes back at `at`. */
  add(kind: BlockKind, at: number): string | null;
  /** The section the focus was last in, for "add after the section you were last in". */
  lastFocus(): string | null;
};

/** The visit's drag engine (the same one inside and outside DragBoard: the phone's bar and the reorder sheet move through it too). */
export function useEngine(): Engine {
  const store = useStoreInternal();
  const { uiApi } = useRuntime();
  const files = useFilesController();
  return useMemo(() => engineFor(store, uiApi, files), [store, uiApi, files]);
}

export function useBoard(): Board {
  return useEngine().board;
}

/** Wraps the canvas (and the tray): the drag engine's overlays. */
export function DragBoard(props: { children: ReactNode }): ReactNode {
  const engine = useEngine();
  const [lift, setLift] = useState<Lift | null>(null);
  useEffect(() => engine.connect({ set: setLift }), [engine]);
  return (
    <>
      {props.children}
      <p id={HOW_ID} hidden>
        {HOW}
      </p>
      {lift && createPortal(<Overlay lift={lift} engine={engine} />, lift.main)}
    </>
  );
}

/** What is drawn while something is carried, over the page and clipped to it. */
function Overlay({ lift, engine }: { lift: Lift; engine: Engine }) {
  const store = useStoreInternal();
  const page = useContext(PageCtxContext);
  const imageUrls = useImageUrls();
  const root = useRef<HTMLDivElement>(null);
  const space = useRef<HTMLDivElement>(null);
  const copy = useRef<HTMLDivElement>(null);
  const line = useRef<HTMLDivElement>(null);
  const landing = useRef<HTMLDivElement>(null);
  const doc = store.get();
  // The copy is the page's own drawing with no adapter: nothing in it can be typed in or focused.
  const ctx = useMemo<PageCtx>(() => ({ Sub: page?.Sub ?? "h3", imageUrls, format: formatOf(doc) }), [page, imageUrls, doc]);
  const item = lift.draft ? null : (pageItems(doc).find((it) => it.id === lift.id) ?? null);

  useLayoutEffect(() => {
    if (!root.current || !space.current || !line.current || !landing.current) return;
    engine.attach({ root: root.current, space: space.current, copy: copy.current, line: line.current, landing: landing.current });
  }, [engine, lift]);

  const { box } = lift;
  return (
    <div ref={root} aria-hidden inert data-xe-overlay className="xe-drag-overlay">
      <div ref={space} className="xe-drag-space">
        <div ref={landing} hidden data-xe-landing className="xe-landing" />
        {lift.mode === "pointer" &&
          (lift.draft ? (
            <div ref={copy} data-xe-copy data-xe-chip className="xe-lift" style={{ left: box.x, top: box.y, width: box.w, height: box.h }}>
              <span className="xe-tray-block xe-tray-lifted">
                <BlockIcon kind={lift.draft.kind} />
                <span>{lift.draft.name}</span>
              </span>
            </div>
          ) : (
            item && (
              <div ref={copy} data-xe-copy className="xe-lift" style={{ left: box.x, top: box.y, width: box.w, height: box.h }}>
                <div className="xe-card" />
                <div className="xe-lift-body">
                  <ItemView item={item} as={lift.as} ctx={ctx} />
                </div>
              </div>
            )
          ))}
        <div ref={line} hidden data-xe-line className="xe-line" />
      </div>
    </div>
  );
}
