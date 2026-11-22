"use client";

import { useEffect, type RefObject } from "react";

/*
 * A native popover (the `popover` attribute) placed under the button that opens it. A popover sits in
 * the top layer, where the browser centres it on the screen; this puts it under its button instead,
 * kept on the screen with a 16px margin, and keeps it there while the page scrolls (it is positioned
 * on the page, not the window) and when the window or the popover changes size. Placed before it
 * shows (`beforetoggle`), so it never flashes in the middle of the screen, and again once it has its
 * size. However it opens (its button, or the jump to an issue calling showPopover) it lands here.
 */

const MARGIN = 16;
const GAP = 6;

export function useAnchoredPopover(button: RefObject<HTMLElement | null>, popover: RefObject<HTMLElement | null>, align: "start" | "end" = "start") {
  useEffect(() => {
    const pop = popover.current;
    if (!pop) return;
    const place = () => {
      const b = button.current;
      if (!b) return;
      const r = b.getBoundingClientRect();
      const width = pop.offsetWidth;
      const room = document.documentElement.clientWidth;
      const want = align === "end" ? r.right - width : r.left;
      const left = Math.max(MARGIN, Math.min(want, room - width - MARGIN));
      pop.style.left = `${Math.round(left + window.scrollX)}px`;
      pop.style.top = `${Math.round(r.bottom + GAP + window.scrollY)}px`;
    };
    const open = () => pop.matches(":popover-open");
    const onBefore = (e: Event) => {
      if ((e as ToggleEvent).newState === "open") place();
    };
    const onToggle = (e: Event) => {
      if ((e as ToggleEvent).newState === "open") place();
    };
    const onResize = () => open() && place();
    const sized = new ResizeObserver(onResize);
    sized.observe(pop);
    pop.addEventListener("beforetoggle", onBefore);
    pop.addEventListener("toggle", onToggle);
    window.addEventListener("resize", onResize);
    return () => {
      sized.disconnect();
      pop.removeEventListener("beforetoggle", onBefore);
      pop.removeEventListener("toggle", onToggle);
      window.removeEventListener("resize", onResize);
    };
  }, [button, popover, align]);
}
