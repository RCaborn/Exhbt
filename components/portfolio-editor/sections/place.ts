"use client";

import { useLayoutEffect, useState, type RefObject } from "react";

/*
 * Where a toolbar sits over its part (decision 0026, "On each section": never over words, its own
 * included, nor over another section's or tile's). It takes the first place in its list that is clear,
 * measured on the page as drawn, and falls back to the last. The exhbt editor's long search is not
 * needed here: a portfolio's sections all open with the look's own padding, so the gap above the
 * corner nearly always holds it.
 *
 *  - A section: a row in the gap above its top right corner (inside the section's own top padding);
 *    else a row half over its top edge; else the corner itself.
 *  - A tile: inside its own top right corner (over a card's picture or key figure, or a row's empty end)
 *    when no words are under it; else in the gutter to its right, when the page has room there; else
 *    half over its top edge; else the corner.
 *
 * Measured when it is drawn and whenever the part changes size (a key typed, a section moved).
 */

export type Spot = { x: number; y: number; where: "gap" | "edge" | "inside" | "gutter" | "corner" };

const MARGIN = 8;

/** The boxes of the words (and fields) inside `root`, in window coordinates. */
export function wordRects(root: Element): DOMRect[] {
  const out: DOMRect[] = [];
  const range = document.createRange();
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
    acceptNode: (n) => {
      if (n.nodeType === Node.ELEMENT_NODE) {
        const el = n as Element;
        // The editor's own controls are not the person's words.
        if (el.matches("[data-pe-tools], .sr-only, [hidden], svg")) return NodeFilter.FILTER_REJECT;
        return el.matches("textarea, input, [contenteditable=true]") ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
      }
      return n.textContent?.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
    },
  });
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (n.nodeType === Node.ELEMENT_NODE) out.push((n as Element).getBoundingClientRect());
    else {
      range.selectNodeContents(n);
      for (const r of range.getClientRects()) if (r.width > 0 && r.height > 0) out.push(r);
    }
  }
  return out;
}

const overlaps = (a: DOMRect, b: DOMRect) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 0.5 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 0.5;

/** The right edge of a section's content: the look's wrap inside it (its max width, less its padding). */
function contentRight(section: Element): number {
  let el: Element = section;
  while (getComputedStyle(el).maxWidth === "none" && el.children.length === 1 && el.firstElementChild) el = el.firstElementChild;
  const r = el.getBoundingClientRect();
  return r.right - (parseFloat(getComputedStyle(el).paddingRight) || 0);
}

/** A section's toolbar: the gap above its corner, else half over its top edge. */
export function placeSection(frame: HTMLElement, body: Element, tools: HTMLElement): Spot {
  const f = frame.getBoundingClientRect();
  const w = tools.offsetWidth;
  const h = tools.offsetHeight;
  const right = Math.min(f.right, contentRight(body));
  const x = right - f.left - w;
  const words = wordRects(body);
  const top = words.length ? Math.min(...words.map((r) => r.top)) : f.bottom;
  const gap = top - f.top;
  if (gap >= h + MARGIN) return { x, y: Math.max(MARGIN / 2, Math.round((gap - h) / 2)), where: "gap" };
  // Half over the top edge, clear of the words of the section above (its bottom padding).
  const edge = new DOMRect(f.left + x, f.top - h / 2, w, h);
  const above = frame.previousElementSibling;
  if (!above || !wordRects(above).some((r) => overlaps(r, edge))) return { x, y: -h / 2, where: "edge" };
  return { x, y: 0, where: "corner" };
}

/** A tile's toolbar: inside its corner, the gutter to its right, half over its top edge, or the corner. */
export function placeTile(frame: HTMLElement, tools: HTMLElement, bounds: DOMRect, neighbours: Element[]): Spot {
  const f = frame.getBoundingClientRect();
  const w = tools.offsetWidth;
  const h = tools.offsetHeight;
  const own = wordRects(frame);
  const others = neighbours.flatMap((n) => [n.getBoundingClientRect()]);
  const clear = (r: DOMRect, rects: DOMRect[]) => !rects.some((q) => overlaps(q, r));
  const inside = new DOMRect(f.right - w - MARGIN, f.top + MARGIN, w, h);
  if (clear(inside, own)) return { x: f.width - w - MARGIN, y: MARGIN, where: "inside" };
  const gutter = new DOMRect(f.right + MARGIN, f.top, w, h);
  if (gutter.right <= bounds.right && clear(gutter, others)) return { x: f.width + MARGIN, y: 0, where: "gutter" };
  const edge = new DOMRect(f.right - w - MARGIN, f.top - h / 2, w, h);
  if (clear(edge, [...own, ...others.filter((o) => o.bottom <= f.top + 1)])) return { x: f.width - w - MARGIN, y: -h / 2, where: "edge" };
  return { x: f.width - w - MARGIN, y: MARGIN, where: "corner" };
}

/**
 * Keeps `spot` up to date for a toolbar: measured after each draw and whenever the frame changes size.
 * `measure` returns null while it cannot measure yet.
 */
export function useSpot(frame: RefObject<HTMLElement | null>, measure: () => Spot | null, deps: unknown[]): Spot | null {
  const [spot, setSpot] = useState<Spot | null>(null);
  useLayoutEffect(() => {
    const el = frame.current;
    if (!el) return;
    let raf = 0;
    const run = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const next = measure();
        setSpot((s) => (next && s && s.x === next.x && s.y === next.y && s.where === next.where ? s : next));
      });
    };
    run();
    const ro = new ResizeObserver(run);
    ro.observe(el);
    window.addEventListener("resize", run);
    document.fonts?.ready.then(run);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("resize", run);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return spot;
}
