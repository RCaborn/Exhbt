"use client";

import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { DndContext, MouseSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors, type DragStartEvent } from "@dnd-kit/core";
import { getEventCoordinates } from "@dnd-kit/utilities";
import { ArrowDown, ArrowUp, GripVertical, Plus, X } from "lucide-react";
import { useReducedMotion } from "@/components/ui/useReducedMotion";
import type { Section } from "@/lib/exhbt/blocks";
import { sectionLabel } from "@/lib/exhbt/sections";
import { blockIcon, blockName, blockOptions, draftBlock, whyFull, type BlockKind, type Draft } from "./blocks";
import { lineFor, makePlan, measurePlace, placeAt, type Box, type Measured, type Plan } from "./drag-plan";
import { EASE, MOVE_MS } from "./LabFlow";
import { rowClass, rowsOf } from "./layout";
import { sectionStyle, type DragStyle, type Version } from "./options";
import { FLOW_ID, type LabDoc } from "./samples";
import { SectionContent, StaticSection } from "./sections";
import { kindOf, useLab, useLabStore, useRenderCount, type ItemKind } from "./store";
import { Tray, TRAY_ID } from "./Tray";

const DRAG_INSTRUCTIONS =
  "To move this section, press Space or Enter, use the arrow keys, then press Space or Enter again to drop it, or Escape to cancel. The move up and move down buttons do the same.";

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/** dnd-kit's own announcements are for droppable targets, which the lab doesn't use; the board reads out its own. */
const SILENT = { onDragStart: () => undefined, onDragOver: () => undefined, onDragEnd: () => undefined, onDragCancel: () => undefined };

/** What is being carried: a section already on the page, or a new block from the tray (`draft`). */
type Lift = { id: string; mode: "pointer" | "keys"; box: Box; tile: boolean; draft?: Draft; name?: string };

/** No place: a new block that hasn't been carried onto the page yet. */
const NOWHERE = -1;

/** A drag in progress. Kept outside React state: a drag renders the page twice, when it starts and when it ends. */
type Live = {
  plan: Plan;
  mode: "pointer" | "keys";
  /** Whether this drag slides the page or draws a line: the version's choice for this section. */
  style: DragStyle;
  place: number;
  els: Record<string, HTMLElement>;
  /** What the page would look like at each place tried so far. */
  seen: Map<number, Measured>;
  /** Where the pointer was in the board when the section was picked up, and where it is on the screen now. */
  grab: { x: number; y: number };
  pointer: { x: number; y: number };
  sections: Record<string, Section>;
  /** A new block from the tray, not on the page yet. */
  draft?: Draft;
  /** Stops following the pointer. */
  stop?: () => void;
};

/**
 * The exhbt's sections, edited and arranged on the page: the main column below the context line.
 *
 * Each section has a frame and a corner toolbar (a grip, move up, move down, remove). The grip is
 * the only thing that drags, so words can be selected, links followed and the page scrolled by
 * touch. A section is picked up with the mouse (6px of movement), a short press of a finger, or
 * Space on the grip, and from then on the page's layout doesn't change until it is dropped: every
 * section keeps its box, and what moves, moves by a transform.
 *
 *  - Slide (version A): the other sections slide to where they would sit, and a dashed box shows
 *    the room made for the lifted one.
 *  - Line (version B): the page stays still and a line shows where the lifted one would go.
 *  - Mix, the default: sections slide and the flowchart uses the line (sectionStyle in options.ts).
 *
 * In both, the pointer carries a lifted copy; dropped, the section moves from where it was let go
 * to its place and any neighbours that pair up again move with it (180ms, transforms only, none
 * for people who ask for less motion). How places are worked out is components/lab/drag-plan.ts.
 *
 * New blocks come in three ways, all through the same rules (components/lab/blocks.ts): the "+"
 * between sections, the tray beside the page on a desktop (components/lab/Tray.tsx), dragged in
 * with the same feel as moving a section, and Enter on a block in the tray.
 */
export function Board({ version }: { version: Version }) {
  const store = useLabStore();
  const order = useLab((d) => d.order);
  const format = useLab((d) => d.format);
  useRenderCount("board");
  const reduced = useReducedMotion();
  const [lift, setLift] = useState<Lift | null>(null);

  const wrap = useRef<HTMLDivElement | null>(null);
  const host = useRef<HTMLDivElement>(null);
  const sizer = useRef<HTMLDivElement>(null);
  const line = useRef<HTMLDivElement>(null);
  const landing = useRef<HTMLDivElement>(null);
  const copy = useRef<HTMLDivElement>(null);
  const status = useRef<HTMLParagraphElement>(null);
  const live = useRef<Live | null>(null);
  /** The section the focus was last in, for "add after the section you were last in". */
  const lastFocus = useRef<string | null>(null);
  const lastDrop = useRef(0);
  // The latest values, for the handlers below, which are made once.
  const now = useRef({ version, reduced });
  now.current = { version, reduced };

  // The page is one droppable, so dnd-kit scrolls the page for a block carried in from the tray too
  // (the tray is fixed to the screen, and a fixed thing has nothing to scroll of its own).
  const { setNodeRef: setDropRef } = useDroppable({ id: "lab-page" });
  const setWrap = useCallback(
    (el: HTMLDivElement | null) => {
      wrap.current = el;
      setDropRef(el);
    },
    [setDropRef],
  );

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
  /** What the lifted thing is called, and how many places there will be once it is down. */
  const nameOf = (l: Live) => (l.draft ? blockName(store.get(), l.draft.kind) : (labels[l.plan.id] ?? "Section"));
  const placesOf = (l: Live) => l.plan.rest.length + 1;

  /** Draws the place the drag is at: the slides and landing box, or the line. */
  const show = useCallback(() => {
    const l = live.current;
    const el = wrap.current;
    if (!l || !el) return;
    const { plan, place } = l;
    el.dataset.labPlace = String(place);
    if (place === NOWHERE) {
      for (const id of plan.rest) l.els[id]!.style.transform = "";
      if (landing.current) landing.current.hidden = true;
      if (line.current) line.current.hidden = true;
      return;
    }
    const at = measured(l, place);
    if (l.style === "slide") {
      // Where everything sits with the lifted thing where it came from: its own place, or off the page for a new block.
      const base = measured(l, l.draft ? NOWHERE : plan.home);
      for (const id of plan.rest) {
        const dx = Math.round(at[id]!.x - base[id]!.x);
        const dy = Math.round(at[id]!.y - base[id]!.y);
        l.els[id]!.style.transform = dx || dy ? `translate(${dx}px, ${dy}px)` : "";
      }
      const mine = at[plan.id]!;
      let land: Box;
      if (l.draft) {
        // The measured copy and the page share an origin; any difference between them is taken from the first section.
        const ref = plan.rest[0];
        land = { x: mine.x + (ref ? plan.boxes[ref]!.x - base[ref]!.x : 0), y: mine.y + (ref ? plan.boxes[ref]!.y - base[ref]!.y : 0), w: mine.w, h: mine.h };
      } else {
        const home = plan.boxes[plan.id]!;
        land = { x: home.x + Math.round(mine.x - base[plan.id]!.x), y: home.y + Math.round(mine.y - base[plan.id]!.y), w: mine.w, h: mine.h };
        if (l.mode === "keys") l.els[plan.id]!.style.transform = `translate(${land.x - home.x}px, ${land.y - home.y}px)`;
      }
      if (l.mode === "pointer" && landing.current) {
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

  /** Moves the drag to a place and reads it out. */
  const goTo = useCallback((place: number) => {
    const l = live.current;
    if (!l || place === l.place) return;
    l.place = place;
    show();
    const name = nameOf(l);
    if (place === NOWHERE) say(`${name} isn't over the page.`);
    else say(place === l.plan.home ? `${name} is back where it was, place ${place + 1} of ${placesOf(l)}.` : `${name} would go to place ${place + 1} of ${placesOf(l)}.`);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- nameOf reads the latest labels when called.
  }, [show, labels]);

  /** Puts the lifted copy under the pointer and works out the place from where the pointer is on the page. */
  const follow = useCallback(() => {
    const l = live.current;
    const el = wrap.current;
    if (!l || !el || l.mode !== "pointer") return;
    const o = el.getBoundingClientRect();
    const px = l.pointer.x - o.left;
    const py = l.pointer.y - o.top;
    if (copy.current) copy.current.style.transform = `translate(${px - l.grab.x}px, ${py - l.grab.y}px)`;
    // A new block has no place until it is carried off the tray and onto the page.
    if (l.draft && px > l.plan.width + 8) goTo(NOWHERE);
    else goTo(placeAt(l.plan, px, py, l.place));
  }, [goTo]);

  /** The page as it stands: every section's element, box and kind. */
  const freeze = () => {
    const el = wrap.current!;
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
    return { doc, origin, els, boxes, kinds };
  };

  /** From here until the drop, the pointer (and the page scrolling under it) is followed directly. */
  const watchPointer = (l: Live) => {
    const move = (e: MouseEvent | TouchEvent) => {
      const p = "touches" in e ? e.touches[0] : e;
      if (!p) return;
      l.pointer = { x: p.clientX, y: p.clientY };
      follow();
    };
    window.addEventListener("mousemove", move, true);
    window.addEventListener("touchmove", move, { capture: true, passive: true });
    window.addEventListener("scroll", follow, { capture: true, passive: true });
    // A block from the tray: the tray is fixed to the window, so dnd-kit has nothing of its to scroll
    // and leaves the page alone. The board scrolls the page itself, the same way: once the block is
    // over the page, the nearer the pointer is to the top or bottom edge (the outer fifths), the faster.
    let frame = 0;
    if (l.draft) {
      const edge = () => {
        const zone = window.innerHeight * 0.2;
        const y = l.pointer.y;
        const pull = y < zone ? (y - zone) / zone : y > window.innerHeight - zone ? (y - (window.innerHeight - zone)) / zone : 0;
        if (pull && l.place !== NOWHERE) window.scrollBy(0, Math.round(pull * 16));
        frame = requestAnimationFrame(edge);
      };
      frame = requestAnimationFrame(edge);
    }
    l.stop = () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("mousemove", move, true);
      window.removeEventListener("touchmove", move, true);
      window.removeEventListener("scroll", follow, true);
    };
  };

  /** Freezes the page as it stands and starts a drag of `id`. */
  const pickUp = useCallback((id: string, mode: "pointer" | "keys", pointer?: { x: number; y: number }) => {
    if (!wrap.current || live.current) return;
    const { doc, origin, els, boxes, kinds } = freeze();
    if (!boxes[id]) return;
    const plan = makePlan(id, doc.order, boxes, kinds, doc.sections, origin.width);
    const at = pointer ?? { x: origin.left + boxes[id]!.x, y: origin.top + boxes[id]!.y };
    const style = sectionStyle(now.current.version, id === FLOW_ID);
    const l: Live = { plan, mode, style, place: plan.home, els, seen: new Map(), grab: { x: at.x - origin.left, y: at.y - origin.top }, pointer: at, sections: doc.sections };
    live.current = l;
    if (mode === "pointer") watchPointer(l);
    const tile = rowsOf(doc.order, doc.sections).some((r) => r.type === "grid" && r.ids.includes(id));
    setLift({ id, mode, box: boxes[id]!, tile });
    say(`Picked up ${lowerFirst(labels[id] ?? "Section")}, place ${plan.home + 1} of ${doc.order.length}.`);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- freeze and watchPointer read the page when called.
  }, [store, labels, follow]);

  /** Starts carrying a new block from the tray: the page is frozen as for any drag, and the block has no place until it is over the page. */
  const pickUpNew = useCallback((kind: BlockKind, pointer: { x: number; y: number }, from: DOMRect) => {
    if (!wrap.current || live.current) return;
    const { doc, origin, els, boxes, kinds } = freeze();
    const draft = draftBlock(doc, kind);
    if (!draft) {
      say(`${whyFull(doc, kind) ?? "There is no room for it"}.`);
      return;
    }
    kinds[draft.id] = kind;
    const withDraft = draft.section ? { ...doc.sections, [draft.id]: draft.section } : doc.sections;
    const plan = makePlan(draft.id, doc.order, boxes, kinds, withDraft, origin.width);
    // Its size on the page isn't known until it has been drawn once; the hidden copy below is measured as the lift begins.
    boxes[draft.id] = { x: 0, y: 0, w: origin.width, h: 120 };
    const style = sectionStyle(now.current.version, kind === "flow");
    const l: Live = { plan, mode: "pointer", style, place: NOWHERE, els, seen: new Map(), grab: { x: pointer.x - origin.left, y: pointer.y - origin.top }, pointer, sections: withDraft, draft };
    live.current = l;
    watchPointer(l);
    const name = blockName(doc, kind);
    setLift({ id: draft.id, mode: "pointer", box: { x: from.left - origin.left, y: from.top - origin.top, w: from.width, h: from.height }, tile: false, draft, name });
    say(`Picked up a new block: ${lowerFirst(name)}. Carry it onto the page.`);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- freeze and watchPointer read the page when called.
  }, [store, follow]);

  // Once the lifted copy is on the page (the same render), the section it came from steps back.
  useLayoutEffect(() => {
    const l = live.current;
    const el = wrap.current;
    if (!lift || !l || !el) return;
    const still = now.current.reduced;
    el.dataset.labLifting = l.mode;
    el.dataset.labStyle = l.style;
    if (l.draft) {
      // The new block as the page would draw it, measured once, so the room made for it is the right size.
      const drawn = sizer.current?.firstElementChild?.getBoundingClientRect();
      if (drawn) l.plan.boxes[l.plan.id] = { x: 0, y: 0, w: drawn.width, h: drawn.height };
    } else {
      const mine = l.els[l.plan.id]!;
      if (l.mode === "pointer") mine.style.opacity = l.style === "slide" ? "0" : "0.35";
      else mine.dataset.lifted = "";
    }
    if (l.style === "slide" && !still) {
      for (const id of l.plan.order) if (id !== l.plan.id || l.mode === "keys") l.els[id]!.style.transition = `transform ${MOVE_MS}ms ${EASE}`;
    }
    show();
    follow();
  }, [lift, show, follow]);

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

  /** Ends the drag: drops the section at its place (or adds the new block there), or puts everything back. */
  const finish = useCallback((drop: boolean) => {
    const l = live.current;
    const el = wrap.current;
    if (!l || !el) return;
    const { plan, place, mode, draft } = l;
    l.stop?.();
    const first = snapshot();
    if (mode === "pointer" && copy.current) first.set(plan.id, copy.current.getBoundingClientRect());
    for (const s of Object.values(l.els)) {
      s.style.transform = "";
      s.style.transition = "";
      s.style.opacity = "";
      delete s.dataset.lifted;
    }
    delete el.dataset.labLifting;
    delete el.dataset.labStyle;
    if (line.current) line.current.hidden = true;
    if (landing.current) landing.current.hidden = true;
    if (host.current) host.current.textContent = "";
    const name = nameOf(l);
    const places = placesOf(l);
    live.current = null;
    lastDrop.current = Date.now();
    const moved = drop && place !== plan.home && place !== NOWHERE;
    flushSync(() => {
      setLift(null);
      if (!moved) return;
      if (draft) store.insertDraft(place, draft);
      else store.move(plan.id, place);
    });
    settle(first, plan.id);
    if (draft) say(moved ? `${name} added in place ${place + 1} of ${places}.` : `${name} was not added.`);
    else if (!drop) say(`Moving ${lowerFirst(name)} cancelled. It's back where it was.`);
    else say(moved ? `${name} dropped in place ${place + 1} of ${places}.` : `${name} dropped where it was.`);
    if (mode === "keys") el.querySelector<HTMLElement>(`[data-lab-section="${plan.id}"] [data-grip]`)?.focus({ preventScroll: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- snapshot, shells and nameOf read the page when called.
  }, [store, settle, labels]);

  /* ---------- Pointer and touch (dnd-kit's sensors; the places are the board's own) ---------- */

  const sensors = useSensors(
    // A small movement before a drag starts, so a click on the grip stays a click.
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    // A short press picks up; a swipe that starts on the grip does nothing, and anywhere else scrolls.
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
  );

  const onDragStart = useCallback((e: DragStartEvent) => {
    const at = (e.activatorEvent ? getEventCoordinates(e.activatorEvent) : null) ?? undefined;
    const id = String(e.active.id);
    if (!id.startsWith(TRAY_ID)) return pickUp(id, "pointer", at);
    const kind = id.slice(TRAY_ID.length) as BlockKind;
    const tile = document.querySelector(`[data-tray-kind="${kind}"]`)?.getBoundingClientRect();
    if (at && tile) pickUpNew(kind, at, tile);
  }, [pickUp, pickUpNew]);

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
      const target = l.style === "slide" ? l.els[id] : l.place === l.plan.home ? l.els[id] : line.current;
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

  /* ---------- Move up and down, adding a block, taking a section off ---------- */

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

  /** Puts a new block of a kind on the page at `at`, if the layout has room for it. Returns its id. */
  const add = (at: number, kind: BlockKind, where: string): string | null => {
    const doc = store.get();
    const draft = draftBlock(doc, kind);
    if (!draft) {
      say(`${whyFull(doc, kind) ?? "There is no room for it"}.`);
      return null;
    }
    const first = snapshot();
    flushSync(() => store.insertDraft(at, draft));
    settle(first);
    say(`${blockName(doc, kind)} added ${where}, place ${at + 1} of ${doc.order.length + 1}.`);
    return draft.id;
  };

  /** From a "+" between sections: the new block goes there, and the focus goes into it. */
  const insert = useCallback((at: number, kind: BlockKind) => {
    const id = add(at, kind, "here");
    if (!id) return;
    const shell = wrap.current?.querySelector<HTMLElement>(`[data-lab-section="${id}"]`);
    (shell?.querySelector<HTMLElement>("textarea") ?? shell?.querySelector<HTMLElement>("[data-grip]"))?.focus({ preventScroll: true });
    shell?.scrollIntoView({ block: "nearest" });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- add reads the page when called.
  }, [store, settle]);

  /** From the tray, by Enter or a click: after the section the focus was last in, or at the end. The focus stays on the tray. */
  const addFromTray = useCallback((kind: BlockKind) => {
    // A click that only ends a drag isn't a press of the button.
    if (Date.now() - lastDrop.current < 300) return;
    const doc = store.get();
    const last = lastFocus.current && doc.order.includes(lastFocus.current) ? lastFocus.current : null;
    const at = last ? doc.order.indexOf(last) + 1 : doc.order.length;
    const id = add(at, kind, last ? `after ${lowerFirst(labels[last] ?? "that section")}` : "at the end");
    if (id) wrap.current?.querySelector<HTMLElement>(`[data-lab-section="${id}"]`)?.scrollIntoView({ block: "nearest", behavior: now.current.reduced ? "auto" : "smooth" });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- add reads the page when called.
  }, [store, settle, labels]);

  const remove = useCallback((id: string) => {
    const el = wrap.current;
    const before = store.get().order;
    const i = before.indexOf(id);
    if (!el || i < 0) return;
    const first = snapshot();
    flushSync(() => store.remove(id));
    settle(first);
    say(`${labels[id] ?? "Section"} removed.`);
    if (lastFocus.current === id) lastFocus.current = null;
    // The focus goes to what took its place, or to the "+" at the end.
    const next = store.get().order[i] ?? store.get().order[i - 1];
    const target = next ? el.querySelector<HTMLElement>(`[data-lab-section="${next}"] [data-grip]`) : el.querySelector<HTMLElement>("[data-insert-end]");
    target?.focus({ preventScroll: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- snapshot reads the page when called.
  }, [store, settle, labels]);

  // A drag left behind (the page went away under it) is let go of.
  useEffect(
    () => () => {
      live.current?.stop?.();
      live.current = null;
    },
    [],
  );

  const indexOf = (id: string) => order.indexOf(id);
  const draftDoc = (d: Draft): LabDoc => {
    const doc = store.get();
    return { ...doc, sections: d.section ? { ...doc.sections, [d.id]: d.section } : doc.sections, imageUrls: d.picture ? { ...doc.imageUrls, [d.picture.fileId]: d.picture.url } : doc.imageUrls };
  };

  return (
    <div ref={setWrap} data-lab-board data-version={version} className="relative">
      <DndContext
        id="lab-sections"
        sensors={sensors}
        onDragStart={onDragStart}
        onDragEnd={() => finish(true)}
        onDragCancel={() => finish(false)}
        accessibility={{ announcements: SILENT, screenReaderInstructions: { draggable: DRAG_INSTRUCTIONS } }}
      >
        <div
          data-lab-rows
          onFocusCapture={(e) => {
            const id = (e.target as HTMLElement).closest<HTMLElement>("[data-lab-section]")?.dataset.labSection;
            if (id) lastFocus.current = id;
          }}
        >
          {rows.map((row) => (
            <div
              key={row.ids[0]}
              className={rowClass(row)}
              role={row.type === "two" || row.type === "grid" ? "group" : undefined}
              aria-label={row.type === "grid" || (row.type === "two" && row.of === "image") ? "Images" : row.type === "two" ? "Graphs" : undefined}
            >
              <InsertPoint at={indexOf(row.ids[0]!)} label={`Add a block before ${lowerFirst(labels[row.ids[0]!] ?? "this section")}`} onInsert={insert} />
              {row.ids.map((id) => (
                <Shell key={id} id={id} kind={kindOf(store.get(), id)} label={lowerFirst(labels[id] ?? "section")} first={indexOf(id) === 0} last={indexOf(id) === order.length - 1} onKey={onGripKey} onBlur={onGripBlur} onMove={moveBy} onRemove={remove} />
              ))}
            </div>
          ))}
        </div>
        <InsertPoint at={order.length} end label="Add a block at the end" onInsert={insert} />
        <Tray onAdd={addFromTray} />
      </DndContext>

      {/* The hidden copy the drag measures (drag-plan.ts): no height, clipped, never read out. */}
      <div ref={host} aria-hidden inert data-lab-measure className="pointer-events-none invisible absolute inset-x-0 top-0 h-0 overflow-hidden" />
      <div ref={line} hidden aria-hidden data-lab-line className="lab-line" />
      <div ref={landing} hidden aria-hidden data-lab-landing className="lab-landing" />
      {lift?.draft && (
        // A new block drawn once, unseen, at the column's width: how big it will be on the page.
        <div ref={sizer} aria-hidden inert className="pointer-events-none invisible absolute inset-x-0 top-0 h-0 overflow-hidden [&_.xp-section]:mt-0">
          <div className="grid grid-cols-[minmax(0,1fr)]">
            <StaticSection doc={draftDoc(lift.draft)} id={lift.id} prefix="sizing-" />
          </div>
        </div>
      )}
      {lift?.mode === "pointer" &&
        (lift.draft ? (
          <div ref={copy} aria-hidden inert data-lab-copy data-lab-chip className="lab-lift" style={{ left: lift.box.x, top: lift.box.y, width: lift.box.w, height: lift.box.h }}>
            <span className="lab-tray-tile lab-tray-lifted">
              <ChipIcon kind={lift.draft.kind} />
              <span>{lift.name}</span>
            </span>
          </div>
        ) : (
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
        ))}
      <p ref={status} role="status" aria-live="assertive" data-lab-status className="sr-only" />
    </div>
  );
}

function ChipIcon({ kind }: { kind: BlockKind }) {
  const Icon = blockIcon(kind);
  return <Icon aria-hidden size={18} strokeWidth={2} />;
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
  onRemove,
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
  onRemove: (id: string) => void;
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
        <button type="button" data-remove onClick={() => onRemove(id)} aria-label={`Remove ${label}`} title="Remove" className="xp-outline-button lab-tool">
          <X aria-hidden size={16} strokeWidth={2.25} />
        </button>
      </div>
      <SectionContent id={id} />
    </div>
  );
});

/**
 * "+" in the gap above a row (or after the last): opens the blocks the layout can hold, to add one
 * there. A kind with no room left is listed but can't be chosen, with the reason beside it.
 */
const InsertPoint = memo(function InsertPoint({ at, end = false, label, onInsert }: { at: number; end?: boolean; label: string; onInsert: (at: number, kind: BlockKind) => void }) {
  const store = useLabStore();
  const [open, setOpen] = useState(false);
  const options = open ? blockOptions(store.get()) : [];
  return (
    <div
      className="lab-insert"
      data-end={end || undefined}
      data-open={open || undefined}
      onKeyDown={(e) => {
        if (e.key !== "Escape" || !open) return;
        setOpen(false);
        e.currentTarget.querySelector<HTMLElement>("[data-insert]")?.focus();
      }}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false);
      }}
    >
      <span className="relative inline-flex">
        <button type="button" data-insert={at} data-insert-end={end || undefined} aria-expanded={open} aria-label={label} title="Add a block here" onClick={() => setOpen((o) => !o)} className="xp-outline-button lab-tool">
          <Plus aria-hidden size={16} strokeWidth={2.25} />
        </button>
        {open && (
          <ul role="group" aria-label="Add a block" className="lab-menu">
            {options.map(({ kind, name, icon: Icon, full }) => (
              <li key={kind}>
                <button
                  type="button"
                  data-insert-kind={kind}
                  disabled={Boolean(full)}
                  aria-describedby={full ? `lab-full-${at}-${kind}` : undefined}
                  onClick={() => {
                    setOpen(false);
                    onInsert(at, kind);
                  }}
                  className="lab-menu-item"
                >
                  <Icon aria-hidden size={16} strokeWidth={2.25} className="mt-0.5 shrink-0" />
                  <span className="min-w-0">
                    <span className="block font-semibold">{name}</span>
                    {full && (
                      <span id={`lab-full-${at}-${kind}`} className="lab-menu-why block">
                        {full}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </span>
    </div>
  );
});
