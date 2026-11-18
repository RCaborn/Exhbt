"use client";

import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { DndContext, MouseSensor, TouchSensor, useDraggable, useSensor, useSensors, type DragMoveEvent, type DragStartEvent } from "@dnd-kit/core";
import { getEventCoordinates } from "@dnd-kit/utilities";
import { ArrowDown, ArrowUp, GripVertical, Plus } from "lucide-react";
import { useReducedMotion } from "@/components/ui/useReducedMotion";
import type { Section } from "@/lib/exhbt/blocks";
import { sectionLabel } from "@/lib/exhbt/sections";
import { lineFor, makePlan, measurePlace, placeAt, type Box, type Measured, type Plan } from "./drag-plan";
import { EASE, MOVE_MS } from "./LabFlow";
import { rowClass, rowsOf } from "./layout";
import type { Version } from "./options";
import { FLOW_ID } from "./samples";
import { SectionContent, StaticSection } from "./sections";
import { kindOf, useLab, useLabStore, useRenderCount, type InsertKind, type ItemKind } from "./store";

const DRAG_INSTRUCTIONS =
  "To move this section, press Space or Enter, use the arrow keys, then press Space or Enter again to drop it, or Escape to cancel. The move up and move down buttons do the same.";

const INSERT_NAMES: Record<InsertKind, string> = { findings: "Findings", quote: "Quote", image: "Image" };

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/** dnd-kit's own announcements are for droppable targets, which the lab doesn't use; the board reads out its own. */
const SILENT = { onDragStart: () => undefined, onDragOver: () => undefined, onDragEnd: () => undefined, onDragCancel: () => undefined };

type Lift = { id: string; mode: "pointer" | "keys"; box: Box; tile: boolean };

/** A drag in progress. Kept outside React state: a drag renders the page twice, when it starts and when it ends. */
type Live = {
  plan: Plan;
  mode: "pointer" | "keys";
  place: number;
  els: Record<string, HTMLElement>;
  /** What the page would look like at each place tried so far. */
  seen: Map<number, Measured>;
  /** Where the pointer was in the board when the section was picked up. */
  grab: { x: number; y: number };
  sections: Record<string, Section>;
};

/**
 * The exhbt's sections, edited and arranged on the page: the main column below the context line.
 *
 * Each section has a frame and a corner toolbar (a grip, move up, move down). The grip is the only
 * thing that drags, so words can be selected, links followed and the page scrolled by touch. A
 * section is picked up with the mouse (6px of movement), a short press of a finger, or Space on
 * the grip, and from then on the page's layout doesn't change until it is dropped: every section
 * keeps its box, and what moves, moves by a transform.
 *
 *  - Version A, slide: the other sections slide to where they would sit, and a dashed box shows
 *    the room made for the lifted one.
 *  - Version B, line: the page stays still and a line shows where the lifted one would go.
 *
 * In both, the pointer carries a lifted copy; dropped, the section moves from where it was let go
 * to its place and any neighbours that pair up again move with it (180ms, transforms only, none
 * for people who ask for less motion). How places are worked out is components/lab/drag-plan.ts.
 */
export function Board({ version }: { version: Version }) {
  const store = useLabStore();
  const order = useLab((d) => d.order);
  const format = useLab((d) => d.format);
  useRenderCount("board");
  const reduced = useReducedMotion();
  const [lift, setLift] = useState<Lift | null>(null);

  const wrap = useRef<HTMLDivElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const line = useRef<HTMLDivElement>(null);
  const landing = useRef<HTMLDivElement>(null);
  const copy = useRef<HTMLDivElement>(null);
  const status = useRef<HTMLParagraphElement>(null);
  const live = useRef<Live | null>(null);
  // The latest values, for the handlers below, which are made once.
  const now = useRef({ version, reduced });
  now.current = { version, reduced };

  // A section's kind never changes, so the layout depends on the order alone.
  const sections = store.get().sections;
  const rows = useMemo(() => rowsOf(order, store.get().sections), [order, store]);
  const labels = useMemo(() => {
    const out: Record<string, string> = {};
    const list = order.filter((id) => id !== FLOW_ID).map((id) => sections[id]!);
    list.forEach((s, i) => (out[s.id] = sectionLabel(list, i, format)));
    out[FLOW_ID] = "Flowchart";
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- kinds are fixed per id; see above.
  }, [order, format]);

  const say = (text: string) => {
    if (status.current) status.current.textContent = text;
  };
  const shells = () => Array.from(wrap.current?.querySelectorAll<HTMLElement>("[data-lab-rows] [data-lab-section]") ?? []);
  const measured = (l: Live, place: number): Measured => {
    let m = l.seen.get(place);
    if (!m) {
      m = measurePlace(host.current!, l.plan, l.sections, place);
      l.seen.set(place, m);
    }
    return m;
  };

  /** Draws the place the drag is at: version A's slides and landing box, or version B's line. */
  const show = useCallback(() => {
    const l = live.current;
    const el = wrap.current;
    if (!l || !el) return;
    const { plan, place } = l;
    el.dataset.labPlace = String(place);
    const at = measured(l, place);
    if (now.current.version === "a") {
      const base = measured(l, plan.home);
      for (const id of plan.rest) {
        const dx = Math.round(at[id]!.x - base[id]!.x);
        const dy = Math.round(at[id]!.y - base[id]!.y);
        l.els[id]!.style.transform = dx || dy ? `translate(${dx}px, ${dy}px)` : "";
      }
      const home = plan.boxes[plan.id]!;
      const land = { x: home.x + Math.round(at[plan.id]!.x - base[plan.id]!.x), y: home.y + Math.round(at[plan.id]!.y - base[plan.id]!.y), w: at[plan.id]!.w, h: at[plan.id]!.h };
      if (l.mode === "keys") l.els[plan.id]!.style.transform = `translate(${land.x - home.x}px, ${land.y - home.y}px)`;
      else if (landing.current) {
        const s = landing.current.style;
        s.left = `${land.x}px`;
        s.top = `${land.y}px`;
        s.width = `${land.w}px`;
        s.height = `${land.h}px`;
        landing.current.hidden = false;
      }
    } else if (line.current) {
      const b = lineFor(plan, place, at);
      line.current.hidden = !b;
      if (b) {
        const s = line.current.style;
        s.left = `${b.x}px`;
        s.top = `${b.y}px`;
        s.width = `${b.w}px`;
        s.height = `${b.h}px`;
      }
    }
  }, []);

  /** Freezes the page as it stands and starts a drag of `id`. */
  const pickUp = useCallback((id: string, mode: "pointer" | "keys", pointer?: { x: number; y: number }) => {
    const el = wrap.current;
    if (!el || live.current) return;
    const doc = store.get();
    const origin = el.getBoundingClientRect();
    const els: Record<string, HTMLElement> = {};
    const boxes: Record<string, Box> = {};
    const kinds: Record<string, ItemKind> = {};
    for (const s of shells()) {
      const sid = s.dataset.labSection!;
      const r = s.getBoundingClientRect();
      els[sid] = s;
      boxes[sid] = { x: r.left - origin.left, y: r.top - origin.top, w: r.width, h: r.height };
      kinds[sid] = kindOf(doc, sid);
    }
    if (!boxes[id]) return;
    const plan = makePlan(id, doc.order, boxes, kinds, doc.sections, origin.width);
    const grab = pointer ? { x: pointer.x - origin.left, y: pointer.y - origin.top } : { x: boxes[id]!.x, y: boxes[id]!.y };
    live.current = { plan, mode, place: plan.home, els, seen: new Map(), grab, sections: doc.sections };
    const tile = rowsOf(doc.order, doc.sections).some((r) => r.type === "grid" && r.ids.includes(id));
    setLift({ id, mode, box: boxes[id]!, tile });
    const name = labels[id] ?? "Section";
    say(`Picked up ${lowerFirst(name)}, place ${plan.home + 1} of ${doc.order.length}.`);
  }, [store, labels]);

  // Once the lifted copy is on the page (the same render), the section it came from steps back.
  useLayoutEffect(() => {
    const l = live.current;
    const el = wrap.current;
    if (!lift || !l || !el) return;
    const { version: v, reduced: still } = now.current;
    el.dataset.labLifting = l.mode;
    const mine = l.els[l.plan.id]!;
    if (l.mode === "pointer") mine.style.opacity = v === "a" ? "0" : "0.35";
    else mine.dataset.lifted = "";
    if (v === "a" && !still) {
      for (const id of l.plan.order) if (id !== l.plan.id || l.mode === "keys") l.els[id]!.style.transition = `transform ${MOVE_MS}ms ${EASE}`;
    }
    show();
  }, [lift, show]);

  /** Moves the drag to a place and reads it out. */
  const goTo = useCallback((place: number) => {
    const l = live.current;
    if (!l || place === l.place) return;
    l.place = place;
    show();
    const name = labels[l.plan.id] ?? "Section";
    say(place === l.plan.home ? `${name} is back where it was, place ${place + 1} of ${l.plan.order.length}.` : `${name} would go to place ${place + 1} of ${l.plan.order.length}.`);
  }, [show, labels]);

  /** Slides every section from where it was to where it is now (FLIP): 180ms, transforms only. */
  const settle = useCallback((first: Map<string, DOMRect>, lifted?: string) => {
    if (now.current.reduced) return;
    for (const s of shells()) {
      const id = s.dataset.labSection!;
      const a = first.get(id);
      if (!a) continue;
      for (const running of s.getAnimations()) running.cancel();
      const b = s.getBoundingClientRect();
      const dx = a.left - b.left;
      const dy = a.top - b.top;
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) continue;
      const anim = s.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "translate(0px, 0px)" }], { duration: MOVE_MS, easing: EASE });
      if (id === lifted) {
        s.dataset.settling = "";
        const done = () => delete s.dataset.settling;
        anim.finished.then(done, done);
      }
    }
  }, []);

  const snapshot = () => {
    const first = new Map<string, DOMRect>();
    for (const s of shells()) first.set(s.dataset.labSection!, s.getBoundingClientRect());
    return first;
  };

  /** Ends the drag: drops the section at its place, or puts everything back. */
  const finish = useCallback((drop: boolean) => {
    const l = live.current;
    const el = wrap.current;
    if (!l || !el) return;
    const { plan, place, mode } = l;
    const first = snapshot();
    if (mode === "pointer" && copy.current) first.set(plan.id, copy.current.getBoundingClientRect());
    for (const s of Object.values(l.els)) {
      s.style.transform = "";
      s.style.transition = "";
      s.style.opacity = "";
      delete s.dataset.lifted;
    }
    delete el.dataset.labLifting;
    if (line.current) line.current.hidden = true;
    if (landing.current) landing.current.hidden = true;
    if (host.current) host.current.textContent = "";
    live.current = null;
    const moved = drop && place !== plan.home;
    flushSync(() => {
      setLift(null);
      if (moved) store.move(plan.id, place);
    });
    settle(first, plan.id);
    const name = labels[plan.id] ?? "Section";
    if (!drop) say(`Moving ${lowerFirst(name)} cancelled. It's back where it was.`);
    else say(moved ? `${name} dropped in place ${place + 1} of ${plan.order.length}.` : `${name} dropped where it was.`);
    if (mode === "keys") el.querySelector<HTMLElement>(`[data-lab-section="${plan.id}"] [data-grip]`)?.focus({ preventScroll: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- snapshot and shells read the page when called.
  }, [store, settle, labels]);

  /* ---------- Pointer and touch (dnd-kit's sensors; the places are the board's own) ---------- */

  const sensors = useSensors(
    // A small movement before a drag starts, so a click on the grip stays a click.
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    // A short press picks up; a swipe that starts on the grip does nothing, and anywhere else scrolls.
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
  );

  const onDragStart = useCallback((e: DragStartEvent) => {
    const at = e.activatorEvent ? getEventCoordinates(e.activatorEvent) : null;
    pickUp(String(e.active.id), "pointer", at ?? undefined);
  }, [pickUp]);

  const onDragMove = useCallback((e: DragMoveEvent) => {
    const l = live.current;
    if (!l || l.mode !== "pointer") return;
    // delta already includes how far the page has scrolled, so this is the pointer's place on the page.
    if (copy.current) copy.current.style.transform = `translate(${e.delta.x}px, ${e.delta.y}px)`;
    goTo(placeAt(l.plan, l.grab.x + e.delta.x, l.grab.y + e.delta.y, l.place));
  }, [goTo]);

  /* ---------- Keyboard: Space picks up, the arrows move a place at a time, Space drops ---------- */

  const onGripKey = useCallback((id: string, e: React.KeyboardEvent) => {
    const l = live.current;
    if (!l) {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        pickUp(id, "keys");
      }
      return;
    }
    if (l.mode !== "keys" || l.plan.id !== id) return;
    const step = (by: number) => {
      e.preventDefault();
      goTo(Math.max(0, Math.min(l.plan.rest.length, l.place + by)));
      // Keep where it would land on the screen.
      const target = now.current.version === "a" ? l.els[id] : l.place === l.plan.home ? l.els[id] : line.current;
      const r = target?.getBoundingClientRect();
      if (!r) return;
      const margin = 96;
      const off = r.top < margin ? r.top - margin : r.bottom > window.innerHeight - margin ? Math.min(r.bottom - (window.innerHeight - margin), r.top - margin) : 0;
      if (off) window.scrollBy({ top: off, behavior: now.current.reduced ? "auto" : "smooth" });
    };
    if (e.key === "ArrowDown" || e.key === "ArrowRight") step(1);
    else if (e.key === "ArrowUp" || e.key === "ArrowLeft") step(-1);
    else if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      finish(true);
    } else if (e.key === "Escape") {
      e.preventDefault();
      finish(false);
    } else if (e.key === "Tab") finish(true);
  }, [pickUp, goTo, finish]);

  const onGripBlur = useCallback((id: string) => {
    const l = live.current;
    if (l && l.mode === "keys" && l.plan.id === id) finish(false);
  }, [finish]);

  /* ---------- Move up and down, and adding a section ---------- */

  const moveBy = useCallback((id: string, by: -1 | 1) => {
    const el = wrap.current;
    const before = store.get().order;
    const i = before.indexOf(id);
    const to = i + by;
    if (!el || i < 0 || to < 0 || to >= before.length) return;
    const first = snapshot();
    flushSync(() => store.move(id, to));
    settle(first, id);
    say(`${labels[id] ?? "Section"} moved ${by < 0 ? "up" : "down"}: now ${to + 1} of ${before.length}.`);
    // Focus stays on the button that was pressed, or the other one when that end is reached.
    const shell = el.querySelector(`[data-lab-section="${id}"]`);
    const pressed = shell?.querySelector<HTMLButtonElement>(`[data-move="${by < 0 ? "up" : "down"}"]`);
    const other = shell?.querySelector<HTMLButtonElement>(`[data-move="${by < 0 ? "down" : "up"}"]`);
    (pressed && !pressed.disabled ? pressed : other)?.focus({ preventScroll: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- snapshot reads the page when called.
  }, [store, settle, labels]);

  const insert = useCallback((at: number, kind: InsertKind) => {
    const el = wrap.current;
    if (!el) return;
    const first = snapshot();
    let id = "";
    flushSync(() => {
      id = store.insert(at, kind);
    });
    settle(first);
    say(`${INSERT_NAMES[kind]} added in place ${at + 1} of ${store.get().order.length}.`);
    const shell = el.querySelector<HTMLElement>(`[data-lab-section="${id}"]`);
    (shell?.querySelector<HTMLElement>("textarea") ?? shell?.querySelector<HTMLElement>("[data-grip]"))?.focus({ preventScroll: true });
    shell?.scrollIntoView({ block: "nearest" });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- snapshot reads the page when called.
  }, [store, settle]);

  // A drag left behind (the sample or the version changed under it) is let go of.
  useEffect(() => () => void (live.current = null), []);

  const indexOf = (id: string) => order.indexOf(id);

  return (
    <div ref={wrap} data-lab-board data-version={version} className="relative">
      <DndContext
        id="lab-sections"
        sensors={sensors}
        onDragStart={onDragStart}
        onDragMove={onDragMove}
        onDragEnd={() => finish(true)}
        onDragCancel={() => finish(false)}
        accessibility={{ announcements: SILENT, screenReaderInstructions: { draggable: DRAG_INSTRUCTIONS } }}
      >
        <div data-lab-rows>
          {rows.map((row) => (
            <div
              key={row.ids[0]}
              className={rowClass(row)}
              role={row.type === "two" || row.type === "grid" ? "group" : undefined}
              aria-label={row.type === "grid" || (row.type === "two" && row.of === "image") ? "Images" : row.type === "two" ? "Graphs" : undefined}
            >
              <InsertPoint at={indexOf(row.ids[0]!)} label={`Add a section before ${lowerFirst(labels[row.ids[0]!] ?? "this section")}`} onInsert={insert} />
              {row.ids.map((id) => (
                <Shell key={id} id={id} kind={kindOf(store.get(), id)} label={lowerFirst(labels[id] ?? "section")} first={indexOf(id) === 0} last={indexOf(id) === order.length - 1} onKey={onGripKey} onBlur={onGripBlur} onMove={moveBy} />
              ))}
            </div>
          ))}
        </div>
        <InsertPoint at={order.length} end label="Add a section at the end" onInsert={insert} />
      </DndContext>

      {/* The hidden copy the drag measures (drag-plan.ts): no height, clipped, never read out. */}
      <div ref={host} aria-hidden inert data-lab-measure className="pointer-events-none invisible absolute inset-x-0 top-0 h-0 overflow-hidden" />
      <div ref={line} hidden aria-hidden data-lab-line className="lab-line" />
      <div ref={landing} hidden aria-hidden data-lab-landing className="lab-landing" />
      {lift?.mode === "pointer" && (
        <div
          ref={copy}
          aria-hidden
          inert
          data-lab-copy
          className={`lab-lift grid grid-cols-[minmax(0,1fr)] [&_.xp-section]:mt-0 ${lift.tile ? "[&_img]:aspect-[4/3] [&_img]:object-contain" : ""}`}
          style={{ left: lift.box.x, top: lift.box.y, width: lift.box.w, height: lift.box.h }}
        >
          <div className="lab-card" />
          <div className="relative grid grid-cols-[minmax(0,1fr)]">
            <StaticSection doc={store.get()} id={lift.id} prefix="lifted-" />
          </div>
        </div>
      )}
      <p ref={status} role="status" aria-live="assertive" data-lab-status className="sr-only" />
    </div>
  );
}

/**
 * One section in its frame, with its corner toolbar. The frame is an outline and the toolbar sits
 * outside the flow, so neither takes any room: the section is exactly where the page puts it.
 */
const Shell = memo(function Shell({
  id,
  kind,
  label,
  first,
  last,
  onKey,
  onBlur,
  onMove,
}: {
  id: string;
  kind: ItemKind;
  /** "graph 1", for "Drag graph 1 to move it". */
  label: string;
  first: boolean;
  last: boolean;
  onKey: (id: string, e: React.KeyboardEvent) => void;
  onBlur: (id: string) => void;
  onMove: (id: string, by: -1 | 1) => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef } = useDraggable({ id, attributes: { roleDescription: "draggable section" } });
  return (
    <div ref={setNodeRef} data-lab-section={id} data-kind={kind} data-tools={kind === "graph" || kind === "image" ? "inside" : undefined} className="lab-shell relative grid min-w-0 grid-cols-[minmax(0,1fr)] [&_.xp-section]:mt-0">
      <div className="lab-tools">
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          onKeyDown={(e) => onKey(id, e)}
          onBlur={() => onBlur(id)}
          aria-label={`Drag ${label} to move it`}
          title={`Drag ${label}`}
          data-grip
          className="xp-outline-button lab-tool lab-grip"
        >
          <GripVertical aria-hidden size={18} strokeWidth={2.25} />
        </button>
        <button type="button" data-move="up" disabled={first} onClick={() => onMove(id, -1)} aria-label={`Move ${label} up`} title="Move up" className="xp-outline-button lab-tool">
          <ArrowUp aria-hidden size={16} strokeWidth={2.25} />
        </button>
        <button type="button" data-move="down" disabled={last} onClick={() => onMove(id, 1)} aria-label={`Move ${label} down`} title="Move down" className="xp-outline-button lab-tool">
          <ArrowDown aria-hidden size={16} strokeWidth={2.25} />
        </button>
      </div>
      <SectionContent id={id} />
    </div>
  );
});

/** "+" in the gap above a row (or after the last): opens three placeholder sections to add there. */
const InsertPoint = memo(function InsertPoint({ at, end = false, label, onInsert }: { at: number; end?: boolean; label: string; onInsert: (at: number, kind: InsertKind) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className="lab-insert"
      data-end={end || undefined}
      data-open={open || undefined}
      onKeyDown={(e) => {
        if (e.key === "Escape") setOpen(false);
      }}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false);
      }}
    >
      <span className="relative inline-flex">
        <button type="button" data-insert={at} aria-expanded={open} aria-label={label} title="Add a section here" onClick={() => setOpen((o) => !o)} className="xp-outline-button lab-tool">
          <Plus aria-hidden size={16} strokeWidth={2.25} />
        </button>
        {open && (
          <span role="group" aria-label="Add a section" className="lab-menu">
            {(Object.keys(INSERT_NAMES) as InsertKind[]).map((k) => (
              <button
                key={k}
                type="button"
                data-insert-kind={k}
                onClick={() => {
                  setOpen(false);
                  onInsert(at, k);
                }}
                className="xp-outline-button inline-flex h-9 items-center px-3 text-[0.8125rem] font-semibold whitespace-nowrap"
              >
                {INSERT_NAMES[k]}
              </button>
            ))}
          </span>
        )}
      </span>
    </div>
  );
});
