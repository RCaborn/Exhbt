"use client";

import { useCallback, useSyncExternalStore } from "react";
import { issuesOf, useRuntime } from "../context";
import { useStoreInternal } from "../store";

/*
 * Issues on the page (decision 0026, "Issues"): a field with an issue at its path gets an outline in the
 * look's error colour (--xp-error), aria-invalid, and aria-describedby pointing at its message. The
 * message is visually hidden until the field has the focus, and then shows in a small box under the
 * field, over the page: never in the flow, because an over-limit issue shows while the person types
 * and a message in the flow would push the page down mid-word. Every message is also in "Things to fix".
 */

/** The messages worth showing now at exactly this path, joined by a space, or "" (a string, so a field re-renders only when its own issues change). */
export function useFieldIssue(path: string): string {
  const store = useStoreInternal();
  const { ui } = useRuntime();
  const subscribe = useCallback(
    (fn: () => void) => {
      const a = store.subscribe(fn);
      const b = ui.subscribe(fn);
      return () => {
        a();
        b();
      };
    },
    [store, ui],
  );
  const read = () =>
    issuesOf(store.get(), ui.get().tried)
      .shown.filter((i) => i.path === path)
      .map((i) => i.message)
      .join(" ");
  return useSyncExternalStore(subscribe, read, read);
}

/** The id a field's message carries. */
export const issueId = (fieldId: string) => `${fieldId}-issue`;

/** A field's message: there for screen readers always, shown under the field while it has the focus (css/core.css). */
export function IssueNote({ id, text }: { id: string; text: string }) {
  if (!text) return null;
  return (
    <span id={id} className="xe-issue" data-edit-only>
      {text}
    </span>
  );
}
