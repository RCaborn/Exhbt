"use client";

import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { RichText } from "@/components/exhbt/RichText";
import type { RichSlot } from "@/components/portfolio/page-ctx";
import type { RichText as RichTextValue } from "@/lib/exhbt/blocks";
import { MUTED } from "../geometry";
import { enqueueEditor } from "./idle";
import { IssueNote, issueId, useFieldIssue } from "./issues";

/*
 * Formatted text typed in the page's own type (decision 0026, "Typing in the page's own type"): bold,
 * italic and https links, or the context line's highlight, stored as runs. Tiptap's wrapper is a
 * <div>, which cannot go in a <p>, so where the page draws a <p> this field is a <div> with the
 * paragraph's classes (`className`); where the page keeps its own element (a finding's <li>, a
 * caption's <figcaption>), the field goes inside it.
 *
 * Until its editor exists the field is drawn as the page draws it, and is a focusable, named textbox.
 * Editors are made one at a time in idle moments after the page is up (idle.ts), and at once for a
 * field that is clicked or focused, with the cursor where it was clicked. The editor (RichEditor.tsx)
 * is its own chunk, with Tiptap's stylesheet off. Nothing moves in the swap.
 */

const RichEditor = lazy(() => import("./RichEditor"));

const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(" ");
export const hasWords = (rt: RichTextValue) => rt.some((r) => r.t.trim());

/** The words as the page draws them, or the placeholder in --xp-muted. */
export function StaticRich({ value, placeholder, highlight }: { value: RichTextValue; placeholder: string; highlight?: boolean }) {
  return hasWords(value) ? <RichText value={value} highlight={highlight} /> : <span style={MUTED}>{placeholder}</span>;
}

/** Why the editor was started: in an idle moment (it must not take the focus), or by the person. */
type Start = false | "idle" | "person";

export function RichField(o: RichSlot) {
  const [start, setStart] = useState<Start>(false);
  const [ready, setReady] = useState(false);
  const at = useRef<{ x: number; y: number } | null>(null);
  const readyWaiters = useRef<(() => void)[]>([]);
  const id = o.path.replace(/\./g, "-");
  const issue = useFieldIssue(o.path);
  const shown = <StaticRich value={o.value} placeholder={o.placeholder} highlight={o.highlight} />;
  const empty = !hasWords(o.value);

  // In the queue for an idle moment; out of it once started.
  useEffect(() => {
    if (start) return;
    return enqueueEditor(
      () =>
        new Promise<void>((done) => {
          readyWaiters.current.push(done);
          setStart((s) => s || "idle");
        }),
    );
  }, [start]);

  const onReady = () => {
    setReady(true);
    for (const done of readyWaiters.current.splice(0)) done();
  };

  return (
    <div
      className={cx(o.className, "xe-rich")}
      data-path={o.path}
      data-field="rich"
      data-empty={empty || undefined}
      data-live={ready || undefined}
      data-invalid={issue ? "" : undefined}
      // Until the editor exists, this element is the field.
      {...(ready
        ? {}
        : {
            id,
            role: "textbox",
            tabIndex: 0,
            "aria-label": o.label,
            "aria-multiline": true,
            "aria-placeholder": o.placeholder,
            "aria-invalid": issue ? true : undefined,
            "aria-describedby": issue ? issueId(id) : undefined,
            onFocus: () => setStart("person"),
            onPointerDown: (e: React.PointerEvent) => {
              at.current = { x: e.clientX, y: e.clientY };
            },
          })}
      // Nothing navigates in the editor: a link in the words is words.
      onClickCapture={(e) => {
        if ((e.target as Element).closest("a")) e.preventDefault();
      }}
    >
      {start ? (
        <Suspense fallback={shown}>
          <RichEditor slot={o} id={id} at={at} focusOnReady={start === "person"} issue={issue} onReady={onReady} fallback={shown} />
        </Suspense>
      ) : (
        shown
      )}
      <IssueNote id={issueId(id)} text={issue} />
    </div>
  );
}
