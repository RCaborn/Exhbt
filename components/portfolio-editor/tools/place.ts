/*
 * Where a corner tool drawn over the page sits, so that it covers no word (Suggest an intro, PartTools.tsx).
 * The eight looks put different things round the intro: the headline tight above it, facts below it, room
 * beside it at one width and none at another. So the tool is not given one place: it is tried in a few,
 * in order, and takes the first that meets no word on the page. A word is measured where the browser lays
 * it out: text by its Range, a field (a textarea, whose lines a Range cannot see) by a hidden copy of its
 * words in its own box and type.
 */

export type Spot = "line" | "beside" | "above" | "below";
type Box = { left: number; top: number; right: number; bottom: number };

const meets = (a: Box, b: Box) => a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1;

/** The boxes of every line of words a field shows (its value, else its placeholder), from a hidden copy. */
function fieldLines(f: HTMLTextAreaElement | HTMLInputElement): Box[] {
  const text = f.value || f.placeholder;
  if (!text.trim()) return [];
  const s = getComputedStyle(f);
  const r = f.getBoundingClientRect();
  const copy = document.createElement("div");
  for (const p of ["font", "letterSpacing", "wordSpacing", "textAlign", "textIndent", "textTransform", "lineHeight", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft", "borderTopWidth", "borderRightWidth", "borderBottomWidth", "borderLeftWidth", "boxSizing", "direction", "tabSize"] as const) {
    copy.style[p] = s[p];
  }
  Object.assign(copy.style, {
    position: "fixed",
    left: `${r.left}px`,
    top: `${r.top}px`,
    width: `${r.width}px`,
    visibility: "hidden",
    pointerEvents: "none",
    whiteSpace: f instanceof HTMLTextAreaElement ? "pre-wrap" : "pre",
    overflowWrap: "break-word",
    borderStyle: "solid",
    borderColor: "transparent",
  });
  copy.textContent = text;
  document.body.append(copy);
  const range = document.createRange();
  range.selectNodeContents(copy);
  const boxes = [...range.getClientRects()].filter((b) => b.width > 0).map((b) => ({ left: b.left, top: b.top, right: b.right, bottom: b.bottom }));
  copy.remove();
  return boxes;
}

/** Every line of words drawn in `root` within the band `near` (top to bottom), but those inside `skip` and anything hidden from view. */
function wordBoxes(root: Element, skip: Element, near: { top: number; bottom: number }): Box[] {
  const out: Box[] = [];
  const inBand = (b: { top: number; bottom: number }) => b.bottom > near.top && b.top < near.bottom;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const el = n.parentElement;
    if (!el || !n.textContent?.trim() || skip.contains(el) || el.closest("[aria-hidden=true], .sr-only, textarea")) continue;
    const range = document.createRange();
    range.selectNodeContents(n);
    for (const b of range.getClientRects()) if (b.width > 0 && inBand(b)) out.push({ left: b.left, top: b.top, right: b.right, bottom: b.bottom });
  }
  for (const f of root.querySelectorAll<HTMLTextAreaElement | HTMLInputElement>("textarea, input[type=text], input:not([type])")) {
    if (!skip.contains(f) && inBand(f.getBoundingClientRect())) out.push(...fieldLines(f));
  }
  return out;
}

/**
 * The first spot, of `order`, where a tool `w` by `h` beside `intro` meets no word and stays inside the
 * page's own width; null when there is none. Returns the spot and its offset from the intro's corner.
 */
export function placeTool(intro: HTMLElement, tool: HTMLElement, size: { w: number; h: number }, order: Spot[]): { spot: Spot; x: number; y: number } | null {
  const page = intro.closest("[data-portfolio-home]") ?? document.body;
  const i = intro.getBoundingClientRect();
  const p = page.getBoundingClientRect();
  // Only words near enough to meet the tool in one of its spots are measured: typing re-places it.
  const words = wordBoxes(page, tool, { top: i.top - size.h - 16, bottom: i.bottom + size.h + 16 });
  // The middle of the intro's first line of words, from its top: its own field's first line where it has
  // one (a field can have padding above its words), else half a line.
  const own = intro.querySelector<HTMLTextAreaElement>("textarea");
  const first = own ? fieldLines(own)[0] : undefined;
  const half = first ? (first.top + first.bottom) / 2 - i.top : (parseFloat(getComputedStyle(intro).lineHeight) || parseFloat(getComputedStyle(intro).fontSize) * 1.5) / 2;
  const gap = 4;
  const at: Record<Spot, { x: number; y: number }> = {
    line: { x: i.width - size.w, y: half - size.h / 2 },
    beside: { x: i.width + gap, y: half - size.h / 2 },
    above: { x: i.width - size.w, y: -size.h - gap },
    below: { x: i.width - size.w, y: i.height + gap },
  };
  const edge = Math.min(p.right, document.documentElement.clientWidth) - 8;
  for (const spot of order) {
    const { x, y } = at[spot];
    const box = { left: i.left + x, top: i.top + y, right: i.left + x + size.w, bottom: i.top + y + size.h };
    if (box.left < Math.max(p.left, 0) + 8 || box.right > edge) continue;
    if (words.some((w) => meets(w, box))) continue;
    return { spot, x, y };
  }
  return null;
}
