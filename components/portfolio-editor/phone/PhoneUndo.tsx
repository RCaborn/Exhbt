"use client";

import { useToast } from "@astryxdesign/core/Toast";
import { Button } from "@/components/ui/Button";
import { useRuntime } from "../runtime";

/*
 * A phone's one-tap way back (brief I, step 1). Under 48rem the bar keeps Undo in its menu (brief G), so
 * after a move, a remove, a hide or a star from a More sheet, a short
 * notice with Undo shows at the foot of the screen: the editor's own toast (Astryx's, in the viewport
 * PortfolioEditor.tsx draws), named for what it undoes. It stays until the next action (the next press or
 * key anywhere else, or the next change), not on a timer, so it is never gone before a thumb gets there.
 * A row of the bar was not used: at 320 the bar has no room for one more 44px button.
 */

export const UNDO_TOAST = "pe-phone-undo";

/** The toast showing now, and how to take it away. */
let shown: { label: string; dismiss(): void; stop(): void } | null = null;

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Offers Undo for the change just made, if it made an Undo step. Call it after the change. */
export function useOfferUndo(): () => void {
  const rt = useRuntime();
  const toast = useToast();
  return () => {
    const label = rt.undo.get().label;
    shown?.stop();
    if (!label) {
      shown?.dismiss();
      shown = null;
      return;
    }
    const undo = () => {
      take();
      rt.undoLast();
    };
    const dismiss = toast({
      body: cap(label),
      uniqueID: UNDO_TOAST,
      isAutoHide: false,
      endContent: (
        <Button size="sm" label={`Undo: ${label}`} onClick={undo}>
          Undo
        </Button>
      ),
    });
    const take = () => {
      stop();
      dismiss();
      if (shown?.dismiss === dismiss) shown = null;
    };
    // The next action ends it: a press or a key outside it, or another change to the Undo stack.
    const onAct = (e: Event) => {
      const t = e.target as Element | null;
      if (t?.closest?.(".astryx-toast")) return;
      take();
    };
    const off = rt.undo.subscribe(() => {
      if (rt.undo.get().label !== label) take();
    });
    // From the next event on: the press that made this change is still being handled.
    const timer = setTimeout(() => {
      document.addEventListener("pointerdown", onAct, true);
      document.addEventListener("keydown", onAct, true);
    }, 0);
    const stop = () => {
      clearTimeout(timer);
      off();
      document.removeEventListener("pointerdown", onAct, true);
      document.removeEventListener("keydown", onAct, true);
    };
    shown = { label, dismiss, stop };
  };
}
