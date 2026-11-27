"use client";

import { memo, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import type { TitleSlot } from "@/components/portfolio/page-ctx";
import { LIMITS } from "@/lib/exhbt/blocks";
import { useFieldPath } from "../Frame";
import { useDoc, useStore } from "../store";
import { BlockText } from "./InlineText";
import { IssueNote, issueId, useFieldIssue } from "./issues";

/*
 * A part's title, typed in place (decision 0032; Rory, 26 Nov 2026: "customisability in box titling"): a
 * section's heading, the flowchart's, or the heading over a list of links. It is the heading's own element
 * and classes with a plain one-line field in it, so it sits exactly where the visitor's heading sits.
 *
 * What is stored at `path` ("sections.N.title", "flowTitle", "refsTitle"), and what shows:
 *  - nothing stored: the layout's own heading (`fallback`), as words in the field. It follows a layout switch;
 *  - the person's words: theirs, kept through a switch. Typing the layout's own words again stores nothing,
 *    so the heading follows the layout once more;
 *  - "": cleared. A visitor sees no heading; here a faint "Add a title" keeps its place, so it can come back.
 *
 * It reads the title from the store itself, so the unit that draws it (a section's frame, the flowchart, or
 * the shell for a list of links) does not draw again for each letter.
 *
 * A case study draws no heading over its flowchart (`fallback` is ""). A placeholder there would sit on
 * every case study, so the way in is a small "Add a title" over the flowchart's top edge, out of the flow
 * like the aim's switch; pressed, it puts the field in the flow, and a title left empty takes it out again.
 */

const valueAt = (root: unknown, path: string): unknown => path.split(".").reduce<unknown>((v, k) => (v && typeof v === "object" ? (v as Record<string, unknown>)[k] : undefined), root);

export const PLACEHOLDER = "Add a title";

export const TitleField = memo(function TitleField({ path: given, fallback, label, Sub, id, className }: TitleSlot) {
  // Inside a frame, the path takes the frame's index in doc.sections now (Frame.tsx).
  const path = useFieldPath(given);
  const store = useStore();
  const stored = useDoc((d) => {
    const v = valueAt(d, path);
    return typeof v === "string" ? v : undefined;
  });
  const issue = useFieldIssue(path);
  // Where the layout draws no heading: whether the field has been asked for and not yet typed in.
  const [asked, setAsked] = useState(false);
  const fieldId = path.replace(/\./g, "-");
  useEffect(() => {
    if (asked) document.getElementById(fieldId)?.focus();
  }, [asked, fieldId]);

  if (!fallback && stored === undefined && !asked) {
    return (
      <span className="xe-above xe-title-add" data-edit-only>
        <button type="button" className="xe-chip" aria-label={`${label.replace(/: title$/, "")}: add a title`} onClick={() => setAsked(true)}>
          <Plus aria-hidden size={14} strokeWidth={2.5} /> {PLACEHOLDER}
        </button>
      </span>
    );
  }

  const value = stored ?? fallback;
  return (
    // Cleared, it is no heading for a screen reader either: the field in it says what it is for. Its data-title is the path
    // as it is now, like every other attribute here: the given one carries the frame's stand-in index (Frame.tsx, FRAME_AT).
    <Sub id={id} className={className} role={value.trim() ? undefined : "none"} data-title={path}>
      <span className="xe-field">
        <BlockText
          path={path}
          value={value}
          label={label}
          placeholder={PLACEHOLDER}
          id={fieldId}
          maxChars={LIMITS.sectionTitleChars}
          issue={issue}
          // The layout's own words again: nothing is stored, and the heading follows the layout.
          onText={(t) => (fallback && t === fallback ? store.unsetAt(path) : store.setAt(path, t))}
          onBlur={() => {
            if (fallback) return;
            // No heading of the layout's own to fall back on: a title left empty is no title, and its line goes.
            if (!(stored ?? "").trim()) store.unsetAt(path);
            setAsked(false);
          }}
        />
        <IssueNote id={issueId(fieldId)} text={issue} />
      </span>
    </Sub>
  );
});
