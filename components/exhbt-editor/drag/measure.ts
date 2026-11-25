import { cellClass, rowClass, stackClass, stackEditClass, stackIsRow } from "@/components/portfolio/layout-rows";
import type { ContentSection, SectionOf } from "@/lib/exhbt/blocks";
import { FORMAT_COPY, type Format } from "@/lib/exhbt/formats";
import { rowsFor, type Cell, type ItemAs, type ItemCell, type PageItem, type StackCell } from "@/lib/exhbt/layouts";
import { imageRatio, leadRatio } from "@/lib/exhbt/sections";
import type { Box, Measured } from "./plan";

/*
 * Where every item would sit with the carried one at a place (decision 0026, "Dragging", step 3):
 * the page's rows for that order (rowsFor) laid out as empty boxes in a hidden copy of the main
 * column, with the very wrappers and classes LayoutMain draws on the editing page (rowClass,
 * stackClass and stackEditClass, the grid's tiles with their shape, the link cells, the references'
 * heading), so pairs, stacks, the grid and the gaps are the page's real CSS. The copy lives inside
 * the main column, so its container queries and the layout's own rules read the same as the page's.
 *
 * Each box keeps the height it had when picked up. One whose width changes takes the height it would
 * roughly have at the new width: a picture keeps its shape (the lead image's frame and a tile's are
 * worked out from the picture's own size), words keep their area, and a graph or the flowchart keeps
 * its height. Close enough to slide things by; the drop lays the page out for real.
 */

/** What the plan knows of an item: its box at pick-up and how it was drawn there. */
export type Frozen = Record<string, { box: Box; as: ItemAs }>;

const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(" ");

const el = (tag: string, cls = ""): HTMLElement => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  return e;
};

/** The lead image's frame is never taller than 70% of the screen or 34rem (globals.css, .xp-lead). */
const leadCap = () => Math.min(window.innerHeight * 0.7, 34 * (parseFloat(getComputedStyle(document.documentElement).fontSize) || 16));

/** How tall a picture's own part is at a width, drawn as `as`. */
function pictureHeight(s: SectionOf<"image">, as: ItemAs, w: number): number {
  if (as === "lead") return Math.min(w / leadRatio(s), leadCap());
  return w / imageRatio(s);
}

/** The height an item of this kind would roughly take at a new width. */
function resized(item: PageItem, was: { box: Box; as: ItemAs }, as: ItemAs, w: number): number {
  const { box } = was;
  if (item.kind === "flow" || item.kind === "graph" || box.w < 1) return box.h;
  if (item.kind === "image") {
    const s = item.s as SectionOf<"image">;
    const words = Math.max(0, box.h - pictureHeight(s, was.as, box.w));
    return words + pictureHeight(s, as, w);
  }
  return (box.h * box.w) / w;
}

/**
 * Lays out `items` (the page items in the order to try) in `host` and reads where each box lands,
 * relative to the host. `frozen` holds every item's box at pick-up, the carried one's included.
 */
export function measureOrder(host: HTMLElement, f: Format, items: PageItem[], frozen: Frozen): Measured {
  host.textContent = "";
  const boxes: Record<string, HTMLElement> = {};
  const drawnAs: Record<string, ItemAs> = {};

  /** One item's empty box: what the frame is on the editing page. */
  const leaf = (c: ItemCell, cls = "") => {
    const e = el("div", cx("min-w-0", cls));
    e.style.height = `${frozen[c.item.id]?.box.h ?? 0}px`;
    boxes[c.item.id] = e;
    drawnAs[c.item.id] = c.as;
    return e;
  };
  const stackEl = (st: StackCell) => {
    const e = el("div", cx(stackClass(st.name, f), stackEditClass(st.name)));
    if (st.name === "happened") e.dataset.part = "happened";
    for (const c of st.items) e.appendChild(leaf(c));
    return e;
  };
  const cellEl = (c: Cell) => (c.cell === "item" ? leaf(c) : stackEl(c));

  const rows = rowsFor(items, f);
  rows.forEach((row, r) => {
    const rc = rowClass(row, f, r === 0);
    let root: HTMLElement;
    switch (row.row) {
      case "one": {
        const c = row.cell;
        if (c.cell === "item") root = leaf(c, rc);
        else if (stackIsRow(c.name)) {
          root = el("div", cx(rc, stackEditClass(c.name)));
          for (const x of c.items) root.appendChild(leaf(x));
        } else {
          root = el("div", rc);
          root.appendChild(stackEl(c));
        }
        break;
      }
      case "pair":
        root = el("div", rc);
        if (row.ratio === "found") root.dataset.found = "true";
        root.appendChild(cellEl(row.left));
        root.appendChild(cellEl(row.right));
        break;
      case "group":
        switch (row.of) {
          case "grid":
            root = el("ul", rc);
            root.dataset.part = "grid";
            for (const c of row.items) {
              const li = el("li", cellClass("grid"));
              li.style.setProperty("--r", String(c.item.kind === "image" ? imageRatio(c.item.s as SectionOf<"image">) : 4 / 3));
              li.appendChild(leaf(c));
              root.appendChild(li);
            }
            break;
          case "links":
            root = el("div", rc);
            for (const c of row.items) {
              const cell = el("div", cellClass("links"));
              cell.appendChild(leaf(c));
              root.appendChild(cell);
            }
            break;
          case "refs": {
            root = el("section", rc);
            const h = el("h3", "xp-label");
            h.textContent = FORMAT_COPY[f].refs ?? FORMAT_COPY[f].link;
            root.appendChild(h);
            const ul = el("ul", "mt-1");
            for (const c of row.items) {
              const li = el("li", cellClass("refs"));
              li.appendChild(leaf(c));
              ul.appendChild(li);
            }
            root.appendChild(ul);
            break;
          }
          default:
            root = el("div", rc);
            if (row.of === "figures") root.dataset.part = "figures";
            for (const c of row.items) root.appendChild(leaf(c));
        }
    }
    host.appendChild(root);
  });

  // Second pass: a box whose width changed takes the height it would roughly have at that width.
  const widths = items.map((it) => [it, boxes[it.id]?.getBoundingClientRect().width ?? 0] as const);
  for (const [it, w] of widths) {
    const was = frozen[it.id];
    const e = boxes[it.id];
    if (!was || !e || w < 1 || (Math.abs(w - was.box.w) < 1 && drawnAs[it.id] === was.as)) continue;
    e.style.height = `${Math.max(0, resized(it, was, drawnAs[it.id]!, w))}px`;
  }
  const origin = host.getBoundingClientRect();
  const out: Measured = {};
  for (const it of items) {
    const r = boxes[it.id]?.getBoundingClientRect();
    if (r) out[it.id] = { x: r.left - origin.left, y: r.top - origin.top, w: r.width, h: r.height };
  }
  return out;
}

/** A new block's stand-in page item, so the rows can place it as they would the real thing. */
export function draftItem(id: string, kind: PageItem["kind"], flowSteps: Extract<PageItem, { kind: "flow" }>["steps"]): PageItem {
  if (kind === "flow") return { id: "flow", kind: "flow", index: -1, steps: flowSteps };
  // Only its kind (and an image's shape and stage) is read: rowsFor and the sizes above.
  const s = { id, kind, ...(kind === "image" ? { fileId: "", alt: "", caption: [] } : {}) } as unknown as ContentSection;
  return { id, kind, index: -1, s };
}
