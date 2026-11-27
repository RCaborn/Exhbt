"use client";

import { memo, type ReactNode } from "react";
import { BlockText, InlineSpan, type PlainFieldProps } from "@/components/exhbt-editor/fields/InlineText";
import { useAtom } from "@/components/exhbt-editor/atom";
import type { HomeTextSlot } from "@/components/portfolio/home-ctx";
import { joinYear, splitYear } from "@/lib/portfolio-layout";
import { getAt } from "../paths";
import { usePortfolioApi, usePortfolioState, useRuntime } from "../runtime";
import { fieldId, IssueNote, issueId, useIssue } from "./issue";

/*
 * One line of plain text typed in the page's own type (decision 0031, "What is edited where"): the name,
 * the headline, where they are, a line of education. It draws the exhbt editor's own plain fields
 * (`BlockText` where the page sets the words on their own, `InlineSpan` where they flow among other
 * words), which have no box of their own and take the face, size, weight and spacing of whatever they
 * sit in, so nothing moves when one takes the focus. The words are written straight to the state by
 * their path; a line's two halves write the whole line.
 *
 * Memoised on plain values: a field draws again only when its own words, name or place change.
 */
export const TextField = memo(function TextField(s: HomeTextSlot): ReactNode {
  return s.part ? <LinePart {...s} part={s.part} /> : <Plain {...s} />;
});

function Plain({ path, value, label, placeholder, as, maxChars }: HomeTextSlot): ReactNode {
  const api = usePortfolioApi();
  const issue = useIssue(path);
  const id = fieldId(path);
  return <Field as={as} props={{ path, value, label, placeholder, id, maxChars, issue, onText: (t) => api.setAt(path, t) }} />;
}

/** The field in its own box, which holds its problem's message. Always the same wrapper, so a problem that comes and goes never puts a new field under the cursor. */
function Field({ as, part, props }: { as: HomeTextSlot["as"]; part?: string; props: PlainFieldProps }): ReactNode {
  return as === "inline" ? (
    <span className="xe-field-inline" data-part={part}>
      <InlineSpan {...props} />
      <IssueNote id={issueId(props.id)} text={props.issue} />
    </span>
  ) : (
    <span className="xe-field" data-part={part}>
      <BlockText {...props} />
      <IssueNote id={issueId(props.id)} text={props.issue} />
    </span>
  );
}

/**
 * One half of a line of education or experience: its words, or its year. The page stores a line as one
 * string ("BSc Data Science, University of Leeds, 2026") and draws it as two fields at one path, split
 * by `splitYear`; typing in either writes the whole line back with `joinYear`.
 *
 * The line as stored cannot hold a half exactly as it is typed: `joinYear` trims, and a year half-typed
 * ("20") reads back as part of the words. So while a line is being typed its two halves are kept as
 * typed beside the state (`rt.lines`), and each field shows its own half from there for as long as the
 * stored line is still the one those halves made. A line changed any other way (Undo, a line moved or
 * removed, another line now at this place) no longer matches, and the fields show what the page reads
 * from the stored line again.
 */
function LinePart({ path, value, label, placeholder, as, part, maxChars }: HomeTextSlot & { part: "label" | "year" }): ReactNode {
  const rt = useRuntime();
  const line = usePortfolioState((s) => {
    const v = getAt(s, path);
    return typeof v === "string" ? v : "";
  });
  const draft = useAtom(rt.lines, (d) => d[path]);
  const live = draft && draft.line === line ? draft : null;
  // The line's problem is about its words: it shows on that half.
  const issue = useIssue(path);
  const id = fieldId(path, part);

  function onText(t: string) {
    const split = splitYear(line);
    const now = live ?? { label: split.label, year: split.year ?? "", line };
    const next = { ...now, [part]: t };
    const joined = joinYear(next.label, next.year);
    rt.lines.set((d) => ({ ...d, [path]: { ...next, line: joined } }));
    rt.api.setAt(path, joined);
  }

  return <Field as={as} part={part} props={{ path, value: live ? live[part] : value, label, placeholder, id, maxChars, issue: part === "label" ? issue : "", onText }} />;
}
