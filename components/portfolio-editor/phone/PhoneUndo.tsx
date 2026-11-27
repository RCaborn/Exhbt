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

/** What counts as the next action: a press of any kind (a finger, a mouse, a click made by code) or a key. */
const ACTS = ["pointerdown", "touchstart", "mousedown", "click", "keydown"] as const;

/** The toast showing now, and how to take it away. */
let shown: { label: string; dismiss(): void; stop(): void } | null = null;

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Offers Undo for the change just made, if it made an Undo step. Call it after the change. */
export function useOfferUndo(): () => void {
  const rt = useRuntime();
  const toast = useToast();
  return () => {
    const label = rt.undo.get().label;
    // One at a time: the last one goes before a new one shows (not by Astryx's uniqueID, whose namesake
    // keeps the first toast's id, so the new one's dismiss would not reach it).
    shown?.stop();
    shown?.dismiss();
    shown = null;
    if (!label) return;
    /** The toast's card, made invisible at once when it goes (its own exit still runs, unseen): Astryx's leaving toast stays on the screen if a
     * modal sheet (the bar's menu under a finger) opens while it leaves. */
    let card: HTMLElement | null = null;
    const undo = () => {
      take();
      rt.undoLast();
    };
    const dismiss = toast({
      body: cap(label),
      isAutoHide: false,
      endContent: (
        <span ref={(el) => void (card = el?.closest<HTMLElement>(".astryx-toast") ?? card)}>
          <Button size="sm" label={`Undo: ${label}`} onClick={undo}>
            Undo
          </Button>
        </span>
      ),
    });
    const take = () => {
      stop();
      if (card) card.style.visibility = "hidden";
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
      for (const type of ACTS) document.addEventListener(type, onAct, true);
    }, 0);
    const stop = () => {
      clearTimeout(timer);
      off();
      for (const type of ACTS) document.removeEventListener(type, onAct, true);
    };
    shown = { label, dismiss, stop };
  };
}
