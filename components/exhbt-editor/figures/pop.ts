"use client";

import { createElement, type ReactNode, type RefObject } from "react";

/*
 * The panels the chips open (a link's Web address, a picked figure's strip) are native popovers. Safari
 * has had them since 17, so an iPhone on iOS 16 or older has none: there the `popover` attribute means
 * nothing (the panel would be drawn all the time), `popovertarget` does nothing (the button would be
 * dead), and `showPopover()` and the `:popover-open` selector throw.
 *
 * Where the browser has no popovers the same panel is a <dialog>, opened as a modal one: it sits in the
 * top layer under its button just as the popover does (figures/anchor.ts places both), Escape and a
 * press outside it close it, and it tells of opening and closing with the popover's own events
 * (`beforetoggle`, `toggle`, each with `newState`), so nothing that listens for them needs to know.
 * The browser is asked whether it has popovers; its name is never read.
 */

/** Whether this browser has popovers. */
export const hasPopover = (): boolean => typeof HTMLElement !== "undefined" && "popover" in HTMLElement.prototype;

/** A panel: a popover, or a dialog where there are none. Its class is `xe-fig-pop` (css/figures.css), which the jump to a field looks for (jump.ts). */
export function Panel({ id, className, panelRef, children }: { id: string; className: string; panelRef: RefObject<HTMLElement | null>; children: ReactNode }) {
  return hasPopover() ? createElement("div", { ref: panelRef, id, className: `xe-fig-pop ${className}`, popover: "auto" }, children) : createElement("dialog", { ref: panelRef, id, className: `xe-fig-pop ${className}` }, children);
}

/** What its button needs to open it: the popover's own attribute, or a press handled here. */
export const opensPanel = (panelId: string, panel: () => HTMLElement | null): { popoverTarget?: string; "aria-haspopup"?: "dialog"; onClick?: () => void } =>
  hasPopover()
    ? { popoverTarget: panelId }
    : {
        "aria-haspopup": "dialog",
        onClick: () => {
          const p = panel();
          if (p) (isOpen(p) ? closePanel : openPanel)(p);
        },
      };

const isDialog = (el: HTMLElement): el is HTMLDialogElement => el instanceof HTMLDialogElement;

/** Whether a panel is open. */
export const isOpen = (panel: HTMLElement): boolean => (isDialog(panel) ? panel.open : panel.matches(":popover-open"));

/** Says what a popover would say of itself. */
function tell(panel: HTMLElement, type: "beforetoggle" | "toggle", newState: "open" | "closed") {
  panel.dispatchEvent(Object.assign(new Event(type), { newState, oldState: newState === "open" ? "closed" : "open" }));
}

/** Opens a panel, if it is closed. */
export function openPanel(panel: HTMLElement) {
  if (isOpen(panel)) return;
  if (!isDialog(panel)) return panel.showPopover();
  tell(panel, "beforetoggle", "open");
  panel.showModal();
  tell(panel, "toggle", "open");
}

/** Closes a panel, if it is open. */
export function closePanel(panel: HTMLElement) {
  if (!isOpen(panel)) return;
  if (isDialog(panel)) panel.close();
  else panel.hidePopover();
}

/**
 * For a panel that is a dialog: a press outside it closes it (the page behind a modal dialog is its
 * backdrop, and a press there lands on the dialog itself, outside its box), and its closing, however it
 * came about, is told as a popover's is. Returns the undoing. Nothing to do for a popover.
 */
export function watchPanel(panel: HTMLElement): () => void {
  if (!isDialog(panel)) return () => {};
  const onPress = (e: MouseEvent) => {
    if (e.target !== panel) return;
    const r = panel.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) panel.close();
  };
  const onClose = () => tell(panel, "toggle", "closed");
  panel.addEventListener("click", onPress);
  panel.addEventListener("close", onClose);
  return () => {
    panel.removeEventListener("click", onPress);
    panel.removeEventListener("close", onClose);
  };
}
