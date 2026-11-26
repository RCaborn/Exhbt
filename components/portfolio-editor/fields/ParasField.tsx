"use client";

import { memo, useContext, useLayoutEffect, useRef, useSyncExternalStore, type KeyboardEvent, type ReactNode } from "react";
import { GrowContext } from "@/components/exhbt-editor/fields/InlineText";
import type { HomeParasSlot } from "@/components/portfolio/home-ctx";
import { usePortfolioApi } from "../runtime";
import { fieldId, IssueNote, issueId, useIssue } from "./issue";

/*
 * Paragraphs typed in the page's own type (decision 0031, "What is edited where": the intro, and About
 * me's words). The visitor's page draws each paragraph as a <p>; here each is a field of its own in that
 * paragraph's place, with the paragraph's classes, in the same `xe-text` style as every other plain
 * field: no box of its own, as tall as its words, and an outline for a focus ring, so nothing moves when
 * it takes the focus.
 *
 * Enter starts a new paragraph where the cursor is; Backspace at the start of one joins it to the one
 * before, Delete at the end to the one after; the arrow keys walk from one to the next. The stored text
 * is the paragraphs with one blank line between them, exactly, so what is on screen is always what the
 * state holds (an empty paragraph just started is two blank lines in a row; saving drops it).
 *
 * About me's words are one paragraph: the visitor's page draws them as one, and the server keeps them
 * as one line (`TilesSchema`), so there Enter does nothing and a pasted line break becomes a space.
 *
 * The paragraphs sit in a group that takes no box of its own (`display: contents`), so they are the
 * children of whatever the page put them in, as the <p>s are. The group carries the field's path and
 * name; each paragraph's field says which one it is.
 *
 * Each field's own box is a <p>, as the visitor's paragraph is, and not for tidiness: the site's reset
 * gives every <p> the body's size and line height unless its own classes say otherwise, so the intro's
 * paragraphs are set smaller than the box they sit in. A field in any other element would take the
 * box's larger type and stand taller than the page a visitor gets.
 */

/** The break between two paragraphs in the stored text. */
const BREAK = "\n\n";
/** Only the intro takes more than one paragraph. */
const MULTI = new Set(["profile.bio"]);

const noSub = () => () => {};

export const ParasField = memo(function ParasField({ path, value, label, placeholder, paraClass }: HomeParasSlot): ReactNode {
  const api = usePortfolioApi();
  const issue = useIssue(path);
  const multi = MULTI.has(path);
  const forced = useContext(GrowContext);
  const supported = useSyncExternalStore(
    noSub,
    () => typeof CSS !== "undefined" && CSS.supports("field-sizing", "content"),
    () => true,
  );
  const mirror = forced === "mirror" || !supported;
  const group = useRef<HTMLDivElement>(null);
  // Where the cursor goes once the paragraphs have been drawn again: a paragraph and a place in it.
  const want = useRef<{ i: number; at: number } | null>(null);
  const paras = multi ? value.split(BREAK) : [value];
  const id = fieldId(path);

  useLayoutEffect(() => {
    const w = want.current;
    if (!w) return;
    want.current = null;
    const el = group.current?.querySelectorAll<HTMLTextAreaElement>("textarea[data-para]")[w.i];
    if (!el) return;
    el.focus();
    el.setSelectionRange(w.at, w.at);
  });

  const write = (next: string[], cursor?: { i: number; at: number }) => {
    if (cursor) want.current = cursor;
    api.setAt(path, next.join(BREAK));
  };
  const replace = (i: number, ...put: string[]) => [...paras.slice(0, i), ...put, ...paras.slice(i + 1)];
  const go = (i: number, at: number) => {
    const el = group.current?.querySelectorAll<HTMLTextAreaElement>("textarea[data-para]")[i];
    if (!el) return;
    el.focus();
    el.setSelectionRange(at, at);
  };

  function onChange(i: number, el: HTMLTextAreaElement) {
    const t = el.value.replace(/\r/g, "");
    if (!t.includes("\n")) return write(replace(i, t));
    // Pasted lines: each is a paragraph of its own in the intro, and a space apart anywhere else.
    if (!multi) return write([t.replace(/\n+/g, " ")]);
    const caret = el.selectionStart ?? t.length;
    const before = t.slice(0, caret).split(/\n+/);
    const after = t.slice(caret).split(/\n+/);
    const joint = before[before.length - 1]! + after[0]!;
    write(replace(i, ...before.slice(0, -1), joint, ...after.slice(1)), { i: i + before.length - 1, at: before[before.length - 1]!.length });
  }

  function onKeyDown(i: number, e: KeyboardEvent<HTMLTextAreaElement>) {
    const el = e.currentTarget;
    const p = paras[i]!;
    const a = el.selectionStart ?? 0;
    const b = el.selectionEnd ?? a;
    const plain = !e.shiftKey && !e.altKey && !e.ctrlKey && !e.metaKey;
    if (e.key === "Enter") {
      // While an input method is still composing, Enter belongs to it.
      if (e.nativeEvent.isComposing) return;
      e.preventDefault();
      if (!multi) return;
      write(replace(i, p.slice(0, a), p.slice(b)), { i: i + 1, at: 0 });
    } else if (e.key === "Backspace" && plain && a === 0 && b === 0 && i > 0) {
      e.preventDefault();
      const prev = paras[i - 1]!;
      write([...paras.slice(0, i - 1), prev + p, ...paras.slice(i + 1)], { i: i - 1, at: prev.length });
    } else if (e.key === "Delete" && plain && a === p.length && b === p.length && i < paras.length - 1) {
      e.preventDefault();
      write([...paras.slice(0, i), p + paras[i + 1]!, ...paras.slice(i + 2)], { i, at: p.length });
    } else if ((e.key === "ArrowLeft" || e.key === "ArrowUp") && plain && a === 0 && b === 0 && i > 0) {
      e.preventDefault();
      go(i - 1, paras[i - 1]!.length);
    } else if ((e.key === "ArrowRight" || e.key === "ArrowDown") && plain && a === p.length && b === p.length && i < paras.length - 1) {
      e.preventDefault();
      go(i + 1, 0);
    }
  }

  return (
    <div ref={group} role="group" aria-label={label} data-path={path} data-field="paras" data-empty={value.trim() ? undefined : ""} className="contents">
      {paras.map((p, i) => {
        const name = paras.length > 1 ? `${label}, paragraph ${i + 1} of ${paras.length}` : label;
        const ph = paras.length === 1 ? placeholder : "";
        const field = (
          <textarea
            id={i === 0 ? id : `${id}-${i}`}
            rows={1}
            aria-label={name}
            aria-invalid={issue ? true : undefined}
            aria-describedby={issue ? issueId(`${id}-${i}`) : undefined}
            data-para={i}
            data-field="text"
            data-empty={p.trim() ? undefined : ""}
            data-grow={mirror ? "mirror" : "css"}
            value={p}
            placeholder={ph}
            spellCheck
            onChange={(e) => onChange(i, e.target)}
            onKeyDown={(e) => onKeyDown(i, e)}
            className="xe-text"
          />
        );
        return (
          <p key={i} className={`xe-field ${paraClass}`} data-para-box>
            {mirror ? (
              <span className="xe-grow">
                {/* The zero-width space keeps a last, empty line as tall as a line. */}
                <span aria-hidden className="xe-text xe-grow-mirror">
                  {p || ph}
                  {"​"}
                </span>
                {field}
              </span>
            ) : (
              field
            )}
            <IssueNote id={issueId(`${id}-${i}`)} text={issue} />
          </p>
        );
      })}
    </div>
  );
});
