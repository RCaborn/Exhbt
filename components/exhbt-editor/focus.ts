"use client";

import { useEffect, type RefObject } from "react";

/*
 * The frame round the editor takes the focus. The app's layouts draw the page in <div id="main" tabIndex={-1}> (the
 * skip link's target), inside Astryx's AppShell, whose main region has tabIndex -1 of its own. So a click on the page's
 * margin focuses one of them. Safari gives a pressed button the focus only when the button has a tabindex of its own
 * (WebKit's HTMLFormControlElement::isMouseFocusable), and otherwise gives it to the nearest element round the button
 * that takes one (EventHandler::dispatchMouseEvent walks up from the pressed element), so a press on a button in the
 * editor can focus the frame too. Before the frame both left the focus on nothing, the body, and the editor was written
 * for that: the focus going nowhere left a menu open, and a focus on nothing let Undo or Escape take it.
 *
 * So the editor reads an element round it as nowhere (`focusNowhere`), and no press on the page ends with the focus
 * on the frame (`useFrameLetsGo`), whichever element the frame has: code drawn in the editor that still reads nowhere
 * as the body (the classic editor's BlockTools, in a toolbar's More actions) then sees what it saw before. While the
 * press is held the frame does have the focus, so what reads the focus then (a menu's blur, a panel's focusin) asks
 * `focusNowhere`.
 */

/** Whether the focus at `el` (where it is, or where it is going) is nowhere for `part`: no element, the body, or an element round `part`. */
export function focusNowhere(el: EventTarget | null | undefined, part: Node | null | undefined): boolean {
  if (!el || el === document.body) return true;
  return Boolean(part && el instanceof Node && el !== part && el.contains(part));
}

/** Whether `node` is inside a formatted field (an element the person can type in: contenteditable). */
const inField = (node: Node | null): boolean => {
  const el = node instanceof Element ? node : (node?.parentElement ?? null);
  return el instanceof HTMLElement && el.isContentEditable;
};

/**
 * A press on the page that ends with the focus on an element round `root` (the frame) has that element let the focus
 * go, so it is on nothing, as the same press left it before the frame. Any press: one on #main outside the editor
 * (the team strip above it) leaves the focus there just as one on the editor's margin does. Once the skip link has
 * put the focus on #main, a press ends there too and lets go of it; the skip link itself, from the keyboard, makes no
 * press, so it still lands on #main. A press that leaves the focus on nothing already has nothing to let go.
 *
 * At the press's release, in capture, so before its click is handled (Undo reads where the focus is then), and not
 * while the browser is still handling the press: undoing its move of the focus in the focus event made Chromium drop
 * the rest of the press, the start of a selection, and a drag across the page's words or a double-click on one
 * selected nothing. A touch's mousedown, which moves the focus, comes after its pointerup, so the release that counts
 * is mouseup's; a drag the browser takes over (selected words, a picture) ends with dragend instead.
 *
 * And the selection stays as the press left it. In WebKit, blur() puts the focus on nothing through
 * FocusController::setFocusedElement, whose clearSelectionIfNeeded decides whether the selection goes too. After a
 * press, which is when the frame lets go, it keeps the selection when the pressed element cannot start one: a press on
 * a button keeps it (HTMLButtonElement::canStartSelection is false), unless it is in an input or a textarea. After a
 * press that can start one, as a drag across the page's words or a double-click on one is, it takes a selection in the
 * page's words away, and that is the selection put back here, from where it began and ended before the blur. A
 * selection in a formatted field (contenteditable) is kept after any press from WebKit 625; in WebKit 624 and before, a
 * press that can start a selection takes it away as well. Chromium kept the selection in every case tried when the
 * focus went to nothing (Chromium 153, 27 Nov 2026: the page's words, a formatted field, an input and a textarea), so
 * there nothing is put back.
 *
 * A selection is put back only in the page's words, never with either end in a formatted field: there, putting it
 * back would move the focus into the field (WebKit's FrameSelection::setFocusedElementIfNeeded focuses the editable
 * element a new selection is in, and Chromium does the same), which is the opposite of letting it go.
 */
export function useFrameLetsGo(root: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const letGo = () => {
      const r = root.current;
      const a = document.activeElement;
      if (!r || !(a instanceof HTMLElement) || a === document.body || a === r || !a.contains(r)) return;
      const s = document.getSelection();
      const kept = s && s.rangeCount > 0 ? { from: s.anchorNode, fromAt: s.anchorOffset, to: s.focusNode, toAt: s.focusOffset } : null;
      a.blur();
      if (!s || !kept?.from?.isConnected || !kept.to?.isConnected || s.rangeCount !== 0) return;
      if (inField(kept.from) || inField(kept.to)) return;
      s.setBaseAndExtent(kept.from, kept.fromAt, kept.to, kept.toAt);
    };
    document.addEventListener("mouseup", letGo, true);
    document.addEventListener("dragend", letGo, true);
    return () => {
      document.removeEventListener("mouseup", letGo, true);
      document.removeEventListener("dragend", letGo, true);
    };
  }, [root]);
}
