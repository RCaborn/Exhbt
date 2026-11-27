"use client";

import type { ReactNode } from "react";
import type { HomePath } from "@/components/portfolio/home-ctx";
import { usePortfolioUi } from "../runtime";

/*
 * A field's problem, on the page (decision 0031, "Saving": "the field has the look's error outline and
 * its message"). A field with a problem at its path gets an outline in the look's error colour,
 * aria-invalid, and aria-describedby pointing at its message. The message shows in a small box under
 * the field while the field has the focus, over the page and never in its flow: a problem shows while
 * the person types, and a message in the flow would push the page down mid-word. The classes are the
 * exhbt editor's (`xe-issue`, components/exhbt-editor/css/core.css), in the look's own variables.
 */

/** This path's problem, or "": a field draws again only when its own problem changes. */
export function useIssue(path: HomePath): string {
  return usePortfolioUi((u) => u.issues[path] ?? "");
}

/** A field's DOM id, from its path (and which half of a line it is). */
export const fieldId = (path: HomePath, part?: string) => `pe-${path.replace(/\./g, "-")}${part ? `-${part}` : ""}`;

/** The id a field's message carries: the exhbt editor's fields point at `<id>-issue`. */
export const issueId = (id: string) => `${id}-issue`;

/** A field's message: there for screen readers always, shown under the field while it has the focus. */
export function IssueNote({ id, text }: { id: string; text: string }): ReactNode {
  if (!text) return null;
  return (
    <span id={id} className="xe-issue" data-edit-only>
      {text}
    </span>
  );
}
