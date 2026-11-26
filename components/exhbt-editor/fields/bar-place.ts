/** Where the selection bar sits, in whole pixels. */
export type BarPlace = { x: number; y: number };

/**
 * The bar's new place, or the one it has when that is where it already is. The bar is placed after every
 * render (SelectionBar.tsx), so this must settle: it rounds first and then compares, because comparing a
 * stored (rounded) place with an unrounded one never settles when the words' centre is on a half pixel
 * (|round(x) - x| is 0.5), and each render would then set a new place until React stopped the editor with
 * "Maximum update depth exceeded" and the classic editor opened.
 */
export function settlePlace(cur: BarPlace | null, x: number, y: number): BarPlace | null {
  const next = { x: Math.round(x), y: Math.round(y) };
  return cur && cur.x === next.x && cur.y === next.y ? cur : next;
}
