import type { Section } from "@/lib/exhbt/blocks";
import { orderWith, rowClass, rowsOf } from "./layout";
import type { ItemKind } from "./store";

/**
 * The geometry of a drag in the lab, as pure functions (no React; the DOM only in measurePlace).
 *
 * Everything is worked out from the page as it stood when the section was picked up, in the
 * board's own coordinates. Nothing shown during the drag is ever measured again, so what the
 * page shows can't change where the pointer is taken to be. That is what keeps a drag from
 * flickering between two places: the place is a function of where the pointer is and nothing
 * else, with a margin (HYSTERESIS) that a place has to be nearer by before it takes over.
 *
 * A "place" is where the lifted section would go: its index in the order with the section itself
 * taken out, from 0 (first) to the number of other sections (last). One of them is where it
 * already is (`home`).
 */

export type Box = { x: number; y: number; w: number; h: number };
type Seg = { x1: number; y1: number; x2: number; y2: number };

export type Plan = {
  id: string;
  /** The order when it was picked up, and the same with the lifted section taken out. */
  order: string[];
  rest: string[];
  /** The place it is in already. */
  home: number;
  /** Every item's box when it was picked up. */
  boxes: Record<string, Box>;
  kinds: Record<string, ItemKind>;
  /** Which line of the page each item is on (items side by side share a line), and each line's top and bottom. */
  lineOf: Record<string, number>;
  lines: { ids: string[]; top: number; bottom: number }[];
  /** Which row (the layout's own grouping) each item is in. */
  rowOf: Record<string, number>;
  /** The board's width. */
  width: number;
  /** For each place, what the pointer is measured against: lines between sections, or the lifted section's own box. */
  anchors: { segs: Seg[]; box?: Box }[];
};

/** How much nearer (px) another place must be before the drag moves to it. */
export const HYSTERESIS = 10;

export function makePlan(id: string, order: string[], boxes: Record<string, Box>, kinds: Record<string, ItemKind>, sections: Record<string, Section>, width: number): Plan {
  const rest = order.filter((x) => x !== id);
  const home = order.indexOf(id);

  // Lines: items in order, a new line whenever an item starts below everything on the line so far.
  const lines: Plan["lines"] = [];
  const lineOf: Record<string, number> = {};
  for (const x of order) {
    const b = boxes[x];
    if (!b) continue;
    const last = lines[lines.length - 1];
    if (last && b.y < last.bottom - 1) {
      last.ids.push(x);
      last.top = Math.min(last.top, b.y);
      last.bottom = Math.max(last.bottom, b.y + b.h);
    } else lines.push({ ids: [x], top: b.y, bottom: b.y + b.h });
    lineOf[x] = lines.length - 1;
  }

  const rowOf: Record<string, number> = {};
  rowsOf(order, sections).forEach((row, i) => row.ids.forEach((x) => (rowOf[x] = i)));

  const plan: Plan = { id, order, rest, home, boxes, kinds, lineOf, lines, rowOf, width, anchors: [] };
  for (let p = 0; p <= rest.length; p++) plan.anchors.push(anchorFor(plan, p));
  return plan;
}

const EDGE = 12;

function anchorFor(plan: Plan, place: number): Plan["anchors"][number] {
  const { rest, boxes, lineOf, lines, rowOf, width } = plan;
  // Home is the lifted section's own box, and also the gap it sits in: the end of the line before it and the start of the one after.
  const box = place === plan.home ? boxes[plan.id] : undefined;
  const a = rest[place - 1];
  const b = rest[place];
  const A = a ? boxes[a]! : null;
  const B = b ? boxes[b]! : null;
  const segs: Seg[] = [];
  if (A && B && lineOf[a!] === lineOf[b!]) {
    // Between two items that sit side by side: the gap between them.
    const x = (A.x + A.w + B.x) / 2;
    segs.push({ x1: x, y1: Math.min(A.y, B.y), x2: x, y2: Math.max(A.y + A.h, B.y + B.h) });
    return { segs, box };
  }
  const lineA = a ? lines[lineOf[a]!]! : null;
  const lineB = b ? lines[lineOf[b]!]! : null;
  // The end of a line that holds several items, and the start of one: both are this place.
  if (A && lineA && lineA.ids.length > 1) segs.push({ x1: A.x + A.w + EDGE, y1: A.y, x2: A.x + A.w + EDGE, y2: A.y + A.h });
  if (B && lineB && lineB.ids.length > 1) segs.push({ x1: B.x - EDGE, y1: B.y, x2: B.x - EDGE, y2: B.y + B.h });
  if (!lineA && lineB) segs.push({ x1: 0, y1: lineB.top - EDGE, x2: width, y2: lineB.top - EDGE });
  else if (lineA && !lineB) segs.push({ x1: 0, y1: lineA.bottom + EDGE, x2: width, y2: lineA.bottom + EDGE });
  else if (lineA && lineB) {
    // Between two lines, unless both are lines of the same grid: there the place is the end of one and the start of the next.
    const insideGrid = rowOf[a!] === rowOf[b!] && lineA.ids.length > 1 && lineB.ids.length > 1;
    if (!insideGrid) {
      const y = (lineA.bottom + lineB.top) / 2;
      segs.push({ x1: 0, y1: y, x2: width, y2: y });
    }
  }
  return { segs, box };
}

function distToSeg(px: number, py: number, s: Seg): number {
  const cx = Math.max(Math.min(s.x1, s.x2), Math.min(px, Math.max(s.x1, s.x2)));
  const cy = Math.max(Math.min(s.y1, s.y2), Math.min(py, Math.max(s.y1, s.y2)));
  return Math.hypot(px - cx, py - cy);
}

function distToPlace(plan: Plan, place: number, px: number, py: number): number {
  const a = plan.anchors[place]!;
  let d = Infinity;
  if (a.box) {
    const cx = Math.max(a.box.x, Math.min(px, a.box.x + a.box.w));
    const cy = Math.max(a.box.y, Math.min(py, a.box.y + a.box.h));
    d = Math.hypot(px - cx, py - cy);
  }
  for (const s of a.segs) d = Math.min(d, distToSeg(px, py, s));
  return d;
}

/**
 * The place for a pointer at (px, py), given the place the drag is at now. Another place takes
 * over only when it is nearer by more than HYSTERESIS, so a pointer resting on the boundary
 * between two places, or trembling across it, stays where it is.
 */
export function placeAt(plan: Plan, px: number, py: number, current: number): number {
  let best = current;
  let bestD = distToPlace(plan, current, px, py) - HYSTERESIS;
  for (let p = 0; p < plan.anchors.length; p++) {
    if (p === current) continue;
    const d = distToPlace(plan, p, px, py);
    if (d < bestD) {
      best = p;
      bestD = d;
    }
  }
  return best;
}

/** What the page would look like with the lifted section at a place: where every item would sit. */
export type Measured = Record<string, Box>;

/**
 * Lays out the order with the lifted section at `place` in a hidden copy of the board (empty
 * boxes in the real rows, so the pairing, the grid and the gaps are the page's own CSS) and reads
 * where each box lands. A box is as tall as its section was when picked up; when the copy gives
 * it a different width (it would join or leave a pair), a picture keeps its shape and words keep
 * their area, which is close enough to slide things by until the drop lays the page out for real.
 */
export function measurePlace(host: HTMLElement, plan: Plan, sections: Record<string, Section>, place: number): Measured {
  const order = orderWith(plan.order, plan.id, place);
  host.textContent = "";
  const els: Record<string, HTMLElement> = {};
  for (const row of rowsOf(order, sections)) {
    const r = document.createElement("div");
    r.className = rowClass(row);
    for (const id of row.ids) {
      const el = document.createElement("div");
      el.className = "min-w-0";
      el.style.height = `${plan.boxes[id]?.h ?? 0}px`;
      r.appendChild(el);
      els[id] = el;
    }
    host.appendChild(r);
  }
  // Second pass: a box whose width changed takes the height it would roughly have at that width.
  const resized: [HTMLElement, number][] = [];
  for (const id of order) {
    const was = plan.boxes[id];
    const el = els[id];
    if (!was || !el || was.w < 1) continue;
    const w = el.getBoundingClientRect().width;
    if (Math.abs(w - was.w) < 1 || w < 1) continue;
    const kind = plan.kinds[id];
    if (kind === "image") resized.push([el, was.h * (w / was.w)]);
    else if (kind !== "graph" && kind !== "flow") resized.push([el, was.h * (was.w / w)]);
  }
  for (const [el, h] of resized) el.style.height = `${h}px`;
  const origin = host.getBoundingClientRect();
  const out: Measured = {};
  for (const id of order) {
    const r = els[id]!.getBoundingClientRect();
    out[id] = { x: r.left - origin.left, y: r.top - origin.top, w: r.width, h: r.height };
  }
  return out;
}

/**
 * Version B's line for a place, on the page as it stands: upright beside a neighbour when the
 * section would share that neighbour's row (in a pair or the grid), or between the two it would
 * split; otherwise across the column between the lines above and below. Null at home.
 */
export function lineFor(plan: Plan, place: number, at: Measured): Box | null {
  if (place === plan.home) return null;
  const { rest, boxes, lineOf, lines, width } = plan;
  const T = 4;
  const a = rest[place - 1];
  const b = rest[place];
  const A = a ? boxes[a]! : null;
  const B = b ? boxes[b]! : null;
  const me = at[plan.id];
  const sameLine = (other: string | undefined) => {
    const o = other ? at[other] : null;
    return Boolean(me && o && me.y < o.y + o.h - 1 && o.y < me.y + me.h - 1);
  };
  const upright = (x: number, top: number, bottom: number): Box => ({ x: Math.max(0, Math.min(width - T, x - T / 2)), y: top, w: T, h: bottom - top });
  const sideBySide = Boolean(A && B && lineOf[a!] === lineOf[b!]);
  if (sideBySide) return upright((A!.x + A!.w + B!.x) / 2, Math.min(A!.y, B!.y), Math.max(A!.y + A!.h, B!.y + B!.h));
  if (A && sameLine(a)) return upright(A.x + A.w + EDGE / 2, A.y, A.y + A.h);
  if (B && sameLine(b)) return upright(B.x - EDGE / 2, B.y, B.y + B.h);
  const lineA = a ? lines[lineOf[a]!]! : null;
  const lineB = b ? lines[lineOf[b]!]! : null;
  const y = lineA && lineB ? (lineA.bottom + lineB.top) / 2 : lineB ? lineB.top - EDGE : lineA ? lineA.bottom + EDGE : 0;
  return { x: 0, y: y - T / 2, w: width, h: T };
}
