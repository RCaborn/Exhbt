"use client";

import type { FieldPath } from "@/components/portfolio/page-ctx";

/*
 * "Things to fix" jumps to a field by its issue path (decision 0026, "Fields, and the path each one
 * has"): the element carrying exactly that data-path, or else the one carrying the longest prefix of
 * it. When what it finds is not a field, the cursor goes in the first field inside it, or the element
 * itself takes the focus. Then it tells whoever listens (`xe-jump`, with the path and where it landed).
 */

const FIELD = 'textarea, input:not([type=file]):not([type=hidden]), [contenteditable]:not([contenteditable="false"]), [role=textbox]';

const isField = (el: Element) => el.matches(FIELD);

/** The editing page's element for a path, by the exact path, then by shorter and shorter prefixes. */
export function targetOf(path: FieldPath, root: ParentNode = document): HTMLElement | null {
  const parts = path ? path.split(".") : [];
  for (let n = parts.length; n >= 0; n--) {
    const p = parts.slice(0, n).join(".");
    const el = root.querySelector<HTMLElement>(`[data-editor="page"] [data-path="${CSS.escape(p)}"]`);
    if (el) return el;
  }
  return null;
}

/** Scrolls to the field for an issue path and puts the cursor in it. */
export function jumpTo(path: FieldPath): void {
  const el = targetOf(path);
  if (!el) return;
  const field = isField(el) ? el : el.querySelector<HTMLElement>(FIELD);
  const target = field ?? el;
  if (!field && !target.hasAttribute("tabindex") && !target.matches("a[href], button, input, select, textarea")) target.tabIndex = -1;
  target.scrollIntoView({ block: "center" });
  target.focus({ preventScroll: true });
  target.dispatchEvent(new CustomEvent("xe-jump", { bubbles: true, detail: { path } }));
}
