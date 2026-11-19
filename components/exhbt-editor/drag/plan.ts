import type { Cell, Row } from "../../../lib/exhbt/layouts";

/*
 * The geometry of a drag (decision 0026, "Dragging"), as pure functions: no React, no DOM, and
 * relative imports only, so the rules can be checked in-process (e2e/editor-drag.spec.ts).
 *
 * Everything is worked out from the page as it stood when the section was picked up, in the main
 * column's own coordinates. Nothing shown during the drag is measured again, so what the page shows
 * can never change where the pointer is taken to be. That is what keeps a drag from flickering
 * between two places: the place is a function of where the pointer is and nothing else, with a
 * margin (HYSTERESIS) that another place must be nearer by before it takes over.
 *
 * A "place" is where the lifted thing would go: its index among the page items with the lifted one
 * taken out, from 0 (first) to the number of other items (last), the same count as store.move. One
 * of them is where it already is (`home`); a new block from the tray has no home (-1).
 *
 * Where each place is pointed at comes from the layout's own rows (rowsFor), not from guessing at
 * lines: between two rows it is a line across the column; between the two columns of a pair it is
 * the gap between them; inside a stack it is the gap between two of its parts, across that column
 * only; inside a group (a grid, two graphs) it is the gap between neighbours, or the end of one line
 * of tiles and the start of the next.
 */

export type Box = { x: number; y: number; w: number; h: number };
export type Seg = { x1: number; y1: number; x2: number; y2: number };
/** Where each item would sit for one place: the hidden copy's measurements (measure.ts). */
export type Measured = Record<string, Box>;

/** One row of the page, as the plan needs it: its items in order, and its cells (a pair has two, a stack is one cell of several, a group's items are a cell each). */
export type RowInfo = { kind: Row["row"]; ids: string[]; cells: string[][] };

export type Plan = {
  /** What is carried: a page item's id, or a new block's stand-in id. */
  id: string;
  /** The page items when it was picked up, and the same with the carried one taken out. */
  order: string[];
  rest: string[];
  /** The place it is in already; -1 for a new block. */
  home: number;
  /** Every item's box when it was picked up. */
  boxes: Record<string, Box>;
  rows: RowInfo[];
  rowOf: Record<string, number>;
  cellOf: Record<string, number>;
  rowBox: Box[];
  cellBox: Box[][];
  /** The column's width. */
  width: number;
  /** For each place, what the pointer is measured against: segments, and at home the carried item's own box. */
  anchors: { segs: Seg[]; box?: Box }[];
};

/** How much nearer (px) another place must be before the drag moves to it. */
export const HYSTERESIS = 10;
/** How far outside an item the "end of its line" and "start of its line" are pointed at. */
const EDGE = 12;
/** The line's thickness. */
const T = 4;

const cellIds = (c: Cell): string[] => (c.cell === "item" ? [c.item.id] : c.items.map((x) => x.item.id));

/** The rows as the plan reads them. */
export function rowsInfo(rows: Row[]): RowInfo[] {
  return rows.map((r): RowInfo => {
    switch (r.row) {
      case "one":
        return { kind: "one", ids: cellIds(r.cell), cells: [cellIds(r.cell)] };
      case "pair":
        return { kind: "pair", ids: [...cellIds(r.left), ...cellIds(r.right)], cells: [cellIds(r.left), cellIds(r.right)] };
      case "group":
        return { kind: "group", ids: r.items.map((c) => c.item.id), cells: r.items.map((c) => [c.item.id]) };
    }
  });
}

/** `order` with `id` moved to `place` (its index with itself taken out); with `id` not in `order` (a new block), put in at `place`. */
export function orderWith(order: string[], id: string, place: number): string[] {
  const rest = order.filter((x) => x !== id);
  const p = Math.max(0, Math.min(rest.length, place));
  return [...rest.slice(0, p), id, ...rest.slice(p)];
}

const union = (list: Box[]): Box => {
  const x = Math.min(...list.map((b) => b.x));
  const y = Math.min(...list.map((b) => b.y));
  return { x, y, w: Math.max(...list.map((b) => b.x + b.w)) - x, h: Math.max(...list.map((b) => b.y + b.h)) - y };
};
const right = (b: Box) => b.x + b.w;
const bottom = (b: Box) => b.y + b.h;
/** B sits to the right of A on the same line: they share some height, and B starts where A ends or later. */
const beside = (a: Box, b: Box) => b.x >= right(a) - 1 && b.y < bottom(a) - 1 && a.y < bottom(b) - 1;
/** B sits under A in the same column: they share some width, and B starts where A ends or later. */
const under = (a: Box, b: Box) => b.y >= bottom(a) - 1 && b.x < right(a) - 1 && a.x < right(b) - 1;
/** A row holds things side by side: a pair laid out as two columns, or a group with two on one line. */
const sideBySide = (boxes: Box[]) => boxes.some((a, i) => boxes.some((b, j) => i !== j && beside(a, b)));

const vertical = (x: number, y1: number, y2: number): Seg => ({ x1: x, y1, x2: x, y2 });
const horizontal = (y: number, x1: number, x2: number): Seg => ({ x1, y1: y, x2, y2: y });

/**
 * The plan for carrying `id` (a page item, or a new block's id not in `order`), made from the frozen
 * boxes and the page's rows as they stood. `rows` are the rows with the carried item where it was
 * (for a new block, the page's own rows).
 */
export function makePlan(id: string, order: string[], boxes: Record<string, Box>, rows: RowInfo[], width: number): Plan {
  const rest = order.filter((x) => x !== id);
  const home = order.indexOf(id);
  const rowOf: Record<string, number> = {};
  const cellOf: Record<string, number> = {};
  const rowBox: Box[] = [];
  const cellBox: Box[][] = [];
  rows.forEach((r, i) => {
    r.cells.forEach((c, k) => c.forEach((x) => ((rowOf[x] = i), (cellOf[x] = k))));
    const known = (ids: string[]) => ids.map((x) => boxes[x]).filter((b): b is Box => Boolean(b));
    const all = known(r.ids);
    const rb = all.length ? union(all) : { x: 0, y: 0, w: width, h: 0 };
    rowBox.push(rb);
    cellBox.push(r.cells.map((c) => (known(c).length ? union(known(c)) : rb)));
  });
  const plan: Plan = { id, order, rest, home, boxes, rows, rowOf, cellOf, rowBox, cellBox, width, anchors: [] };
  for (let p = 0; p <= rest.length; p++) plan.anchors.push(anchorFor(plan, p));
  return plan;
}

/** Whether the row of `x` puts things side by side (on the frozen page). */
const rowIsWide = (plan: Plan, x: string) => {
  const r = plan.rows[plan.rowOf[x]!];
  return Boolean(r && r.ids.length > 1 && sideBySide(r.ids.map((i) => plan.boxes[i]!).filter(Boolean)));
};

function anchorFor(plan: Plan, place: number): Plan["anchors"][number] {
  const { rest, boxes, rowOf, cellOf, rowBox, cellBox, width } = plan;
  // At home the carried item's own box counts too: the gap it sits in belongs to the place it is in.
  const box = place === plan.home ? boxes[plan.id] : undefined;
  const a = rest[place - 1];
  const b = rest[place];
  const A = a ? boxes[a] : undefined;
  const B = b ? boxes[b] : undefined;
  const segs: Seg[] = [];
  if (a && b && A && B && rowOf[a] === rowOf[b]) {
    const r = rowOf[a]!;
    const row = plan.rows[r]!;
    if (cellOf[a] === cellOf[b]) {
      // Two parts of one stack: the gap between them, across that column only.
      const c = cellBox[r]![cellOf[a]!]!;
      segs.push(horizontal((bottom(A) + B.y) / 2, c.x, right(c)));
    } else if (row.kind === "pair") {
      const L = cellBox[r]![cellOf[a]!]!;
      const R = cellBox[r]![cellOf[b]!]!;
      const rb = rowBox[r]!;
      // The two halves of a pair: the gap between the columns, or between them where a narrow column stacks them.
      if (beside(L, R)) segs.push(vertical((right(L) + R.x) / 2, rb.y, bottom(rb)));
      else segs.push(horizontal((bottom(L) + R.y) / 2, rb.x, right(rb)));
    } else if (beside(A, B)) {
      segs.push(vertical((right(A) + B.x) / 2, Math.min(A.y, B.y), Math.max(bottom(A), bottom(B))));
    } else if (under(A, B)) {
      segs.push(horizontal((bottom(A) + B.y) / 2, Math.min(A.x, B.x), Math.max(right(A), right(B))));
    } else {
      // A group's line wraps between them: the end of A's line and the start of B's are both this place.
      segs.push(vertical(right(A) + EDGE, A.y, bottom(A)));
      segs.push(vertical(B.x - EDGE, B.y, bottom(B)));
    }
    return { segs, box };
  }
  // Between two rows, or before the first, or after the last: a line across the column.
  const rA = a ? rowBox[rowOf[a]!] : undefined;
  const rB = b ? rowBox[rowOf[b]!] : undefined;
  if (rA && rB) segs.push(horizontal((bottom(rA) + rB.y) / 2, 0, width));
  else if (rB) segs.push(horizontal(rB.y - EDGE, 0, width));
  else if (rA) segs.push(horizontal(bottom(rA) + EDGE, 0, width));
  else segs.push(horizontal(0, 0, width));
  // The end of a row that holds things side by side, and the start of one, are this place too.
  if (a && A && rowIsWide(plan, a)) segs.push(vertical(right(A) + EDGE, A.y, bottom(A)));
  if (b && B && rowIsWide(plan, b)) segs.push(vertical(B.x - EDGE, B.y, bottom(B)));
  return { segs, box };
}

function distToSeg(px: number, py: number, s: Seg): number {
  const cx = Math.max(Math.min(s.x1, s.x2), Math.min(px, Math.max(s.x1, s.x2)));
  const cy = Math.max(Math.min(s.y1, s.y2), Math.min(py, Math.max(s.y1, s.y2)));
  return Math.hypot(px - cx, py - cy);
}

/** How far the pointer is from a place. */
export function distToPlace(plan: Plan, place: number, px: number, py: number): number {
  const a = plan.anchors[place]!;
  let d = Infinity;
  if (a.box) {
    const cx = Math.max(a.box.x, Math.min(px, right(a.box)));
    const cy = Math.max(a.box.y, Math.min(py, bottom(a.box)));
    d = Math.hypot(px - cx, py - cy);
  }
  for (const s of a.segs) d = Math.min(d, distToSeg(px, py, s));
  return d;
}

/**
 * The place for a pointer at (px, py), given the place the drag is at now. Another place takes over
 * only when it is nearer by more than HYSTERESIS, so a pointer resting on the boundary between two
 * places, or trembling across it, stays where it is. With no place yet (-1: a new block coming onto
 * the page), the nearest place.
 */
export function placeAt(plan: Plan, px: number, py: number, current: number): number {
  let best = current;
  let bestD = current >= 0 ? distToPlace(plan, current, px, py) - HYSTERESIS : Infinity;
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

/** A point that is nearest to `place` and to no other: the middle of its first segment, or of its box at home. */
export function pointFor(plan: Plan, place: number): { x: number; y: number } {
  const a = plan.anchors[place]!;
  if (a.box) return { x: a.box.x + a.box.w / 2, y: a.box.y + a.box.h / 2 };
  const s = a.segs[0]!;
  return { x: (s.x1 + s.x2) / 2, y: (s.y1 + s.y2) / 2 };
}

/**
 * The line for a place, on the still page: upright in the gap between two things that sit side by
 * side, or beside the neighbour the carried item would share a row with (from `at`, the page as it
 * would be); across a column between two parts of a stack; otherwise across the column between the
 * rows above and below. Null at home.
 */
export function lineFor(plan: Plan, place: number, at: Measured): Box | null {
  if (place === plan.home) return null;
  const { rest, boxes, rowOf, cellOf, rowBox, cellBox, width } = plan;
  const a = rest[place - 1];
  const b = rest[place];
  const A = a ? boxes[a] : undefined;
  const B = b ? boxes[b] : undefined;
  const upright = (x: number, y1: number, y2: number): Box => ({ x: Math.max(0, Math.min(width - T, x - T / 2)), y: y1, w: T, h: y2 - y1 });
  const across = (y: number, x1: number, x2: number): Box => ({ x: x1, y: y - T / 2, w: x2 - x1, h: T });
  if (a && b && A && B && rowOf[a] === rowOf[b]) {
    const r = rowOf[a]!;
    if (cellOf[a] === cellOf[b]) {
      const c = cellBox[r]![cellOf[a]!]!;
      return across((bottom(A) + B.y) / 2, c.x, right(c));
    }
    if (plan.rows[r]!.kind === "pair") {
      const L = cellBox[r]![cellOf[a]!]!;
      const R = cellBox[r]![cellOf[b]!]!;
      const rb = rowBox[r]!;
      return beside(L, R) ? upright((right(L) + R.x) / 2, rb.y, bottom(rb)) : across((bottom(L) + R.y) / 2, rb.x, right(rb));
    }
    if (beside(A, B)) return upright((right(A) + B.x) / 2, Math.min(A.y, B.y), Math.max(bottom(A), bottom(B)));
    if (under(A, B)) return across((bottom(A) + B.y) / 2, Math.min(A.x, B.x), Math.max(right(A), right(B)));
    return upright(right(A) + EDGE / 2, A.y, bottom(A));
  }
  // Would it share a row with a neighbour? Then the line stands beside that neighbour.
  const me = at[plan.id];
  const shares = (x: string | undefined) => {
    const o = x ? at[x] : undefined;
    return Boolean(me && o && (beside(o, me) || beside(me, o)));
  };
  if (a && A && shares(a)) return upright(right(A) + EDGE / 2, A.y, bottom(A));
  if (b && B && shares(b)) return upright(B.x - EDGE / 2, B.y, bottom(B));
  const rA = a ? rowBox[rowOf[a]!] : undefined;
  const rB = b ? rowBox[rowOf[b]!] : undefined;
  const y = rA && rB ? (bottom(rA) + rB.y) / 2 : rB ? rB.y - EDGE : rA ? bottom(rA) + EDGE : 0;
  return across(y, 0, width);
}
