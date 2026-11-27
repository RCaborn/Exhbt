"use client";

import { useEffect, type RefObject } from "react";

/*
 * The frame round the editor takes the focus. The app's layouts draw the page in <div id="main" tabIndex={-1}> (the
 * skip link's target), inside Astryx's AppShell, whose main region has tabIndex -1 of its own. So a click on the
 * page's margin focuses one of them, and Safari, which never gives a press on a button the focus, sends that press
 * to the nearest of them. Before the frame both left the focus on nothing, the body, and the editor was written for
 * that: the focus going nowhere left a menu open, and a focus on nothing let Undo or Escape take it.
 *
 * So the editor reads an element round it as nowhere (`focusNowhere`), and a press inside it never leaves the focus
 * on the frame (`useFrameLetsGo`), whichever element the frame has: code drawn in the editor that still reads nowhere
 * as the body (the classic editor's BlockTools, in a toolbar's More actions) then sees what it saw before.
 */

/** Whether the focus at `el` (where it is, or where it is going) is nowhere for `part`: no element, the body, or an element round `part`. */
export function focusNowhere(el: EventTarget | null | undefined, part: Node | null | undefined): boolean {
  if (!el || el === document.body) return true;
  return Boolean(part && el instanceof Node && el !== part && el.contains(part));
}

/**
 * A press that starts inside `root` and puts the focus on an element round it (the frame) has that element let the
 * focus go, so it is on nothing, as the same press left it before the frame. In the focus event itself, before the
 * press's click is handled (Undo reads where the focus is then). Only for a press inside the editor: the skip link,
 * from the keyboard, still lands on #main; but a press inside the editor lets go of the frame that the skip link
 * focused, as the browser gives the focus no new event when the press would put it where it already is.
 */
export function useFrameLetsGo(root: RefObject<HTMLElement | null>) {
  useEffect(() => {
    let pressed = false;
    const frameHolds = (el: Element | null): el is HTMLElement => {
      const r = root.current;
      return Boolean(r && el instanceof HTMLElement && el !== r && el.contains(r));
    };
    const onDown = (e: MouseEvent) => {
      pressed = Boolean(root.current && e.target instanceof Node && root.current.contains(e.target));
      const a = document.activeElement;
      if (pressed && frameHolds(a)) a.blur();
    };
    // The first focus after the press is the press's own; whatever happens to the focus after that is not.
    const onFocus = (e: FocusEvent) => {
      if (!pressed) return;
      pressed = false;
      if (frameHolds(e.target as Element | null)) (e.target as HTMLElement).blur();
    };
    const onUp = () => {
      pressed = false;
    };
    document.addEventListener("mousedown", onDown, true);
    document.addEventListener("focusin", onFocus, true);
    document.addEventListener("mouseup", onUp, true);
    return () => {
      document.removeEventListener("mousedown", onDown, true);
      document.removeEventListener("focusin", onFocus, true);
      document.removeEventListener("mouseup", onUp, true);
    };
  }, [root]);
}
