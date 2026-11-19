"use client";

import type { FieldPath } from "@/components/portfolio/page-ctx";
import type { ExhbtDoc } from "@/lib/exhbt/blocks";
import type { SheetName, UiApi } from "./context";

/*
 * "Things to fix" jumps to a field by its issue path (decision 0026, "Fields, and the path each one
 * has", and "What the page does not draw"):
 *  - a path whose field lives in a sheet opens that sheet first: `summary` and `headline` the card's,
 *    `evidence` the work's, `sections.N.chart` and anything under it the chart sheet for that graph;
 *  - then the element carrying exactly that data-path, or else the one carrying the longest prefix of
 *    it (looked for in the sheet when one was opened). The anchors for paths with no field of their
 *    own: `""` the word bar (H's), `sections` the "+" at the end (F's), `flow` the flowchart's list
 *    (K's), `skills` the skills block, `sections.N.items` a findings list's "Add a finding", and
 *    `sections.N` the section's frame;
 *  - a field inside a closed native popover (a link's address) opens the popover first;
 *  - when what it lands on is not a field, the cursor goes in the first field inside it, or the
 *    element itself takes the focus;
 *  - it then dispatches `xe-jump` (bubbling, with the path) on what it landed on: F's end "+" opens its
 *    menu on it.
 */

const FIELD = 'textarea, input:not([type=file]):not([type=hidden]):not([type=checkbox]):not([type=radio]), [contenteditable]:not([contenteditable="false"]), [role=textbox]';

const isField = (el: Element) => el.matches(FIELD);

/** The sheet a path's field lives in, if it lives in one. */
export function sheetOf(path: FieldPath, doc: ExhbtDoc): { name: SheetName; sectionId?: string } | null {
  const [head, n, field] = path.split(".");
  if (head === "summary" || head === "headline") return { name: "card" };
  if (head === "evidence") return { name: "work" };
  if (head === "sections" && n !== undefined && field === "chart") {
    const s = doc.sections[Number(n)];
    if (s?.kind === "graph") return { name: "chart", sectionId: s.id };
  }
  return null;
}

/** The element for a path, by the exact path, then by shorter and shorter prefixes, inside `root`. */
export function targetOf(path: FieldPath, root: ParentNode = document.querySelector('[data-editor="page"]') ?? document): HTMLElement | null {
  const parts = path ? path.split(".") : [];
  for (let n = parts.length; n >= 0; n--) {
    const el = root.querySelector<HTMLElement>(`[data-path="${CSS.escape(parts.slice(0, n).join("."))}"]`);
    if (el) return el;
  }
  return null;
}

/** Puts the cursor in the field at (or inside) `el`, opening the popover it sits in first. */
function land(el: HTMLElement, path: FieldPath) {
  const field = isField(el) ? el : el.querySelector<HTMLElement>(FIELD);
  const target = field ?? el;
  const pop = target.closest<HTMLElement>("[popover]");
  if (pop && !pop.matches(":popover-open")) pop.showPopover();
  if (!field && !target.hasAttribute("tabindex") && !target.matches("a[href], button, input, select, textarea")) target.tabIndex = -1;
  target.scrollIntoView({ block: "center" });
  target.focus({ preventScroll: true });
  target.dispatchEvent(new CustomEvent("xe-jump", { bubbles: true, detail: { path } }));
}

/** Scrolls to the field for an issue path and puts the cursor in it, opening its sheet or popover first when it lives in one. */
export function jumpTo(path: FieldPath, ui?: UiApi, doc?: ExhbtDoc): void {
  const sheet = doc ? sheetOf(path, doc) : null;
  if (!sheet || !ui) {
    const el = targetOf(path);
    if (el) land(el, path);
    return;
  }
  ui.open(sheet.name, sheet.sectionId);
  // The sheet draws its fields once it is open: look in it, frame by frame, for up to a second.
  let tries = 0;
  const look = () => {
    const dialog = document.querySelector<HTMLDialogElement>(`dialog[data-sheet="${sheet.name}"][open]`);
    const el = dialog && (targetOf(path, dialog) ?? dialog.querySelector<HTMLElement>(FIELD));
    if (el) return land(el, path);
    if (++tries < 60) requestAnimationFrame(look);
    else if (dialog) land(dialog.querySelector<HTMLElement>("h2") ?? dialog, path);
  };
  requestAnimationFrame(look);
}
