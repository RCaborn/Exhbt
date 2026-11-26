"use client";

import { useCallback } from "react";
import { flushSync } from "react-dom";
import { useLab } from "../LabFrame";

type StartViewTransition = (update: () => void) => { finished: Promise<void> };

/**
 * The maximal level's one kind of motion on this screen: a change drawn as a view transition, so
 * what moved is carried from where it was to where it lands (a tile opening into its exhbt, the
 * first-run page filling in). Everything else changes at once, as it does at the other levels.
 *
 * It runs only at maximal, only when `moves` (the lab's Motion off isn't set and the device hasn't
 * asked for less motion) and only where the browser has view transitions; otherwise the change is
 * made straight away. The elements that travel are named only while it runs (app.css, under
 * `:root[data-app-vt]`), so nothing else on the page is caught up in it.
 *
 * The transition's pseudo-elements hang off <html>, outside the lab's root, where the level's
 * timing tokens don't reach. So the level's slow duration and move curve are copied onto <html>
 * for as long as it runs, and taken off after.
 */
export function useMorph() {
  const { level, moves } = useLab();
  return useCallback(
    (update: () => void) => {
      const start = (document as Document & { startViewTransition?: StartViewTransition }).startViewTransition?.bind(document);
      if (level !== "maximal" || !moves || !start) {
        update();
        return;
      }
      const html = document.documentElement;
      const root = document.querySelector<HTMLElement>("[data-lab-root]");
      const tokens = root ? getComputedStyle(root) : null;
      html.style.setProperty("--app-vt-duration", tokens?.getPropertyValue("--duration-slow").trim() || "720ms");
      html.style.setProperty("--app-vt-ease", tokens?.getPropertyValue("--ease-move").trim() || "ease-out");
      html.setAttribute("data-app-vt", "");
      const done = () => {
        html.removeAttribute("data-app-vt");
        html.style.removeProperty("--app-vt-duration");
        html.style.removeProperty("--app-vt-ease");
      };
      try {
        start(() => flushSync(update)).finished.then(done, done);
      } catch {
        done();
        update();
      }
    },
    [level, moves],
  );
}
