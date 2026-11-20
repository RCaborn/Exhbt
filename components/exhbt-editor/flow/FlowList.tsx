"use client";

import "../css/flow.css";
import { useCallback, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal, flushSync } from "react-dom";
import {
  defaultDropAnimationSideEffects,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type Announcements,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type DropAnimation,
  type KeyboardCoordinateGetter,
} from "@dnd-kit/core";
import { horizontalListSortingStrategy, SortableContext, verticalListSortingStrategy, type SortingStrategy } from "@dnd-kit/sortable";
import { useReducedMotion } from "@/components/ui/useReducedMotion";
import { useRuntime } from "../context";
import { FLOW_BOX_STYLE } from "../drag/options";
import { IssueNote, useFieldIssue } from "../fields/issues";
import { useStoreInternal } from "../store";
import { EASE, MIN_ID, MIN_WORDS, MOVE_MS } from "./FlowBox";
import { lineAt, placeAt, within, type Span } from "./geometry";

/*
 * The flowchart's list on the editing page (decision 0026, "Dragging"): what MethodFlow's <ol> sits in.
 * It holds the drag for the boxes inside the flowchart (dragging the flowchart itself, as a section, is
 * the drag board's), the anchor "Things to fix" jumps to for the count issue (data-path="flow"), and
 * that issue's outline and message, which take no room.
 *
 * A box is carried in one of two ways, by FLOW_BOX_STYLE (drag/options.ts):
 *  - "line": the flowchart stays still; a copy the size of the box follows the pointer; a line in the
 *    gap shows where it will go; on the drop the boxes move to their places, 180ms, transforms only.
 *  - "slide": dnd-kit's sortable list; the other boxes slide aside.
 * The flowchart is a row or a column by its container's width (MethodFlow), so the axis is read from
 * the list itself and the boxes sort along it. The place comes from the pointer and the boxes as they
 * were at pick-up, and another place must be nearer by 10px before it takes over, so it cannot flicker.
 * Mouse after 6px, touch after a 150ms press, the keyboard from the grip; every step is said in the
 * editor's one live region. Under reduced motion nothing animates.
 */

type Axis = "row" | "column";

/** What the drag knows from pick-up to drop. Measured once, in the page's own coordinates (scrolling doesn't move it). */
type Plan = {
  key: string;
  from: number;
  /** The place shown now, or null when the pointer has left the flowchart. */
  target: number | null;
  keys: string[];
  axis: Axis;
  mode: "pointer" | "keys";
  /** Each box along the axis, and the flowchart across it. */
  spans: Span[];
  across: Span;
  /** Whether the pointer has left the box's own place yet (nothing is said until it has). */
  left: boolean;
};

/** What is drawn while a box is carried. */
type View = {
  mode: Plan["mode"];
  /** The line, in the layer's coordinates, when it shows. */
  line: { x: number; y: number; w: number; h: number } | null;
  copy: { w: number; h: number; box: { x: number; y: number; w: number; h: number }; step: string; detail: string; last: boolean };
};

const HOW = "To move this box, press Space or Enter, then use the arrow keys. Press Space or Enter again to drop it, or Escape to cancel.";
const SILENT: Announcements = { onDragStart: () => undefined, onDragOver: () => undefined, onDragEnd: () => undefined, onDragCancel: () => undefined };
const NEXT = new Set(["ArrowRight", "ArrowDown"]);
const BACK = new Set(["ArrowLeft", "ArrowUp"]);
/** Line style: no box moves while one is carried. */
const still: SortingStrategy = () => null;
const DROP: DropAnimation = { duration: MOVE_MS, easing: EASE, sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: "0" } } }) };
const LINE = 4;

const reducedNow = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const axisOf = (ol: Element | null): Axis => (ol && getComputedStyle(ol).flexDirection.startsWith("row") ? "row" : "column");

export function FlowList({ children }: { children: ReactNode }) {
  const store = useStoreInternal();
  const { uiApi } = useRuntime();
  const issue = useFieldIssue("flow");
  const style = FLOW_BOX_STYLE;
  const reduced = useReducedMotion();
  const dndId = useId();
  const wrap = useRef<HTMLDivElement>(null);
  const layer = useRef<HTMLDivElement>(null);
  const plan = useRef<Plan | null>(null);
  const [axis, setAxis] = useState<Axis>("column");
  const [look, setLook] = useState<Element | null>(null);
  const [view, setView] = useState<View | null>(null);
  const keys = store.flowKeys();

  // The list is a row or a column by its container's width (and how many boxes it has): read it from the list.
  useLayoutEffect(() => {
    const el = wrap.current;
    const ol = el?.querySelector(":scope > ol") ?? null;
    if (!el || !ol) return;
    setLook(el.closest("[data-look]"));
    const read = () => setAxis(axisOf(ol));
    read();
    const watch = new ResizeObserver(read);
    watch.observe(ol);
    return () => watch.disconnect();
  }, []);

  // One place at a time along the flowchart, whichever way it runs: right and down go on, left and up go back.
  const byKey = useCallback<KeyboardCoordinateGetter>((event, { context, currentCoordinates }) => {
    const by = NEXT.has(event.code) ? 1 : BACK.has(event.code) ? -1 : 0;
    const p = plan.current;
    if (!by || !p) return undefined;
    event.preventDefault();
    const cur = p.target ?? p.from;
    const to = Math.max(0, Math.min(p.keys.length - 1, cur + by));
    if (to === cur) return undefined;
    p.target = to;
    const rect = context.droppableRects.get(p.keys[to]!);
    const at = context.collisionRect;
    if (!rect || !at) return { ...currentCoordinates };
    return { x: currentCoordinates.x + rect.left + rect.width / 2 - (at.left + at.width / 2), y: currentCoordinates.y + rect.top + rect.height / 2 - (at.top + at.height / 2) };
  }, []);
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: byKey, scrollBehavior: reduced ? "auto" : "smooth" }),
  );

  // The place: from the keys as they were moved, or from the pointer against the boxes as they were at pick-up.
  const detect = useCallback<CollisionDetection>(({ pointerCoordinates, collisionRect }) => {
    const p = plan.current;
    if (!p) return [];
    if (p.mode === "pointer") {
      const pt = pointerCoordinates ?? { x: collisionRect.left + collisionRect.width / 2, y: collisionRect.top + collisionRect.height / 2 };
      const x = pt.x + window.scrollX;
      const y = pt.y + window.scrollY;
      const [along, across] = p.axis === "row" ? [x, y] : [y, x];
      p.target = within(across, p.across.start, p.across.end) ? placeAt(p.spans, along, p.target) : null;
    }
    return p.target === null ? [] : [{ id: p.keys[p.target]! }];
  }, []);

  /** The line for a place, in the layer's coordinates. */
  const lineFor = (p: Plan, to: number | null, origin: { x: number; y: number }): View["line"] => {
    const at = to === null ? null : lineAt(p.spans, p.from, to);
    if (at === null) return null;
    return p.axis === "row"
      ? { x: at - LINE / 2 - origin.x, y: p.across.start - origin.y, w: LINE, h: p.across.end - p.across.start }
      : { x: p.across.start - origin.x, y: at - LINE / 2 - origin.y, w: p.across.end - p.across.start, h: LINE };
  };
  const origin = useRef({ x: 0, y: 0 });

  const boxesNow = (list: readonly string[]) =>
    list.map((k) => wrap.current?.querySelector<HTMLElement>(`[data-flow-step="${CSS.escape(k)}"]`) ?? null);

  function onDragStart({ active, activatorEvent }: DragStartEvent) {
    const list = [...store.flowKeys()];
    const key = String(active.id);
    const from = list.indexOf(key);
    const lis = boxesNow(list);
    const ol = wrap.current?.querySelector(":scope > ol") ?? null;
    if (from < 0 || lis.some((li) => !li) || !ol) return;
    const ax = axisOf(ol);
    const sx = window.scrollX;
    const sy = window.scrollY;
    const rects = lis.map((li) => (li!.querySelector(":scope > .xp-flow-box") ?? li!).getBoundingClientRect());
    const olRect = ol.getBoundingClientRect();
    const spans = rects.map((r) => (ax === "row" ? { start: r.left + sx, end: r.right + sx } : { start: r.top + sy, end: r.bottom + sy }));
    const across = ax === "row" ? { start: olRect.top + sy, end: olRect.bottom + sy } : { start: olRect.left + sx, end: olRect.right + sx };
    const mode = typeof KeyboardEvent !== "undefined" && activatorEvent instanceof KeyboardEvent ? "keys" : "pointer";
    plan.current = { key, from, target: from, keys: list, axis: ax, mode, spans, across, left: false };
    const l = layer.current?.getBoundingClientRect();
    origin.current = { x: (l?.left ?? 0) + sx, y: (l?.top ?? 0) + sy };
    const li = lis[from]!.getBoundingClientRect();
    const box = rects[from]!;
    const step = store.get().flow[from];
    setView({
      mode,
      line: null,
      copy: { w: li.width, h: li.height, box: { x: box.left - li.left, y: box.top - li.top, w: box.width, h: box.height }, step: step?.step ?? "", detail: step?.detail ?? "", last: from === list.length - 1 },
    });
    uiApi.say(`Picked up box ${from + 1} of ${list.length}.`);
  }

  function onDragOver({ over }: DragOverEvent) {
    const p = plan.current;
    if (!p) return;
    const to = over ? p.keys.indexOf(String(over.id)) : null;
    setView((v) => v && { ...v, line: style === "line" ? lineFor(p, to, origin.current) : null });
    if (!p.left && to === p.from) return;
    p.left = true;
    uiApi.say(to === null ? "The box isn't over a place." : `The box would go to place ${to + 1} of ${p.keys.length}.`);
  }

  function onDragEnd({ over }: DragEndEvent) {
    const p = plan.current;
    plan.current = null;
    setView(null);
    if (!p) return;
    const to = over ? p.keys.indexOf(String(over.id)) : -1;
    if (to < 0 || to === p.from) return uiApi.say("Box dropped where it was.");
    if (style === "slide" || reducedNow()) store.flowMove(p.key, to);
    else {
      // Line style: the boxes haven't moved yet, so each goes from where it was to its new place (180ms, transforms only).
      const before = new Map(boxesNow(p.keys).map((el, i) => [p.keys[i]!, el?.getBoundingClientRect()]));
      flushSync(() => store.flowMove(p.key, to));
      for (const el of boxesNow(store.flowKeys())) {
        const k = el?.dataset.flowStep;
        // The carried copy takes the dropped box to its place itself.
        if (!el || !k || k === p.key) continue;
        const a = before.get(k);
        const b = el.getBoundingClientRect();
        if (!a || (Math.abs(a.left - b.left) < 0.5 && Math.abs(a.top - b.top) < 0.5)) continue;
        el.animate([{ transform: `translate(${a.left - b.left}px, ${a.top - b.top}px)` }, { transform: "translate(0px, 0px)" }], { duration: MOVE_MS, easing: EASE });
      }
    }
    uiApi.say(`Box dropped in place ${to + 1} of ${p.keys.length}.`);
  }

  function onDragCancel() {
    const p = plan.current;
    plan.current = null;
    setView(null);
    if (p) uiApi.say("Moving the box cancelled. It's back where it was.");
  }

  const strategy = style === "line" ? still : axis === "row" ? horizontalListSortingStrategy : verticalListSortingStrategy;
  const accessibility = useMemo(() => ({ announcements: SILENT, screenReaderInstructions: { draggable: HOW } }), []);
  const line = view?.line;
  // The copy is carried by a pointer; from the keyboard the box itself is lifted and the line moves (css/flow.css).
  const copy = view && style === "line" && view.mode === "pointer" ? view.copy : null;

  return (
    <div
      ref={wrap}
      className="xe-flow"
      data-path="flow"
      tabIndex={-1}
      data-axis={axis}
      data-flow-style={style}
      data-flow-drag={view?.mode}
      data-invalid={issue ? "" : undefined}
      aria-describedby={issue ? "flow-issue" : undefined}
    >
      <DndContext
        id={dndId}
        sensors={sensors}
        collisionDetection={detect}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={onDragCancel}
        accessibility={accessibility}
      >
        <SortableContext items={keys as string[]} strategy={strategy}>
          {children}
        </SortableContext>
        {look &&
          createPortal(
            <div ref={layer} className="xe-flow-layer" data-edit-only aria-hidden>
              {line && <div data-flow-line className="xe-flow-line" style={{ left: line.x, top: line.y, width: line.w, height: line.h }} />}
              <DragOverlay zIndex={1} dropAnimation={reduced ? null : DROP}>
                {copy ? (
                  <div className="xe-flow-carried" style={{ width: copy.w, height: copy.h }}>
                    <div data-flow-copy data-last={copy.last || undefined} className="xp-flow-box xe-flow-copy px-3 py-3" style={{ left: copy.box.x, top: copy.box.y, width: copy.box.w, height: copy.box.h }}>
                      <span className="block text-[0.8125rem] leading-snug font-semibold break-words">{copy.step || (copy.last ? "The result" : "What you did")}</span>
                      {copy.detail && <span className="xp-flow-detail mt-1 block text-[0.8125rem] leading-snug">{copy.detail}</span>}
                    </div>
                  </div>
                ) : null}
              </DragOverlay>
            </div>,
            look,
          )}
      </DndContext>
      <span id={MIN_ID} hidden>
        {MIN_WORDS}
      </span>
      <IssueNote id="flow-issue" text={issue} />
    </div>
  );
}
