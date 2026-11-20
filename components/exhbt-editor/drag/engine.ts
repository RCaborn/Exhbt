"use client";

import type { KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent, TouchEvent as ReactTouchEvent } from "react";
import { flushSync } from "react-dom";
import { MouseSensor, TouchSensor } from "@dnd-kit/core";
import { FLOW_ID, type ExhbtDoc } from "@/lib/exhbt/blocks";
import { formatOf, type Format } from "@/lib/exhbt/formats";
import { blockOptions, pageItems, rowsFor, type BlockKind, type ItemAs, type PageItem } from "@/lib/exhbt/layouts";
import type { UiApi } from "../context";
import type { FilesController } from "../files";
import { labelOf } from "../labels";
import type { Store } from "../store-core";
import { draftItem, measureOrder, type Frozen } from "./measure";
import { FLOW_SECTION_STYLE, SECTION_STYLE } from "./options";
import { lineFor, makePlan, orderWith, placeAt, rowsInfo, type Box, type Measured, type Plan } from "./plan";

/*
 * The drag engine (decision 0026, "Dragging"): one per visit, outside React, so a drag renders the
 * page only when it is dropped. The board (index.ts) is its public face; DragBoard (Board.tsx) draws
 * its overlays: the lifted copy, the dashed box for the room made, and the line.
 *
 *  1. Freeze at pick-up. Every page item's box is measured once. Until the drop no item's layout box
 *     changes; anything that moves, moves by a transform.
 *  2. The place comes from the frozen page and the pointer (plan.ts), never from what is drawn.
 *  3. Sliding or a line is only what is drawn: for sliding, where the others would sit is measured in
 *     a hidden copy of the page's own rows (measure.ts).
 *  4. The drop moves things from where they were let go to their places: 180ms, transforms only.
 *     Under reduced motion nothing animates.
 *
 * dnd-kit is used for its sensors and nothing else: a mouse picks up after 6px, a finger after a
 * 150ms press with 8px of give. The engine follows the pointer itself and scrolls the page itself
 * near the top and bottom edges, for a section and a block from the tray alike. Sections are found
 * by `data-section-id` every time: a section that changes row is a new node.
 */

export const MOVE_MS = 180;
export const EASE = "cubic-bezier(0.2, 0, 0, 1)";
/** No place: a new block not yet over the page. */
export const NOWHERE = -1;
/** The words a grip is described by (its aria-describedby), drawn once by DragBoard. */
export const HOW_ID = "xe-drag-how";
export const HOW =
  "To move this section, press Space or Enter, use the arrow keys, then press Space or Enter again to drop it, or Escape to cancel. The move up and move down buttons do the same.";

const FIELD = 'textarea, input:not([type=file]), [contenteditable]:not([contenteditable="false"]), [role=textbox]';
const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const later = (fn: () => void) => requestAnimationFrame(() => requestAnimationFrame(fn));

/** The editing page's main column: the parent of every "+" (LayoutMain draws them in it, beside the rows). */
export function mainColumn(): HTMLElement | null {
  return document.querySelector<HTMLElement>('[data-editor="page"] .xe-insert')?.parentElement ?? null;
}
const frameIn = (main: ParentNode, id: string) => main.querySelector<HTMLElement>(`[data-section-id="${CSS.escape(id)}"]`);
const frames = (main: ParentNode) => Array.from(main.querySelectorAll<HTMLElement>("[data-section-id]"));

/** What DragBoard draws while something is carried. */
export type Lift = {
  id: string;
  mode: "pointer" | "keys";
  style: "slide" | "line";
  /** The carried item's box at pick-up (a tray block's tile), in the column's coordinates. */
  box: Box;
  /** The main column, which the overlay is drawn in. */
  main: HTMLElement;
  /** How the carried item was drawn, for its copy. */
  as: ItemAs;
  /** A new block from the tray. */
  draft?: { kind: BlockKind; name: string };
};

/** The overlay's elements, once DragBoard has drawn them. */
export type Overlay = { root: HTMLElement; space: HTMLElement; copy: HTMLElement | null; line: HTMLElement; landing: HTMLElement; sizer: HTMLElement | null };

type Sensing = { stop(): void } | null;

type Live = {
  plan: Plan;
  mode: "pointer" | "keys";
  style: "slide" | "line";
  place: number;
  doc: ExhbtDoc;
  f: Format;
  items: Record<string, PageItem>;
  frozen: Frozen;
  els: Record<string, HTMLElement>;
  seen: Map<number, Measured>;
  main: HTMLElement;
  /** The main column's place on the page (not the window), fixed for the drag. */
  origin: { x: number; y: number };
  host: HTMLElement;
  /** Where the pointer was in the column at pick-up, where it is in the window now, and whether it has moved far enough to scroll the page. */
  grab: { x: number; y: number };
  pointer: { x: number; y: number };
  start: { x: number; y: number };
  armed: boolean;
  draft?: { kind: BlockKind; name: string; item: PageItem };
  overlay?: Overlay;
  /** Which sensor is driving this drag, if a pointer is. */
  sensor?: object;
  stop?: () => void;
};

export type Engine = ReturnType<typeof createEngine>;

declare global {
  interface Window {
    /** Development only: a drag in progress, for e2e/editor-drag.spec.ts. */
    __exhbtDrag?: {
      state(): { id: string; place: number; home: number; style: "slide" | "line"; mode: "pointer" | "keys" } | null;
      fidelity(): string[];
    };
  }
}

const engines = new WeakMap<Store, Engine>();

/** The one engine for a visit's store. */
export function engineFor(store: Store, ui: UiApi, files: FilesController): Engine {
  let e = engines.get(store);
  if (!e) {
    e = createEngine(store, ui, files);
    engines.set(store, e);
  }
  return e;
}

function createEngine(store: Store, ui: UiApi, files: FilesController) {
  let live: Live | null = null;
  let view: { set(l: Lift | null): void } | null = null;
  let lastFocus: string | null = null;
  let lastDrop = 0;
  let sensing: Sensing = null;

  const nameOf = (l: Live) => (l.draft ? l.draft.name : labelOf(l.doc, l.plan.id));
  const placesOf = (l: Live) => l.plan.rest.length + 1;
  /** The pointer in the column's coordinates. */
  const inColumn = (l: Live, p: { x: number; y: number }) => ({ x: p.x + window.scrollX - l.origin.x, y: p.y + window.scrollY - l.origin.y });

  /* ---------------- Measuring ---------------- */

  /** Where every item would sit with the carried one at a place (or, below 0, off the page). */
  function measured(l: Live, place: number): Measured {
    let m = l.seen.get(place);
    if (!m) {
      const ids = l.draft ? (place < 0 ? l.plan.rest : orderWith(l.plan.rest, l.plan.id, place)) : orderWith(l.plan.order, l.plan.id, place);
      const items = ids.map((id) => (l.draft && id === l.plan.id ? l.draft.item : l.items[id]!));
      m = measureOrder(l.host, l.f, items, l.frozen);
      l.seen.set(place, m);
    }
    return m;
  }

  /** Every page item's frame, box and drawing, as the page stands. */
  function freeze(main: HTMLElement) {
    const doc = store.get();
    const f = formatOf(doc);
    const list = pageItems(doc);
    const rows = rowsFor(list, f);
    const as: Record<string, ItemAs> = {};
    for (const r of rows) {
      const cells = r.row === "one" ? [r.cell] : r.row === "pair" ? [r.left, r.right] : r.items;
      for (const c of cells) for (const it of c.cell === "item" ? [c] : c.items) as[it.item.id] = it.as;
    }
    const o = main.getBoundingClientRect();
    const els: Record<string, HTMLElement> = {};
    const boxes: Record<string, Box> = {};
    const frozen: Frozen = {};
    for (const it of list) {
      const el = frameIn(main, it.id);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      els[it.id] = el;
      boxes[it.id] = { x: r.left - o.left, y: r.top - o.top, w: r.width, h: r.height };
      frozen[it.id] = { box: boxes[it.id]!, as: as[it.id] ?? "plain" };
    }
    const items = Object.fromEntries(list.map((it) => [it.id, it]));
    return { doc, f, list, rows, as, els, boxes, frozen, items, rect: o, origin: { x: o.left + window.scrollX, y: o.top + window.scrollY } };
  }

  /** The hidden copy the drag measures in: inside the main column, out of the flow, unseen, never read out. */
  function makeHost(main: HTMLElement, width: number): HTMLElement {
    const host = document.createElement("div");
    host.setAttribute("aria-hidden", "true");
    host.inert = true;
    host.dataset.xeMeasure = "";
    host.className = "xe-measure";
    host.style.width = `${width}px`;
    main.appendChild(host);
    return host;
  }

  /* ---------------- Drawing the place ---------------- */

  const place = (el: HTMLElement, b: Box) => {
    el.style.left = `${b.x}px`;
    el.style.top = `${b.y}px`;
    el.style.width = `${b.w}px`;
    el.style.height = `${b.h}px`;
  };

  /** Draws the place the drag is at: the slides and the room made, or the line. */
  function show() {
    const l = live;
    const o = l?.overlay;
    if (!l || !o) return;
    const { plan } = l;
    l.main.dataset.xePlace = String(l.place);
    if (l.place === NOWHERE) {
      for (const id of plan.rest) if (l.els[id]) l.els[id]!.style.transform = "";
      o.landing.hidden = true;
      o.line.hidden = true;
      return;
    }
    const at = measured(l, l.place);
    if (l.style === "slide") {
      // Where everything sits with the carried thing where it came from: its own place, or off the page for a new block.
      const base = measured(l, l.draft ? NOWHERE : plan.home);
      for (const id of plan.rest) {
        const el = l.els[id];
        if (!el || !at[id] || !base[id]) continue;
        const dx = Math.round(at[id].x - base[id].x);
        const dy = Math.round(at[id].y - base[id].y);
        el.style.transform = dx || dy ? `translate(${dx}px, ${dy}px)` : "";
      }
      const mine = at[plan.id]!;
      let land: Box;
      if (l.draft) {
        // The copy and the page share their rows; any difference between them is taken from the first item.
        const ref = plan.rest[0];
        const dx = ref && base[ref] ? plan.boxes[ref]!.x - base[ref].x : 0;
        const dy = ref && base[ref] ? plan.boxes[ref]!.y - base[ref].y : 0;
        land = { x: mine.x + dx, y: mine.y + dy, w: mine.w, h: mine.h };
      } else {
        const home = plan.boxes[plan.id]!;
        land = { x: home.x + Math.round(mine.x - base[plan.id]!.x), y: home.y + Math.round(mine.y - base[plan.id]!.y), w: mine.w, h: mine.h };
        if (l.mode === "keys") {
          const dx = land.x - home.x;
          const dy = land.y - home.y;
          l.els[plan.id]!.style.transform = dx || dy ? `translate(${dx}px, ${dy}px)` : "";
        }
      }
      o.line.hidden = true;
      if (l.mode === "pointer") {
        place(o.landing, land);
        o.landing.hidden = false;
      }
    } else {
      o.landing.hidden = true;
      const b = lineFor(plan, l.place, at);
      o.line.hidden = !b;
      if (b) place(o.line, b);
    }
  }

  /** Moves the drag to a place and says it. */
  function goTo(p: number) {
    const l = live;
    if (!l || p === l.place) return;
    l.place = p;
    show();
    const name = nameOf(l);
    if (p === NOWHERE) ui.say(`${name} isn't over the page.`);
    else if (p === l.plan.home) ui.say(`${name} is back where it was, place ${p + 1} of ${placesOf(l)}.`);
    else ui.say(`${name} would go to place ${p + 1} of ${placesOf(l)}.`);
  }

  /** Puts the lifted copy under the pointer and works out the place from where the pointer is in the column. */
  function follow() {
    const l = live;
    if (!l || l.mode !== "pointer") return;
    const { x, y } = inColumn(l, l.pointer);
    if (l.overlay?.copy) l.overlay.copy.style.transform = `translate(${Math.round(x - l.grab.x)}px, ${Math.round(y - l.grab.y)}px)`;
    if (!l.armed && Math.hypot(l.pointer.x - l.start.x, l.pointer.y - l.start.y) > 24) l.armed = true;
    // A new block has no place until it is carried off the tray and over the page.
    if (l.draft && x > l.plan.width + 8) goTo(NOWHERE);
    else goTo(placeAt(l.plan, x, y, l.place));
  }

  /** From here until the drop the page scrolling under the pointer is followed, and the page scrolls itself near the window's top and bottom fifths. */
  function watch(l: Live) {
    const onScroll = () => follow();
    window.addEventListener("scroll", onScroll, { capture: true, passive: true });
    let frame = 0;
    const edge = () => {
      if (live !== l) return;
      const zone = window.innerHeight * 0.2;
      const y = l.pointer.y;
      const pull = y < zone ? (y - zone) / zone : y > window.innerHeight - zone ? (y - (window.innerHeight - zone)) / zone : 0;
      if (pull && l.armed && l.place !== NOWHERE) window.scrollBy(0, Math.round(Math.max(-1, Math.min(1, pull)) * 16));
      frame = requestAnimationFrame(edge);
    };
    frame = requestAnimationFrame(edge);
    l.stop = () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll, true);
    };
  }

  /* ---------------- Picking up ---------------- */

  /** Freezes the page and starts carrying page item `id`. */
  function pickUp(id: string, mode: "pointer" | "keys", pointer?: { x: number; y: number }, sensor?: object): boolean {
    if (live || !view) return false;
    const main = mainColumn();
    if (!main) return false;
    const fz = freeze(main);
    const box = fz.boxes[id];
    if (!box) return false;
    // The section's toolbar, where the grip is, counts as where it is: a pointer still on the grip is at home.
    const tools = fz.els[id]?.querySelector(":scope > .xe-tools")?.getBoundingClientRect();
    const grip = tools && tools.width > 0 ? { x: tools.left - fz.rect.left, y: tools.top - fz.rect.top, w: tools.width, h: tools.height } : undefined;
    const plan = makePlan(
      id,
      fz.list.map((it) => it.id),
      fz.boxes,
      rowsInfo(fz.rows),
      fz.rect.width,
      grip,
    );
    const at = pointer ?? { x: fz.rect.left + box.x, y: fz.rect.top + box.y };
    const style = id === FLOW_ID ? FLOW_SECTION_STYLE : SECTION_STYLE;
    const l: Live = {
      plan,
      mode,
      style,
      place: plan.home,
      doc: fz.doc,
      f: fz.f,
      items: fz.items,
      frozen: fz.frozen,
      els: fz.els,
      seen: new Map(),
      main,
      origin: fz.origin,
      host: makeHost(main, fz.rect.width),
      grab: { x: at.x - fz.rect.left, y: at.y - fz.rect.top },
      pointer: at,
      start: at,
      armed: false,
      sensor,
    };
    live = l;
    if (mode === "pointer") watch(l);
    flushSync(() => view!.set({ id, mode, style, box, main, as: fz.as[id] ?? "plain" }));
    ui.say(`Picked up ${lowerFirst(labelOf(fz.doc, id))}, place ${plan.home + 1} of ${plan.order.length}.`);
    return true;
  }

  /** Starts carrying a new block from the tray: the page is frozen as for any drag, and the block has no place until it is over the page. */
  function pickUpNew(kind: BlockKind, pointer: { x: number; y: number }, tile: DOMRect, sensor: object): boolean {
    if (live || !view) return false;
    const doc = store.get();
    const option = blockOptions(doc).find((o) => o.kind === kind);
    if (!option || option.full) {
      ui.say(`${option?.full ?? "There is no room for it"}.`);
      return false;
    }
    const main = mainColumn();
    if (!main) return false;
    const fz = freeze(main);
    const id = kind === "flow" ? FLOW_ID : `xe-new-${kind}`;
    const item = draftItem(id, kind, doc.flow);
    // Its size until it is drawn: the size of another of its kind on the page, or a fair guess (DragBoard measures it as the lift begins).
    const same = fz.list.find((it) => it.kind === kind && fz.frozen[it.id]);
    fz.frozen[id] = same ? { box: { ...fz.frozen[same.id]!.box }, as: "plain" } : { box: { x: 0, y: 0, w: fz.rect.width, h: guessHeight(kind, fz.rect.width) }, as: "plain" };
    const plan = makePlan(
      id,
      fz.list.map((it) => it.id),
      fz.boxes,
      rowsInfo(fz.rows),
      fz.rect.width,
    );
    const l: Live = {
      plan,
      mode: "pointer",
      style: kind === "flow" ? FLOW_SECTION_STYLE : SECTION_STYLE,
      place: NOWHERE,
      doc: fz.doc,
      f: fz.f,
      items: fz.items,
      frozen: fz.frozen,
      els: fz.els,
      seen: new Map(),
      main,
      origin: fz.origin,
      host: makeHost(main, fz.rect.width),
      grab: { x: pointer.x - fz.rect.left, y: pointer.y - fz.rect.top },
      pointer,
      start: pointer,
      armed: true,
      draft: { kind, name: option.name, item },
      sensor,
    };
    live = l;
    watch(l);
    const box = { x: tile.left - fz.rect.left, y: tile.top - fz.rect.top, w: tile.width, h: tile.height };
    flushSync(() => view!.set({ id, mode: "pointer", style: l.style, box, main, as: "plain", draft: { kind, name: option.name } }));
    ui.say(`Picked up a new block: ${lowerFirst(option.name)}. Carry it onto the page.`);
    return true;
  }

  /** DragBoard has drawn the overlay: put it on the page, step the carried section back, and show the place. */
  function attach(o: Overlay) {
    const l = live;
    if (!l) return;
    l.overlay = o;
    // The overlay covers the whole page from its top left corner and clips what it holds, so a copy carried past the foot of the page can't lengthen it.
    // Measured where it sits in the column (a second call, as React's strict mode makes in development, starts again from there).
    o.root.style.margin = "0";
    const r = o.root.getBoundingClientRect();
    const doc = document.documentElement;
    o.root.style.marginLeft = `${-(r.left + window.scrollX)}px`;
    o.root.style.marginTop = `${-(r.top + window.scrollY)}px`;
    o.root.style.width = `${doc.clientWidth}px`;
    o.root.style.height = `${doc.scrollHeight}px`;
    o.space.style.left = `${l.origin.x}px`;
    o.space.style.top = `${l.origin.y}px`;
    if (l.draft && o.sizer) {
      // The new block as the page would draw it, at the column's width, so the room made for it is about the right size.
      const h = o.sizer.getBoundingClientRect().height;
      if (h > 0 && l.draft.kind !== "image") l.frozen[l.plan.id] = { box: { x: 0, y: 0, w: l.plan.width, h }, as: "plain" };
    }
    l.main.dataset.xeDrag = l.mode;
    l.main.dataset.xeStyle = l.style;
    const mine = l.els[l.plan.id];
    if (mine && !l.draft) {
      if (l.mode === "pointer") mine.style.opacity = l.style === "slide" ? "0" : "0.35";
      else mine.dataset.lifted = "";
    }
    if (l.style === "slide" && !reducedMotion()) {
      for (const [id, el] of Object.entries(l.els)) if (id !== l.plan.id || l.mode === "keys") el.style.transition = `transform ${MOVE_MS}ms ${EASE}`;
    }
    show();
    follow();
  }

  /* ---------------- The drop ---------------- */

  /** Where every frame is drawn now. */
  const snapshot = (main: ParentNode) => {
    const first = new Map<string, DOMRect>();
    for (const el of frames(main)) first.set(el.dataset.sectionId!, el.getBoundingClientRect());
    return first;
  };

  /** Moves every frame from where it was drawn to where it is now (FLIP): 180ms, transforms only. */
  function settle(first: Map<string, DOMRect>, lifted?: string) {
    if (reducedMotion()) return;
    const main = mainColumn();
    if (!main) return;
    for (const el of frames(main)) {
      const id = el.dataset.sectionId!;
      const a = first.get(id);
      if (!a) continue;
      for (const run of el.getAnimations()) if (run instanceof Animation && run.id === "xe-settle") run.cancel();
      const b = el.getBoundingClientRect();
      const dx = a.left - b.left;
      const dy = a.top - b.top;
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) continue;
      const anim = el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "translate(0px, 0px)" }], { duration: MOVE_MS, easing: EASE, id: "xe-settle" });
      if (id === lifted) {
        el.dataset.settling = "";
        const done = () => delete el.dataset.settling;
        anim.finished.then(done, done);
      }
    }
  }

  /** Ends the drag: drops at the place shown (a new block is added there), or puts everything back. */
  function finish(drop: boolean) {
    const l = live;
    if (!l) return;
    l.stop?.();
    sensing = null;
    const { plan, mode, draft } = l;
    const p = l.place;
    const first = snapshot(l.main);
    const copy = mode === "pointer" ? (l.overlay?.copy?.getBoundingClientRect() ?? null) : null;
    if (copy && !draft) first.set(plan.id, copy);
    for (const el of Object.values(l.els)) {
      el.style.transform = "";
      el.style.transition = "";
      el.style.opacity = "";
      delete el.dataset.lifted;
    }
    delete l.main.dataset.xeDrag;
    delete l.main.dataset.xeStyle;
    delete l.main.dataset.xePlace;
    l.host.remove();
    const name = nameOf(l);
    const places = placesOf(l);
    live = null;
    lastDrop = Date.now();
    const moved = drop && p !== plan.home && p !== NOWHERE;
    let added: string | null = null;
    flushSync(() => {
      view?.set(null);
      if (!moved) return;
      if (!draft) store.move(plan.id, p);
      else if (draft.kind !== "image") added = store.insert(draft.kind, p);
    });
    if (added && copy) first.set(added, copy);
    settle(first, draft ? (added ?? undefined) : plan.id);
    if (draft) {
      if (!moved) ui.say(`${name} was not added.`);
      else if (draft.kind === "image") {
        ui.say(`Choose the pictures to add in place ${p + 1} of ${places}.`);
        files.pick(p);
      } else if (added) {
        ui.say(`${name} added in place ${p + 1} of ${places}.`);
        afterAdd(draft.kind, added, true);
      } else ui.say(`${blockOptions(store.get()).find((o) => o.kind === draft.kind)?.full ?? "There is no room for it"}.`);
    } else if (!drop) ui.say(`Moving ${lowerFirst(name)} cancelled. It's back where it was.`);
    else ui.say(moved ? `${name} dropped in place ${p + 1} of ${places}.` : `${name} dropped where it was.`);
    if (mode === "keys") mainColumn()?.querySelector<HTMLElement>(`[data-section-id="${CSS.escape(plan.id)}"] [data-grip]`)?.focus({ preventScroll: true });
  }

  /* ---------------- The pointer: dnd-kit's sensors ---------------- */

  /** Starts listening for a pick-up from a press: the mouse after 6px, a finger after a 150ms press with 8px of give. */
  function sense(e: MouseEvent | TouchEvent, start: (at: { x: number; y: number }, sensor: object) => boolean) {
    if (live || sensing) return;
    const touch = "touches" in e;
    if (touch ? e.touches.length > 1 : (e as MouseEvent).button !== 0) return;
    const Sensor = touch ? TouchSensor : MouseSensor;
    const token = {};
    let started = false;
    const mine = () => live?.sensor === token;
    const instance = new Sensor({
      active: "xe",
      activeNode: { id: "xe", key: "xe", node: { current: null }, activatorNode: { current: null }, data: { current: {} } },
      event: e,
      context: { current: {} as never },
      options: { activationConstraint: touch ? { delay: 150, tolerance: 8 } : { distance: 6 } },
      onAbort: () => undefined,
      onPending: () => undefined,
      onStart: (c: { x: number; y: number }) => {
        started = start({ x: c.x, y: c.y }, token);
        if (!started) sensing = null;
      },
      onMove: (c: { x: number; y: number }) => {
        if (!mine()) return;
        live!.pointer = { x: c.x, y: c.y };
        follow();
      },
      onEnd: () => {
        sensing = null;
        if (mine()) finish(true);
      },
      onCancel: () => {
        sensing = null;
        if (mine()) finish(false);
      },
    } as never);
    void instance;
    sensing = { stop: () => (sensing = null) };
  }

  /* ---------------- The keyboard ---------------- */

  function onGripKey(id: string, e: ReactKeyboardEvent) {
    const l = live;
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
      const target = l.style === "slide" || l.place === l.plan.home ? l.els[id] : l.overlay?.line;
      const r = target?.getBoundingClientRect();
      if (!r) return;
      const margin = 96;
      const top = 56 + margin;
      const off = r.top < top ? r.top - top : r.bottom > window.innerHeight - margin ? Math.min(r.bottom - (window.innerHeight - margin), r.top - top) : 0;
      if (off) window.scrollBy({ top: off, behavior: reducedMotion() ? "auto" : "smooth" });
    };
    if (e.key === "ArrowDown" || e.key === "ArrowRight") step(1);
    else if (e.key === "ArrowUp" || e.key === "ArrowLeft") step(-1);
    else if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      finish(true);
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      finish(false);
    } else if (e.key === "Tab") finish(true);
  }

  function onGripBlur(id: string) {
    const l = live;
    if (l && l.mode === "keys" && l.plan.id === id) finish(false);
  }

  /* ---------------- Moving, adding and removing without a drag ---------------- */

  /** A structural change with the motion: every frame moves from where it was to its new place. */
  function withMotion(change: () => void, lifted?: string) {
    const main = mainColumn();
    const first = main ? snapshot(main) : new Map<string, DOMRect>();
    flushSync(change);
    settle(first, lifted);
  }

  /** What follows an add: a graph opens its figures sheet, a link its "Web address" popover, a text section takes the cursor. */
  function afterAdd(kind: BlockKind, id: string, focus: boolean) {
    if (kind === "graph") return ui.open("chart", id);
    if (!focus) return;
    later(() => {
      if (kind === "link") {
        const i = store.get().sections.findIndex((s) => s.id === id);
        ui.jumpTo(`sections.${i}.href`);
        return;
      }
      const frame = mainColumn() && frameIn(mainColumn()!, id);
      const field = frame?.querySelector<HTMLElement>(FIELD) ?? frame?.querySelector<HTMLElement>("[data-grip]");
      field?.focus({ preventScroll: true });
      frame?.scrollIntoView({ block: "nearest", behavior: reducedMotion() ? "auto" : "smooth" });
    });
  }

  /** Adds a block at a place, with the motion. */
  function addAt(kind: BlockKind, at: number, opts: { focus: boolean; where?: string }): string | null {
    if (kind === "image") {
      files.pick(at);
      return null;
    }
    const doc = store.get();
    const option = blockOptions(doc).find((o) => o.kind === kind);
    let id: string | null = null;
    withMotion(() => {
      id = store.insert(kind, at);
    });
    if (!id) {
      ui.say(`${option?.full ?? "There is no room for it"}.`);
      return null;
    }
    const after = pageItems(store.get());
    const p = after.findIndex((it) => it.id === id);
    ui.say(`${option?.name ?? labelOf(store.get(), id)} added${opts.where ? ` ${opts.where}` : ""}, place ${p + 1} of ${after.length}.`);
    afterAdd(kind, id, opts.focus);
    return id;
  }

  const board = {
    grip(id: string): Record<string, unknown> {
      let props = grips.get(id);
      if (!props) {
        props = {
          "aria-describedby": HOW_ID,
          onMouseDown: (e: ReactMouseEvent) => sense(e.nativeEvent, (at, token) => pickUp(id, "pointer", at, token)),
          onTouchStart: (e: ReactTouchEvent) => sense(e.nativeEvent, (at, token) => pickUp(id, "pointer", at, token)),
          onKeyDown: (e: ReactKeyboardEvent) => onGripKey(id, e),
          onBlur: () => onGripBlur(id),
        };
        grips.set(id, props);
      }
      return props;
    },

    moveBy(id: string, by: -1 | 1) {
      const items = pageItems(store.get());
      const from = items.findIndex((it) => it.id === id);
      const to = from + by;
      if (from < 0 || to < 0 || to >= items.length || live) return;
      withMotion(() => store.move(id, to), id);
      ui.say(`${labelOf(store.get(), id)} moved ${by < 0 ? "up" : "down"}, to place ${to + 1} of ${items.length}.`);
      // The focus stays on the button pressed, or goes to the other one at an end.
      const frame = mainColumn() && frameIn(mainColumn()!, id);
      const pressed = frame?.querySelector<HTMLButtonElement>(`[data-tool="${by < 0 ? "up" : "down"}"]`);
      const other = frame?.querySelector<HTMLButtonElement>(`[data-tool="${by < 0 ? "down" : "up"}"]`);
      (pressed && !pressed.disabled ? pressed : other)?.focus({ preventScroll: true });
    },

    remove(id: string) {
      if (live) return;
      const before = pageItems(store.get());
      const at = before.findIndex((it) => it.id === id);
      const label = labelOf(store.get(), id);
      withMotion(() => store.remove(id));
      ui.say(`${label} removed.`);
      if (lastFocus === id) lastFocus = null;
      // The focus goes to what took its place, or to the "+" at the end.
      const after = pageItems(store.get());
      const next = after[at] ?? after[at - 1];
      const main = mainColumn();
      const frame = next && main ? frameIn(main, next.id) : null;
      const target = frame?.querySelector<HTMLElement>("[data-grip]") ?? document.getElementById("add-section");
      target?.focus({ preventScroll: true });
    },

    add(kind: BlockKind, at: number): string | null {
      return addAt(kind, at, { focus: true });
    },

    lastFocus: () => lastFocus,
  };
  const grips = new Map<string, Record<string, unknown>>();

  return {
    board,
    /** DragBoard is up: it draws the overlay from here on. Returns the disconnect. */
    connect(v: { set(l: Lift | null): void }) {
      view = v;
      const onFocus = (e: FocusEvent) => {
        const id = (e.target as Element | null)?.closest?.("[data-section-id]")?.getAttribute("data-section-id");
        if (id) lastFocus = id;
      };
      document.addEventListener("focusin", onFocus);
      // A change to the page from elsewhere while something is carried (pictures finishing their upload, say): the frozen page is no longer true, so the drag is let go.
      const off = store.subscribe(() => {
        if (live && store.get() !== live.doc) finish(false);
      });
      const teardown = TouchSensor.setup?.();
      // Development only: what e2e/editor-drag.spec.ts reads of a drag in progress.
      if (process.env.NODE_ENV !== "production") {
        window.__exhbtDrag = {
          state: () => (live ? { id: live.plan.id, place: live.place, home: live.plan.home, style: live.style, mode: live.mode } : null),
          /** How far the hidden copy, laid out with nothing moved, is from the page as it was frozen: each box that differs by more than a pixel. */
          fidelity: () => {
            const l = live;
            if (!l) return ["nothing is being carried"];
            const at = measured(l, l.draft ? NOWHERE : l.plan.home);
            const first = l.plan.rest.find((id) => at[id] && l.plan.boxes[id]);
            if (!first) return [];
            const dx = l.plan.boxes[first]!.x - at[first]!.x;
            const dy = l.plan.boxes[first]!.y - at[first]!.y;
            const off: string[] = [];
            for (const [id, b] of Object.entries(l.plan.boxes)) {
              const m = at[id];
              if (!m) off.push(`${id} is missing`);
              else if (Math.abs(m.x + dx - b.x) > 1 || Math.abs(m.y + dy - b.y) > 1 || Math.abs(m.w - b.w) > 1 || Math.abs(m.h - b.h) > 1)
                off.push(`${id} ${[b.x, b.y, b.w, b.h].map((v) => v.toFixed(1)).join(",")} is ${[m.x + dx, m.y + dy, m.w, m.h].map((v) => v.toFixed(1)).join(",")}`);
            }
            return off;
          },
        };
      }
      return () => {
        if (live) finish(false);
        view = null;
        off();
        teardown?.();
        document.removeEventListener("focusin", onFocus);
      };
    },
    attach,
    /** The tray's own press: a new block. */
    senseNew(kind: BlockKind, e: MouseEvent | TouchEvent, tile: HTMLElement) {
      sense(e, (at, token) => pickUpNew(kind, at, tile.getBoundingClientRect(), token));
    },
    /** A tray block pressed (Enter, Space or a click): added after the section the focus was last in, or at the end. The focus stays on the tray. */
    addFromTray(kind: BlockKind): string | null {
      // A click that only ends a drag isn't a press of the button.
      if (Date.now() - lastDrop < 300) return null;
      const doc = store.get();
      const option = blockOptions(doc).find((o) => o.kind === kind);
      if (!option || option.full) {
        ui.say(`${option?.full ?? "There is no room for it"}.`);
        return null;
      }
      const items = pageItems(doc);
      const last = lastFocus ? items.findIndex((it) => it.id === lastFocus) : -1;
      const at = last >= 0 ? last + 1 : items.length;
      const where = last >= 0 ? `after ${lowerFirst(labelOf(doc, lastFocus!))}` : "at the end";
      if (kind === "image") {
        ui.say(`Choose the pictures to add ${where}.`);
        files.pick(at);
        return null;
      }
      return addAt(kind, at, { focus: false, where });
    },
    /** Whether something is being carried now. */
    lifting: () => live !== null,
  };
}

/** A fair guess at a new block's height before it is drawn, at a column's width. */
function guessHeight(kind: BlockKind, width: number): number {
  const rem = 16;
  switch (kind) {
    case "image":
      return width * 0.75 + 2 * rem;
    case "graph":
      return 18 * rem;
    case "flow":
      return 8 * rem;
    case "findings":
      return 12 * rem;
    case "pullquote":
      return 7 * rem;
    default:
      return 6 * rem;
  }
}
