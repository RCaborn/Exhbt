"use client";

import type { ReactNode } from "react";
import { useToast } from "@astryxdesign/core/Toast";

/**
 * Toasts from anywhere. `say("Link copied")` is a passing confirmation; `sayWith(...)` stays until dismissed,
 * because a toast that holds an action must not vanish under the pointer; `fail` is an error that stays too.
 * useToast mounts its own viewport when no layer provider is above it, so no provider is needed.
 */
export function useSay(): { say(message: string): void; sayWith(message: string, action: ReactNode): void; fail(message: string): void } {
  const show = useToast();
  return {
    say: (message) => void show({ body: message }),
    sayWith: (message, action) => void show({ body: message, endContent: action, isAutoHide: false }),
    fail: (message) => void show({ body: message, type: "error", isAutoHide: false }),
  };
}
