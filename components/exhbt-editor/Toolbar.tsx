"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Ellipsis, GripVertical, Star, Trash2 } from "lucide-react";
import { FORMAT_RULES, formatOf, type Format } from "@/lib/exhbt/formats";
import { pageItems } from "@/lib/exhbt/layouts";
import type { ExhbtDoc } from "@/lib/exhbt/blocks";
import type { ItemAs } from "@/lib/exhbt/layouts";
import { useBoard } from "./drag";
import { mainColumn } from "./drag/engine";
import { MoreActions } from "./draft-tools";
import { useFrame } from "./Frame";
import { labelOf } from "./labels";
import { useDoc, useStoreInternal } from "./store";
import type { Store } from "./store-core";

/*
 * A section's toolbar (decision 0026, "The chrome"): at its top corner, out of the flow, so it takes no
 * room. The grip (the only thing that drags), move up, move down, the layout's own action where there
 * is one, "More actions" where the AI drafted the part, and Remove (on every section in every layout,
 * the flowchart too: decision 0032). With a mouse it shows on hover and on focus within; on a
 * touch screen wider than 48rem it is always shown, at 44px (one over its own section shows its grip
 * until the section is touched or has the focus); on a phone only the grip shows (css/phone.css). Each
 * button has a tooltip. The buttons carry data-grip or data-tool, so other parts' CSS and tests can
 * find them.
 *
 * Where it sits (`placeTools`, css/core.css): never over any words, its own section's included, nor
 * over another section or a chip. Tried in this order: a row above the section's top right corner, in
 * the gap over it; a row half over its top edge (a little lower where the gap is short of half of it,
 * a little to the right where the section's own chips reach the corner); a column in the gutter to its
 * right, from the corner down (between a pair's columns); that column half over its right edge; and the
 * compact pair, the grip and "More actions", half over its top edge, with Move up, Move down, the
 * layout's action and Remove in that menu. Only a picture's sits inside its own corner, over the
 * picture, as in the prototype Rory tried; where a tile is too narrow for the row, one column down its
 * right edge, going on at the foot of a second where the picture is too short. In a row it is drawn
 * Remove first and the grip last, and a column runs down from the grip, so the grip is at the
 * section's corner wherever it sits (the markup keeps the grip first: it is the first Tab stop).
 */

type Box = { x: number; y: number; w: number; h: number };

/** Where `el` is drawn on the page (placeTools never runs while anything moves by transform). */
function pageBox(el: Element): Box {
  const r = el.getBoundingClientRect();
  return { x: r.left + window.scrollX, y: r.top + window.scrollY, w: r.width, h: r.height };
}

/** Where the words in `el` are drawn, on the page; null when it has none. */
function wordsBox(el: HTMLElement): Box | null {
  const range = document.createRange();
  range.selectNodeContents(el);
  const rects = [...range.getClientRects()].filter((r) => r.width > 0 && r.height > 0);
  if (!rects.length) return null;
  const x = Math.min(...rects.map((r) => r.left));
  const y = Math.min(...rects.map((r) => r.top));
  return { x: x + window.scrollX, y: y + window.scrollY, w: Math.max(...rects.map((r) => r.right)) - x, h: Math.max(...rects.map((r) => r.bottom)) - y };
}

const overlap = (a: Box, b: Box) => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 0.5 && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 0.5;

/**
 * A section's own words (a graph's title, legend, labels and values among them), where they are drawn: its toolbar never lies
 * over them. Word by word: a space at the end of a wrapped line hangs past the edge of its box (the fields keep their spaces),
 * and is no word; with other fonts it reached into the gutter beside a section (the runner's, 23 Nov).
 */
function ownWords(frame: HTMLElement): Box[] {
  const out: Box[] = [];
  const walker = document.createTreeWalker(frame, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  for (let t = walker.nextNode(); t; t = walker.nextNode()) {
    const text = t.textContent ?? "";
    if (!text.trim() || t.parentElement?.closest(".xe-tools, .sr-only, [hidden], [data-edit-only]")) continue;
    for (const word of text.matchAll(/\S+/g)) {
      range.setStart(t, word.index);
      range.setEnd(t, word.index + word[0].length);
      for (const r of range.getClientRects()) if (r.width > 0 && r.height > 0) out.push({ x: r.left + window.scrollX, y: r.top + window.scrollY, w: r.width, h: r.height });
    }
  }
  // A text box keeps its words out of the page's text (a flowchart box's step, a link's description).
  for (const el of frame.querySelectorAll<HTMLTextAreaElement | HTMLInputElement>(TEXT_BOXES)) {
    if (el.closest(".xe-tools, [hidden], [data-edit-only]") || !el.getClientRects().length) continue;
    const b = boxWords(el);
    if (b) out.push(b);
  }
  return out;
}

const TEXT_BOXES = 'textarea, input:not([type="checkbox"], [type="radio"], [type="hidden"], [type="file"])';
let pen: CanvasRenderingContext2D | null = null;
/** Where a text box's words are: on one line, as wide as they are (its placeholder's where it is empty); on more, the whole box. */
function boxWords(el: HTMLTextAreaElement | HTMLInputElement): Box | null {
  const text = (el.value || el.placeholder).trimEnd();
  if (!text.trim()) return null;
  const s = getComputedStyle(el);
  const b = pageBox(el);
  const px = (v: string) => parseFloat(v) || 0;
  const line = px(s.lineHeight) || px(s.fontSize) * 1.2;
  if (el.clientHeight - px(s.paddingTop) - px(s.paddingBottom) > line * 1.5) return b;
  pen ??= document.createElement("canvas").getContext("2d");
  if (!pen) return b;
  pen.font = `${s.fontStyle} ${s.fontWeight} ${s.fontSize} ${s.fontFamily}`;
  const inner = el.clientWidth - px(s.paddingLeft) - px(s.paddingRight);
  const w = Math.min(pen.measureText(text).width + px(s.letterSpacing) * text.length, inner);
  const x = px(s.paddingLeft) + (s.textAlign === "center" ? (inner - w) / 2 : s.textAlign === "right" || s.textAlign === "end" ? inner - w : 0);
  return { x: b.x + x, y: b.y, w, h: b.h };
}

const OUT_OF_PAGE = ".xe-insert, .xe-measure, .xe-drag-overlay, [data-edit-only]";
/**
 * Edit-only chips and labels that may reach out of their section. A flowchart box's grip and Remove are among them: in a
 * row they hang half under its foot, into the gap where the next section's toolbar goes (Build, Essay and Before and after
 * each pair their findings under a three-box flowchart, so the middle box's chips sat under that toolbar). With a mouse
 * they show only on their box, but a toolbar over them would take the press meant for them.
 */
const CHIPS = ".xe-fig-chip, .xe-fig-picked, .xe-chip, .xe-above, .xe-flow-chip";
/** Kinds whose toolbar is always inside the corner (css/core.css): a picture, which has no words there. */
const INSIDE_KINDS = new Set(["image"]);
/** The gap between a toolbar's buttons (css/core.css). */
const GAP = 4;
/** How far a toolbar on the top edge may go to the right of the corner to keep clear (css/core.css reads --xe-tools-dx and -dy). */
const SLIDE_X = [0, 4, 8];
/** Where a toolbar sits, for css/core.css; above the corner is no attribute. */
type Place = "edge" | "side" | "rcol" | "compact" | null;
/** The width a button was last drawn at: a tablet hides some until the section is touched, and the compact form most. */
const drawnWidth = new WeakMap<HTMLElement, number>();

/**
 * The shape of a picture's toolbar, inside its corner (design round 2, item 6): a row, from the grip in
 * the corner, where the part is wide enough; else one column down the part's right edge from the grip
 * (grip, move up, move down, the action, more, remove); and only where the picture is too short for
 * that, the column goes on in another to its left, at its foot (css/core.css), so Remove is still the
 * button farthest from the grip. Returns the writes, so all the reads come first.
 */
function shapeOf(tools: HTMLElement, frame: HTMLElement, f: Box, kids: HTMLElement[], unit: number, width: number): () => void {
  const s = getComputedStyle(tools);
  const right = parseFloat(s.right) || 0;
  const top = parseFloat(s.top) || 0;
  // What it may cover: a picture's own picture, never its caption or description; any other part's own box.
  const room = frame.dataset.kind === "image" ? (frame.querySelector("img") ?? frame) : frame;
  const r = pageBox(room);
  const across = f.w - right - 8;
  const down = r.y + r.h - (f.y + top) - 8;
  const n = kids.length;
  const wide = Math.max(unit, ...kids.map((c) => (c.getClientRects().length > 0 ? c.offsetWidth : unit)));
  const each = Math.max(1, Math.floor((down + GAP) / (unit + GAP)));
  const shape = width <= across + 0.5 ? null : n * unit + (n - 1) * GAP <= down + 0.5 && wide <= across + 0.5 ? "column" : "wrap";
  const columns = Math.ceil(n / each);
  // Read above, written here: every toolbar's reads come before any of these writes.
  return () => {
    attr(tools, "data-shape", shape);
    attr(tools, "aria-orientation", shape ? "vertical" : null);
    prop(tools, "--xe-tools-h", shape === "wrap" ? `${each * unit + (each - 1) * GAP}px` : null);
    prop(tools, "--xe-tools-w", shape === "wrap" ? `${columns * wide + (columns - 1) * GAP}px` : null);
  };
}
/** Toolbars on the page, for `placeTools`. */
const toolbars = new Set<HTMLElement>();
const watched = new WeakSet<Element>();
let sizes: ResizeObserver | null = null;
let fontsWatched = false;
let queued = 0;

/**
 * Every toolbar but a picture's, in the first of its places (see the top of this file) where it lies
 * over no other section, none of the words over the first row (the skills, the title, the context
 * line), no chip and none of its own section's words: data-place, and on the top edge how far it moved
 * along (--xe-tools-dx, -dy). Where even the compact pair would cover something, it is still the pair:
 * only a picture's goes inside. Written straight to the toolbar, so nothing draws again; it changes
 * only when the page's rows or width do, or typing brings words under a toolbar (`recheck`).
 */
function placeTools() {
  queued = 0;
  const main = mainColumn();
  if (!main) return;
  if (!watched.has(main)) {
    watched.add(main);
    sizes ??= new ResizeObserver(() => queuePlace());
    sizes.observe(main);
  }
  // The words move when the page's fonts arrive (the first lines are drawn in a fallback until then): placed again each time.
  if (!fontsWatched) {
    fontsWatched = true;
    document.fonts.addEventListener("loadingdone", () => queuePlace());
    void document.fonts.ready.then(() => queuePlace());
  }
  counts.placed++;
  // While something is carried, or a drop or a move settles, the page is drawn by transforms: wait for it (a drop draws the toolbars again).
  if (main.hasAttribute("data-xe-drag")) return;
  const moving = main.getAnimations({ subtree: true }).filter((a) => a.id === "xe-settle" && a.playState === "running");
  if (moving.length) {
    void Promise.allSettled(moving.map((a) => a.finished)).then(queuePlace);
    return;
  }
  // What a toolbar above a section must not lie over: every other section; whatever the page draws
  // between them that is no section's (the skills, the title and the context line over the first row,
  // research's "References" over its lines); and the chips that reach out of a section ("Edit figures"
  // on a graph's foot, "Web address" on the rule between reference lines, a picked figure's label).
  const boxes = new Map<HTMLElement, Box>();
  const collect = (el: Element) => {
    for (const c of el.children) {
      if (!(c instanceof HTMLElement) || c.matches(OUT_OF_PAGE)) continue;
      if (c.matches("[data-section-id]")) for (const o of [c, ...c.querySelectorAll<HTMLElement>(CHIPS)]) boxes.set(o, pageBox(o));
      else if (c.querySelector("[data-section-id]")) collect(c);
      else {
        // The person's own words (a field) count by their whole box, however short the line; a label the layout draws ("References") by its words alone.
        const b = c.matches("[data-path]") || c.querySelector("[data-path]") ? pageBox(c) : wordsBox(c);
        if (b) boxes.set(c, b);
      }
    }
  };
  collect(main);
  const page = pageBox(main);
  // The gap a toolbar above needs: its buttons, and on a mouse the strip under them that keeps the pointer on the section.
  const bridge = window.matchMedia("(pointer: coarse)").matches ? 0 : 6;
  // First every read, then every write: a pass reads the page's layout once, and one that changes nothing invalidates nothing.
  type Plan = { tools: HTMLElement; frame: HTMLElement; f: Box; kids: HTMLElement[]; unit: number; width: number; place: Place; dx: number; dy: number };
  const plans: Plan[] = [];
  for (const tools of toolbars) {
    const frame = tools.parentElement;
    if (!frame || !tools.isConnected || !main.contains(tools)) continue;
    // An open "More actions" keeps its place until it closes.
    if (tools.hasAttribute("data-open")) continue;
    // Its buttons ("More actions" of the compact form stands in for them), each at the width it was last drawn, the grip's
    // where it never was, so where it goes doesn't change as a tablet or the compact form shows and hides them. A button is
    // the grip's size ("More actions" for an AI draft wraps its button in parts that may be taller).
    const grip = tools.querySelector<HTMLElement>("[data-grip]");
    const unit = grip?.offsetWidth ?? 0;
    const buttons = grip?.offsetHeight ?? 0;
    const kids = [...tools.children].filter((c): c is HTMLElement => c instanceof HTMLElement && !c.hidden && c.dataset.tool !== "menu");
    const widths = kids.map((c) => {
      if (c.getClientRects().length > 0) drawnWidth.set(c, c.offsetWidth);
      return drawnWidth.get(c) ?? unit;
    });
    const width = widths.reduce((w, x) => w + x, 0) + GAP * Math.max(0, kids.length - 1);
    const f = boxes.get(frame) ?? pageBox(frame);
    const plan: Plan = { tools, frame, f, kids, unit, width, place: null, dx: 0, dy: 0 };
    plans.push(plan);
    // A picture's is always inside its corner (css/core.css).
    if (INSIDE_KINDS.has(frame.dataset.kind ?? "")) continue;
    // What it must not lie over: every other section and the page's own words and chips (`boxes`), and its own section's words.
    // Those are looked for on and just round the section: a large face set close (an essay's pull quote) draws its first line a
    // pixel or two above its box, where a row above the corner on a touch screen, with no strip under it, met it.
    let own: Box[] | null = null;
    const round = { x: f.x - 8, y: f.y - 8, w: f.w + 16, h: f.h + 16 };
    /** `b` lies over nothing it must not; `drawn`, the buttons themselves (not the strip under a row above), over none of its own words. */
    const clear = (b: Box, drawn = b) =>
      ![...boxes].some(([el, o]) => el !== frame && o.w > 0 && o.h > 0 && overlap(b, o)) && !(overlap(drawn, round) && (own ??= ownWords(frame)).some((o) => overlap(drawn, o)));
    // 1. A row above the corner.
    if (clear({ x: f.x + f.w - width, y: f.y - buttons - bridge, w: width, h: buttons + bridge }, { x: f.x + f.w - width, y: f.y - buttons - bridge, w: width, h: buttons })) continue;
    // 2. A row half over the top edge; a little lower where the gap above is short of half of it, a little to the right where its
    // own chips reach the corner (the aim's switch), never inside. A flowchart's keeps clear of its first box's grip, on that box's corner.
    const right = frame.dataset.kind === "flow" ? 32 : 0;
    const onEdge = (w: number, lowest: number) => {
      for (let dy = 0; dy <= lowest; dy += 4) {
        for (const dx of SLIDE_X) if (clear({ x: f.x + f.w - right - w + dx, y: f.y - buttons / 2 + dy, w, h: buttons })) return { dx, dy };
      }
      return null;
    };
    const edge = onEdge(width, buttons / 2 - 6);
    if (edge) {
      Object.assign(plan, { place: "edge", ...edge });
      continue;
    }
    // 3. A column in the gutter to its right, from the corner down: grip, move up, move down, the action, more, remove. Only in a
    // gutter on the page (between a pair's columns), touching the section, so the pointer never leaves it on the way.
    const tall = kids.length * buttons + GAP * Math.max(0, kids.length - 1);
    const wide = Math.max(unit, ...widths);
    const side = { x: f.x + f.w, y: f.y, w: wide, h: tall };
    if (side.x + side.w <= page.x + page.w + 0.5 && clear(side)) {
      plan.place = "side";
      continue;
    }
    // 4. That column half over its right edge.
    const rcol = { x: f.x + f.w - wide / 2, y: f.y, w: wide, h: tall };
    if (rcol.x + rcol.w <= page.x + page.w + 0.5 && clear(rcol)) {
      plan.place = "rcol";
      continue;
    }
    // 5. The compact pair, the grip and "More actions", half over the top edge; the rest are in that menu. Where another section's
    // chip sits on that edge at the corner (a reference line's "Web address", on the rule over the next line), just under it,
    // still over none of the section's words.
    Object.assign(plan, { place: "compact", ...(onEdge(2 * unit + GAP, buttons + 16) ?? {}) });
  }
  for (const p of plans) {
    attr(p.tools, "data-place", p.place);
    attr(p.tools, "aria-orientation", p.place === "side" || p.place === "rcol" ? "vertical" : null);
    prop(p.tools, "--xe-tools-dx", p.dx ? `${p.dx}px` : null);
    prop(p.tools, "--xe-tools-dy", p.dy ? `${p.dy}px` : null);
  }
  // A picture's toolbar takes its shape from where it is now drawn (one more read of the page for them all).
  const pictures = plans.filter((p) => INSIDE_KINDS.has(p.frame.dataset.kind ?? ""));
  const shapes = pictures.map((p) => shapeOf(p.tools, p.frame, p.f, p.kids, p.unit, p.width));
  for (const write of shapes) write();
  for (const p of plans) {
    if (pictures.includes(p)) continue;
    attr(p.tools, "data-shape", null);
    prop(p.tools, "--xe-tools-w", null);
    prop(p.tools, "--xe-tools-h", null);
  }
  placePluses(main, bridge === 0);
}

/** Development only: how often the toolbars were placed, and a section's words checked against its toolbar (e2e/editor-drag.spec.ts). */
const counts = { placed: 0, checked: 0 };
if (process.env.NODE_ENV !== "production" && typeof window !== "undefined") (window as Window & { __exhbtPlace?: typeof counts }).__exhbtPlace = counts;

/**
 * A section's words changed, by any route (typing, Undo, an AI rewrite or "Back to the AI version", a
 * sheet): where its toolbar lies over the section (on its top edge or its right edge) and the words now
 * reach under it, every toolbar is placed again, before the next paint. Once a frame, however many
 * changes came in it; only the changed sections are read, and nothing draws again. A change that did
 * not come from the keyboard is checked once more a frame later: what the page draws for it (a rich
 * field's words put back by Undo) may land after that first frame.
 */
const pending = new Map<HTMLElement, number>();
function recheckSoon(tools: HTMLElement, typed: boolean) {
  if (!["edge", "rcol", "compact"].includes(tools.dataset.place ?? "")) return;
  const frames = typed ? 1 : 2;
  if ((pending.get(tools) ?? 0) >= frames) return;
  const first = pending.size === 0;
  pending.set(tools, frames);
  if (first) requestAnimationFrame(recheckPending);
}
function recheckPending() {
  let again = false;
  for (const [tools, frames] of pending) {
    const frame = tools.parentElement;
    if (frame?.isConnected && tools.isConnected) {
      counts.checked++;
      const words = ownWords(frame);
      const under = [...tools.children].filter((c) => c.getClientRects().length > 0).map(pageBox);
      if (under.some((b) => words.some((w) => overlap(b, w)))) {
        pending.delete(tools);
        queuePlace();
        continue;
      }
    }
    if (frames > 1) {
      pending.set(tools, frames - 1);
      again = true;
    } else pending.delete(tools);
  }
  if (again) requestAnimationFrame(recheckPending);
}

/** Where a flowchart box's chip, or another control, sits by the "+" in a gap (its own box, the press round it included). */
/** What a "+" keeps clear of in its gap: a flowchart box's chips (under a finger, always shown), other chips, and the sections' toolbars. */
const BY_PLUS = ".xe-flow-chip, .xe-chip, .xe-above, .xe-fig-chip, .xe-tools > *";

/**
 * The "+" in each gap (Insert.tsx; drawn by drag.css): where the gap can't hold the full one (36px
 * deep with a mouse, 44px under a finger), the small one in the top 32px of the gap, on every pointer
 * and at every width (design round 2, item 4: research's first gap on a tablet). Where the "+" would
 * meet a control in its gap, it moves along, clear of it (and, under a finger, of its press): a case
 * study's first flowchart box has its Remove on its top left corner, just under the gap; a section on
 * the left of a pair has its grip at its corner, by the middle of the gap.
 */
function placePluses(main: HTMLElement, coarse: boolean) {
  // The one after the last row too: a last section's "Web address" hangs into the page's foot, where it sits (Build's demo and code).
  const inserts = [...main.querySelectorAll<HTMLElement>(":scope > .xe-insert")];
  // Each control as a finger finds it: a flowchart chip's press reaches 16px along its box's edge (flow.css); the others, their own box.
  // With a mouse a flowchart's chips show only while the pointer is on their box, which is never in a gap.
  const controls = [...main.querySelectorAll<HTMLElement>(BY_PLUS)]
    .filter((c) => !c.closest(".xe-measure, .xe-drag-overlay") && c.getClientRects().length > 0 && (coarse || !c.matches(".xe-flow-chip")))
    .map((c) => {
      const b = pageBox(c);
      if (!coarse) return b;
      const r = c.matches(".xe-flow-chip") ? 16 : 0;
      if (r) return { x: b.x - r, y: b.y - r, w: b.w + 2 * r, h: b.h + 2 * r };
      // A chip's press under a finger: 44px tall and 4px past each end, about its middle (figures.css). Build's last link has its
      // "Web address" in the gap after the last row, and its press took 3px of the "+" there.
      if (c.matches(".xe-fig-chip")) {
        const w = Math.max(b.w + 8, 44);
        return { x: b.x + b.w / 2 - w / 2, y: b.y + b.h / 2 - 22, w, h: 44 };
      }
      return b;
    });
  const writes = inserts.map((insert) => {
    const at = pageBox(insert);
    const next = insert.nextElementSibling;
    const gap = next ? pageBox(next).y - at.y : Infinity;
    const small = gap < (coarse ? 44 : 36);
    // The "+" as drawn: under a finger at the left of its gap, 44px or 32px with 6px of press round it; with a mouse 28px, in its middle.
    const size = coarse ? (small ? 32 : 44) : 28;
    const reach = coarse && small ? 6 : 0;
    const left = coarse ? at.x : at.x + at.w / 2 - size / 2;
    const plus = { x: left - reach, y: at.y + (small ? 16 : 22) - size / 2 - reach, w: size + 2 * reach, h: size + 2 * reach };
    // Past the controls it meets, and again past any it meets there: two links side by side in a narrow column (Build at 700px)
    // put the second one's toolbar just past the first's. Each step goes further right, so it ends.
    let shift = 0;
    for (let hit = controls.filter((c) => overlap(plus, c)); hit.length; hit = controls.filter((c) => overlap({ ...plus, x: plus.x + shift }, c))) {
      shift = Math.ceil(Math.max(...hit.map((c) => c.x + c.w)) + reach + (coarse ? 0 : 4) - left);
    }
    return () => {
      attr(insert, "data-small", small ? "" : null);
      prop(insert, "--xe-plus-shift", shift ? `${shift}px` : null);
    };
  });
  for (const write of writes) write();
}

/** Writes an attribute only when it changes, so a pass that changes nothing invalidates no style. */
function attr(el: HTMLElement, name: string, value: string | null) {
  if (el.getAttribute(name) === value) return;
  if (value === null) el.removeAttribute(name);
  else el.setAttribute(name, value);
}
/** The same for a custom property in the element's own style. */
function prop(el: HTMLElement, name: string, value: string | null) {
  if ((el.style.getPropertyValue(name) || null) === value) return;
  if (value === null) el.style.removeProperty(name);
  else el.style.setProperty(name, value);
}

/** Places the toolbars before the next paint. */
function queuePlace() {
  if (!queued) queued = requestAnimationFrame(placeTools);
}

/** Registers the toolbar for `placeTools`, and places them all again whenever one draws (a section moved, came or went). */
function usePlace(ref: React.RefObject<HTMLDivElement | null>) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    toolbars.add(el);
    return () => {
      toolbars.delete(el);
      queuePlace();
    };
  }, [ref]);
  useLayoutEffect(queuePlace);
}

/** One of the layout's own actions for a page item, as the toolbar draws it and the phone's bar (L's PhoneBar.tsx) does. */
export type LayoutAction = { name: string; tool: "action"; pressed?: boolean; run(): void; icon?: React.ReactNode };

/**
 * The layout's own actions for page item `id` (of `kind`) in layout `f`: "Make lead image" or "Make
 * key figure" while it is not the one, or Before and After on a before-and-after picture; none for
 * anything else. `as`, how the page draws the item, says whether it is the lead or key figure already
 * (the toolbar has it from its frame); without it the page's order says, worked out from `d`.
 */
export function actionsFor(d: ExhbtDoc, id: string, kind: string, f: Format, store: Store, as?: ItemAs): LayoutAction[] {
  const first = FORMAT_RULES[f].first;
  const leads = (it: { kind: string }) => (first?.kinds as readonly string[] | undefined)?.includes(it.kind) ?? false;
  if (first && leads({ kind })) {
    const already = as !== undefined ? as === first.as : pageItems(d).find(leads)?.id === id;
    if (already) return [];
    // The lead's place is read when the button is pressed: working out the page's items for every toolbar each time it draws (every frame's, at a drop) costs more than the press.
    const lead = () => pageItems(store.get()).findIndex(leads);
    return [{ name: first.as === "lead" ? "Make lead image" : "Make key figure", tool: "action", icon: <Star aria-hidden size={15} strokeWidth={2.25} />, run: () => store.move(id, Math.max(0, lead())) }];
  }
  if (f === "before-after" && kind === "image") {
    const s = d.sections.find((x) => x.id === id);
    const stage = s?.kind === "image" ? s.stage : undefined;
    const label = labelOf(d, id).toLowerCase();
    return (["before", "after"] as const).map((v) => ({
      name: v === "before" ? "Before" : "After",
      tool: "action",
      pressed: stage === v,
      run: () => store.patch(id, (x) => (x.kind === "image" ? (x.stage === v ? (({ stage: _s, ...rest }) => (void _s, rest))(x) : { ...x, stage: v }) : x), `${v} on ${label}`),
    }));
  }
  return [];
}

function Tool({ name, tool, onClick, disabled, pressed, children }: { name: string; tool: string; onClick(): void; disabled?: boolean; pressed?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" className="xe-tool" data-tool={tool} aria-label={name} data-tip={name} aria-pressed={pressed} disabled={disabled} onClick={onClick}>
      {children}
      {/* Its name in words, shown in the compact form's "More actions" (css/core.css). */}
      <span className="xe-tool-name">{name}</span>
    </button>
  );
}

const MOVES = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"]);

/**
 * Roving focus for a toolbar (the WAI-ARIA toolbar pattern; the review's accessibility-6), here and on
 * the phone's bar: the toolbar is one Tab stop, the left and right arrows move along its buttons in
 * the order they are drawn (row by row, left to right), the up and down arrows too where it is drawn as
 * a column (aria-orientation) or its "More actions" is open, and Home and End go to its ends. The stop is the button last in focus while the focus is in the toolbar,
 * and its first button (a section's grip) once the focus leaves, so a hidden or disabled button never
 * holds it. A menu the toolbar opens ("More actions") keeps its own buttons. While anything is carried
 * the keys are the drag's: the grip's arrows move a section only while it is carried, and move along
 * the toolbar only while nothing is. Written straight to the buttons' tabindex: nothing draws again.
 */
export function useRoving(ref: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const bar = ref.current;
    if (!bar) return;
    let current: HTMLElement | null = null;
    const all = () => {
      const menus = [...bar.querySelectorAll("[aria-controls]")].map((t) => document.getElementById(t.getAttribute("aria-controls") ?? ""));
      return [...bar.querySelectorAll<HTMLElement>("button")].filter((b) => !b.closest("form") && !menus.some((m) => m?.contains(b)));
    };
    const enabled = (b: HTMLElement) => !(b as HTMLButtonElement).disabled;
    /** The buttons that can take the focus, in the order they are drawn: row by row, left to right. Read only on a key press. */
    const drawn = () =>
      all()
        .filter((b) => enabled(b) && b.getClientRects().length > 0)
        .map((b) => ({ b, r: b.getBoundingClientRect() }))
        .sort((p, q) => (Math.abs(p.r.top - q.r.top) > 4 ? p.r.top - q.r.top : p.r.left - q.r.left))
        .map(({ b }) => b);
    // The stop is the button in focus (so drawn), or the first that isn't off: the grip, which is never hidden or off. So this
    // reads no layout: it runs whenever a button comes, goes or turns off, at a drop for every toolbar on the page.
    const sync = () => {
      const list = all();
      const stop = current && list.includes(current) && enabled(current) ? current : (list.find(enabled) ?? null);
      for (const b of list) {
        const want = b === stop ? 0 : -1;
        if (b.tabIndex !== want) b.tabIndex = want;
      }
    };
    const onFocusIn = (e: FocusEvent) => {
      if (!all().includes(e.target as HTMLElement)) return;
      current = e.target as HTMLElement;
      sync();
    };
    const onFocusOut = (e: FocusEvent) => {
      if (bar.contains(e.relatedTarget as Node | null)) return;
      current = null;
      sync();
    };
    const onKey = (e: KeyboardEvent) => {
      if (!MOVES.has(e.key) || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || document.querySelector("[data-xe-drag]")) return;
      if ((e.key === "ArrowUp" || e.key === "ArrowDown") && bar.getAttribute("aria-orientation") !== "vertical" && !bar.hasAttribute("data-open")) return;
      const list = drawn();
      const at = list.indexOf(e.target as HTMLElement);
      if (at < 0) return;
      e.preventDefault();
      const next = e.key === "ArrowRight" || e.key === "ArrowDown";
      const to = next ? list[at + 1] : e.key === "ArrowLeft" || e.key === "ArrowUp" ? list[at - 1] : e.key === "Home" ? list[0] : list[list.length - 1];
      to?.focus();
    };
    // Buttons come and go (an action, More actions, the phone's bar following another part), and Move up or down turns off at an end.
    const changes = new MutationObserver(sync);
    changes.observe(bar, { subtree: true, childList: true, attributes: true, attributeFilter: ["disabled", "hidden"] });
    bar.addEventListener("focusin", onFocusIn);
    bar.addEventListener("focusout", onFocusOut);
    bar.addEventListener("keydown", onKey);
    sync();
    return () => {
      changes.disconnect();
      bar.removeEventListener("focusin", onFocusIn);
      bar.removeEventListener("focusout", onFocusOut);
      bar.removeEventListener("keydown", onKey);
    };
  }, [ref]);
}

/** Whether an AI draft's rewrite form is open in toolbar `bar` (BlockTools, in its "More actions"). */
const rewriteOpenIn = (bar: HTMLElement | null) => Boolean(bar?.querySelector('[data-tool="more"] form'));

export function Toolbar() {
  const frame = useFrame();
  const store = useStoreInternal();
  const board = useBoard();
  const id = frame?.id ?? "";
  const label = useDoc((d) => labelOf(d, id));
  const f = useDoc((d) => formatOf(d));
  // The layout's action depends on the page's order; read when the frame draws (it draws on every structural change).
  const actions = frame ? actionsFor(store.get(), id, frame.kind, f, store, frame.as) : [];
  const ref = useRef<HTMLDivElement>(null);
  const menu = useRef<HTMLButtonElement>(null);
  // The compact form's "More actions" (css/core.css: data-place="compact"): open, it shows the toolbar's other buttons under the
  // pair, by name, and its first takes the focus; Escape, the focus going to something else, a press outside it, or one of them
  // pressed closes it. While an AI draft's rewrite form is open in it, neither the focus going elsewhere nor a press outside does.
  const [open, setOpen] = useState(false);
  const openNow = useRef(open);
  useEffect(() => {
    openNow.current = open;
  }, [open]);
  usePlace(ref);
  useRoving(ref);
  useEffect(() => {
    if (!open) return;
    const items = [...(ref.current?.querySelectorAll<HTMLButtonElement>("button") ?? [])];
    items.find((b) => b !== menu.current && !b.hasAttribute("data-grip") && !b.disabled && b.getClientRects().length > 0)?.focus();
    // A press anywhere else closes it (the focus leaving to nowhere does not: an AI draft's own menu, inside it, hides the button
    // that had the focus when it opens its rewrite form). Not while that form is open in it, which stays until it is cancelled
    // or used, so a note typed in it is not lost (BlockTools).
    const away = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node) && !rewriteOpenIn(ref.current)) setOpen(false);
    };
    document.addEventListener("pointerdown", away, true);
    return () => document.removeEventListener("pointerdown", away, true);
  }, [open]);
  // Its section's words changed (typed, or by Undo, an AI rewrite, "Back to the AI version" or a sheet): they may now run under it.
  // Nothing draws again; only this section is read, once a frame, and only where it lies over its section (`recheckSoon`).
  const kind = frame?.kind;
  useEffect(() => {
    if (!id) return;
    const words = (d: ExhbtDoc) => (kind === "flow" ? d.flow : d.sections.find((s) => s.id === id));
    let was = words(store.get());
    return store.subscribe(() => {
      const now = words(store.get());
      if (now === was) return;
      const before = was;
      was = now;
      const tools = ref.current;
      if (!tools) return;
      recheckSoon(tools, Boolean(tools.parentElement?.contains(document.activeElement)));
      // An action from the open menu changed the section's words (an AI draft's rewrite or "Back to the AI version" among them):
      // it closes. Not for the same words in a new object (a save that hands the doc back).
      if (openNow.current && JSON.stringify(now) !== JSON.stringify(before)) {
        setOpen(false);
        if (!document.activeElement || document.activeElement === document.body || tools.contains(document.activeElement)) requestAnimationFrame(() => menu.current?.focus());
      }
    });
  }, [store, id, kind]);
  if (!frame) return null;
  const { place, count } = frame;
  const block = kind === "flow" ? "flow" : kind === "findings" ? "findings" : null;
  return (
    <div
      ref={ref}
      className="xe-tools"
      data-edit-only
      role="toolbar"
      aria-label={`${label}: tools`}
      data-open={open ? "" : undefined}
      onKeyDown={(e) => {
        // An AI draft's own menu, open inside this one, takes its Escape first (BlockTools).
        if (!open || e.key !== "Escape" || ref.current?.querySelector('[data-tool="more"] [aria-expanded="true"]')) return;
        e.preventDefault();
        e.stopPropagation();
        setOpen(false);
        menu.current?.focus();
      }}
      onBlur={(e) => {
        if (open && e.relatedTarget && !e.currentTarget.contains(e.relatedTarget as Node) && !rewriteOpenIn(e.currentTarget)) setOpen(false);
      }}
      onClick={(e) => {
        const b = (e.target as HTMLElement).closest("button");
        // A button in the menu, pressed, closes it; not one that is off (it says why) nor an AI draft's "More actions" (it opens its own).
        if (!open || !b || b === menu.current || b.hasAttribute("data-grip") || b.getAttribute("aria-disabled") === "true" || b.closest('[data-tool="more"]')) return;
        setOpen(false);
        if (b.dataset.tool !== "remove") requestAnimationFrame(() => menu.current?.focus());
      }}
    >
      <button type="button" className="xe-tool xe-grip" data-grip aria-label={`Drag ${label} to move it`} data-tip={`Drag ${label} to move it`} {...board.grip(id)}>
        <GripVertical aria-hidden size={16} strokeWidth={2.25} />
      </button>
      <button ref={menu} type="button" className="xe-tool" data-tool="menu" aria-label={`More actions for ${label}`} aria-expanded={open} data-tip="More actions" onClick={() => setOpen((o) => !o)}>
        <Ellipsis aria-hidden size={16} strokeWidth={2.25} />
      </button>
      <Tool name={`Move ${label} up`} tool="up" disabled={place <= 0} onClick={() => board.moveBy(id, -1)}>
        <ArrowUp aria-hidden size={15} strokeWidth={2.25} />
      </Tool>
      <Tool name={`Move ${label} down`} tool="down" disabled={place >= count - 1} onClick={() => board.moveBy(id, 1)}>
        <ArrowDown aria-hidden size={15} strokeWidth={2.25} />
      </Tool>
      {actions.map((a) => (
        <Tool key={a.name} name={a.name} tool={a.tool} pressed={a.pressed} onClick={a.run}>
          {a.icon ?? <span className="xe-tool-word">{a.name}</span>}
        </Tool>
      ))}
      {block && (
        <span className="xe-more" data-tool="more">
          <MoreActions block={block} />
        </span>
      )}
      {/* Every section can be taken off in every layout, the flowchart too (decision 0032): the "+" and the tray offer it back. */}
      <Tool name={`Remove ${label}`} tool="remove" onClick={() => board.remove(id)}>
        <Trash2 aria-hidden size={15} strokeWidth={2.25} />
      </Tool>
    </div>
  );
}
