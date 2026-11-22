"use client";

import { useSyncExternalStore } from "react";

/**
 * A phone, for the editor (decision 0026, "On a phone"): a window under 48rem wide with a coarse
 * pointer. The one test, used in code here and in css/phone.css.
 */
export const PHONE = "(max-width: 47.99rem) and (pointer: coarse)";

const subscribe = (fn: () => void) => {
  const m = window.matchMedia(PHONE);
  m.addEventListener("change", fn);
  return () => m.removeEventListener("change", fn);
};

/** Whether the editor is on a phone now (a phone turned sideways is not one). */
export function usePhone(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(PHONE).matches,
    () => false,
  );
}
