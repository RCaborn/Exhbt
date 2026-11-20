/*
 * Where a carried flowchart box would land, and where the line that shows it goes (decision 0026,
 * "Dragging"). Plain numbers, no DOM and no React, so the rules can be tested in-process
 * (e2e/editor-flow.spec.ts). Everything is measured along the flowchart's own axis: x in a row, y in a
 * column, from the boxes as they were when the box was picked up.
 */

/** One box along the axis: where it starts and ends. */
export type Span = { start: number; end: number };

/** How much nearer another place must be before it takes over from the one shown, so a drag cannot flicker between two. */
export const HOLD = 10;

/** How far past the flowchart's sides (across its axis) the pointer may go and still be over a place. */
export const REACH = 80;

/** How far before the first box, or after the last, the line is drawn. */
export const END_GAP = 8;

const middle = (s: Span) => (s.start + s.end) / 2;

/**
 * The place a box carried to `at` (along the axis) would land in: the box whose middle is nearest.
 * The place shown now (`current`) keeps it unless another is nearer by more than `hold`.
 */
export function placeAt(spans: readonly Span[], at: number, current: number | null, hold = HOLD): number {
  let best = 0;
  for (let i = 1; i < spans.length; i++) if (Math.abs(middle(spans[i]!) - at) < Math.abs(middle(spans[best]!) - at)) best = i;
  if (current === null || current === best || !spans[current]) return best;
  return Math.abs(middle(spans[current]!) - at) - Math.abs(middle(spans[best]!) - at) > hold ? best : current;
}

/** Whether `at` (across the axis) is close enough to the flowchart, which runs from `start` to `end` across it, to be over a place. */
export const within = (at: number, start: number, end: number, reach = REACH) => at >= start - reach && at <= end + reach;

/**
 * Where the line goes (along the axis) for the box at `from` landing in place `to`: in the middle of
 * the gap it would go into, after box `to` when it moves along, before it when it moves back; or null
 * when it would land where it is.
 */
export function lineAt(spans: readonly Span[], from: number, to: number, endGap = END_GAP): number | null {
  if (to === from || !spans[to]) return null;
  if (to > from) return spans[to + 1] ? (spans[to]!.end + spans[to + 1]!.start) / 2 : spans[to]!.end + endGap;
  return spans[to - 1] ? (spans[to - 1]!.end + spans[to]!.start) / 2 : spans[to]!.start - endGap;
}

/** The order of the keys once the box at `from` is moved to `to`. */
export function moved<T>(list: readonly T[], from: number, to: number): T[] {
  const out = [...list];
  const [x] = out.splice(from, 1);
  out.splice(to, 0, x!);
  return out;
}
