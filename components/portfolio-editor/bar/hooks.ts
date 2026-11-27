"use client";

import { useRef, useSyncExternalStore, type MouseEvent } from "react";
import { useNarrow } from "@/components/exhbt-editor/topbar/Popover";
import { usePortfolioApi, usePortfolioData, usePortfolioState, usePortfolioUi, type PortfolioSheet } from "../runtime";
import { takeFocus } from "../runtime-core";
import { useLive } from "../ui/SaveStatus";

export { useNarrow };

const COARSE = "(pointer: coarse)";
const subscribeCoarse = (fn: () => void) => {
  const m = window.matchMedia(COARSE);
  m.addEventListener("change", fn);
  return () => m.removeEventListener("change", fn);
};

/** A finger is the pointer: every control of the bar is then 44px (Astryx's md), not 36px. */
export function useCoarse(): boolean {
  return useSyncExternalStore(
    subscribeCoarse,
    () => window.matchMedia(COARSE).matches,
    () => false,
  );
}

/** The size the bar's controls take: Astryx's sm under a mouse, md (44px) under a finger. */
export function useBarSize(): "sm" | "md" {
  return useCoarse() ? "md" : "sm";
}

/**
 * A button that opens one of the runtime's popovers (`ui.sheet === name`): Look and Job links in the bar, Your links
 * on Get in touch. Astryx's Popover notes where the focus is in its own click listener on the button, to give it back
 * there when it closes, before its onOpenChange reaches `open`. So the button takes the focus in the click's capture
 * phase, before that listener runs (takeFocus: Safari gives a pressed button none), and is the trigger `open` is
 * given. Spread `press` onto the button the Popover wraps; `open` and `onOpenChange` are the Popover's.
 */
export function usePopoverOpener(name: PortfolioSheet) {
  const api = usePortfolioApi();
  const open = usePortfolioUi((u) => u.sheet === name);
  const trigger = useRef<HTMLElement | null>(null);
  return {
    open,
    onOpenChange: (next: boolean) => (next ? api.open(name, trigger.current) : open && api.close()),
    // An object, not the Button's own props: components/ui/Button.tsx passes it through to Astryx's Button.
    press: {
      onClickCapture: (e: MouseEvent<HTMLElement>) => {
        trigger.current = e.currentTarget;
        takeFocus(e.currentTarget);
      },
    } as object,
  };
}

/**
 * Where the page stands for visitors (decision 0031, "A returning person"), as the chip says it:
 * "live" (visitors can see it), "offline" (a public plan with no address yet, or nothing listed on it),
 * "preview" (the plan has no public page).
 */
export type Standing = "live" | "offline" | "preview";

export function useStanding(): Standing {
  const data = usePortfolioData();
  const live = useLive();
  if (!data.visitor.publicPlan) return "preview";
  return live ? "live" : "offline";
}

/** How many of the person's published exhbts are listed on the page now (not hidden). */
export function useListedLive(): number {
  const data = usePortfolioData();
  const hidden = usePortfolioState((s) => s.arrangement.hidden);
  return data.visitor.published.filter((p) => !hidden.includes(p.id)).length;
}
