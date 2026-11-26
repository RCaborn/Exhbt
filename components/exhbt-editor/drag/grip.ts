import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from "react";

/*
 * A grip pressed with a mouse keeps the focus, in every browser: a section's (drag/engine.ts) and a flowchart box's
 * (flow/FlowBox.tsx). Their tools show on hover or while the focus is in them (css/core.css, css/flow.css).
 *
 * Safari never focuses a pressed button: the focus goes to whatever round it takes a press (a flowchart's list) or
 * leaves whatever had it. And Safari's engine can lose the hover of something a drop has moved in the page under the
 * pointer, until the pointer leaves it. With neither, the tools hid under the pointer: after a click on a box's grip with
 * no drag, or a section's, a press where the grip had been went to the words under it. Chromium and Firefox focus the
 * pressed grip, so there this changes nothing. A finger's press is left as it was: a tap's mousedown comes after its
 * pointerdown, which says it was a touch. See docs/briefs/edit-on-page/r3-notes-from-earlier-agents.md.
 */

/** What last pressed each grip: "mouse", "pen" or "touch". A pointerdown always comes before the mousedown it leads to. */
const pressedBy = new WeakMap<Element, string>();

/** A grip's pointerdown: notes what is pressing it. */
export function notePointer(e: ReactPointerEvent<HTMLElement>) {
  pressedBy.set(e.currentTarget, e.pointerType);
}

/**
 * A grip's mousedown, called after its drag sensor has heard the press (dnd-kit leaves alone a press already prevented):
 * pressed by a mouse's main button, the grip takes the focus, and the browser's own move of the focus is stopped.
 */
export function holdFocus(e: ReactMouseEvent<HTMLElement>) {
  const grip = e.currentTarget;
  if (e.button !== 0 || pressedBy.get(grip) !== "mouse") return;
  e.preventDefault();
  if (document.activeElement !== grip) grip.focus({ preventScroll: true });
}
