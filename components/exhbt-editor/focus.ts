"use client";

import { useEffect, type RefObject } from "react";

/*
 * The frame round the editor takes the focus. The app's layouts draw the page in <div id="main" tabIndex={-1}> (the
 * skip link's target), inside Astryx's AppShell, whose main region has tabIndex -1 of its own. So a click on the
 * page's margin focuses one of them, and Safari, which never gives a press on a button the focus, sends that press
 * to the nearest of them. Before the frame both left the focus on nothing, the body, and the editor was written for
 * that: the focus going nowhere left a menu open, and a focus on nothing let Undo or Escape take it.
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

/**
 * A press on the page that ends with the focus on an element round `root` (the frame) has that element let the focus
 * go, so it is on nothing, as the same press left it before the frame. Any press: one on #main outside the editor
 * (the team strip above it) leaves the focus there just as one on the editor's margin does. Once the skip link has
 * put the focus on #main, a press ends there too and lets go of it; the skip link itself, from the keyboard, makes no
 * press, so it still lands on #main.
 *
 * At the press's release, in capture, so before its click is handled (Undo reads where the focus is then), and not
 * while the browser is still handling the press: undoing its move of the focus in the focus event makes Chromium drop
 * the rest of the press, the start of a selection, and a drag across the page's words or a double-click on one
 * selected nothing. A touch's mousedown, which moves the focus, comes after its pointerup, so the release that counts
 * is mouseup's; a drag the browser takes over (selected words, a picture) ends with dragend instead.
 *
 * And the selection stays as the press left it. Safari takes the page's selection away whenever the focus goes to
 * nothing (WebKit's FocusController::setFocusedElement, clearSelectionIfNeeded), so it is put back; Chromium keeps it.
 */
export function useFrameLetsGo(root: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const letGo = () => {
      const r = root.current;
      const a = document.activeElement;
      if (!r || !(a instanceof HTMLElement) || a === r || !a.contains(r)) return;
      const s = document.getSelection();
      const kept = s && s.rangeCount > 0 ? { from: s.anchorNode, fromAt: s.anchorOffset, to: s.focusNode, toAt: s.focusOffset } : null;
      a.blur();
      if (s && kept?.from?.isConnected && kept.to?.isConnected && s.rangeCount === 0) s.setBaseAndExtent(kept.from, kept.fromAt, kept.to, kept.toAt);
    };
    document.addEventListener("mouseup", letGo, true);
    document.addEventListener("dragend", letGo, true);
    return () => {
      document.removeEventListener("mouseup", letGo, true);
      document.removeEventListener("dragend", letGo, true);
    };
  }, [root]);
}
