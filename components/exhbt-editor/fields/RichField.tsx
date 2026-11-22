"use client";

import { lazy, memo, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import type { Editor } from "@tiptap/core";
import { RichText } from "@/components/exhbt/RichText";
import type { RichSlot } from "@/components/portfolio/page-ctx";
import type { RichText as RichTextValue, Run } from "@/lib/exhbt/blocks";
import { docToRuns, runsToDoc, sameRuns, type TiptapNode } from "@/lib/exhbt/richtext-tiptap";
import { useFieldPath } from "../Frame";
import { MUTED } from "../geometry";
import { useStore } from "../store";
import { enqueueEditor } from "./idle";
import { IssueNote, issueId, useFieldIssue } from "./issues";

/*
 * Formatted text typed in the page's own type (decision 0026, "Typing in the page's own type"): bold,
 * italic and https links, or the context line's highlight, stored as runs. Tiptap's wrapper is a
 * <div>, which cannot go in a <p>, so where the page draws a <p> this field is a <div> with the
 * paragraph's classes (`className`); where the page keeps its own element (a finding's <li>, a
 * caption's <figcaption>), the field goes inside it.
 *
 * Until its Tiptap editor exists the field is a resting field: the words drawn as the page draws them,
 * in an element that can be typed in (contenteditable), so a click or a tap puts the caret where it
 * lands, a phone opens its keyboard, and every key typed lands at once, before the editor has loaded.
 * React draws the resting words once and leaves them to the browser while they are typed in (it never
 * touches what the person changed); each change goes to the store as runs. Enter, the formatting keys,
 * a paste and a drop are taken as plain text, as the field's one paragraph needs.
 *
 * Editors are made one at a time in idle moments after the page is up (idle.ts), and at once for a
 * field that is focused; their chunk is fetched as soon as the editor is up (preloadRichEditor). When
 * the editor exists it is drawn out of the flow, unseen, and the hand-over is one synchronous step: the
 * resting field's words (read from what is on the screen) and its selection go to the editor, the
 * resting field goes and the editor takes its place, and the editor takes the caret where it was.
 * No key can come in between, so none is lost, and nothing moves.
 */

const loadEditor = () => import("./RichEditor");
const RichEditor = lazy(loadEditor);

/** Starts fetching the editor's chunk, so a click only has to make the editor (EditorShell.tsx, when the page is up). */
export function preloadRichEditor() {
  void loadEditor();
}

const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(" ");
export const hasWords = (rt: RichTextValue) => rt.some((r) => r.t.trim());

/** The words as the page draws them, or the placeholder in --xp-muted. */
export function StaticRich({ value, placeholder, highlight }: { value: RichTextValue; placeholder: string; highlight?: boolean }) {
  return hasWords(value) ? <RichText value={value} highlight={highlight} /> : <span style={MUTED}>{placeholder}</span>;
}

/** The runs a resting field shows now, read from its elements as RichText draws them (bold or the highlight, italic, a link). */
export function runsFromDom(root: Node): RichTextValue {
  const out: Run[] = [];
  const walk = (node: Node, marks: Omit<Run, "t">) => {
    if (node.nodeType === Node.TEXT_NODE) {
      // The browser types a space it would otherwise collapse as a no-break space; the editor stores a space.
      const t = (node.nodeValue ?? "").replace(/[\n ]/g, " ");
      if (t) out.push({ t, ...marks });
      return;
    }
    if (!(node instanceof HTMLElement)) return;
    const tag = node.tagName;
    const next = { ...marks };
    if (tag === "STRONG" || tag === "B" || tag === "MARK") next.b = true;
    if (tag === "EM" || tag === "I") next.i = true;
    if (tag === "A" && node.getAttribute("href")) next.href = node.getAttribute("href")!;
    node.childNodes.forEach((c) => walk(c, next));
  };
  root.childNodes.forEach((c) => walk(c, {}));
  // Through the editor's own conversion, so runs merge and an only-spaces field is empty, as the editor stores them.
  return docToRuns(runsToDoc(out));
}

/** The selection inside `root` as offsets into its text, or null when it is not there. */
function selectionIn(root: HTMLElement): { from: number; to: number } | null {
  const sel = typeof window === "undefined" ? null : window.getSelection();
  if (!sel || sel.rangeCount === 0 || !sel.anchorNode || !sel.focusNode || !root.contains(sel.anchorNode) || !root.contains(sel.focusNode)) return null;
  const offset = (node: Node, at: number) => {
    const r = document.createRange();
    r.setStart(root, 0);
    r.setEnd(node, at);
    return r.toString().length;
  };
  const a = offset(sel.anchorNode, sel.anchorOffset);
  const f = offset(sel.focusNode, sel.focusOffset);
  return { from: Math.min(a, f), to: Math.max(a, f) };
}

/** Puts the caret at the end of `el`. */
function caretAtEnd(el: HTMLElement) {
  const sel = window.getSelection();
  if (!sel) return;
  const r = document.createRange();
  r.selectNodeContents(el);
  r.collapse(false);
  sel.removeAllRanges();
  sel.addRange(r);
}

/** What a resting field does not let the browser do itself: a new paragraph, formatting, rich pastes and drops. */
const REFUSED = /^(insertParagraph|insertLineBreak|format|insertFromDrop|deleteByDrag|insertFromYank|historyUndo|historyRedo)/;

/** Why the editor was started: in an idle moment (it must not take the focus), or by the person. */
type Start = false | "idle" | "person";

/** Memoised: drawn again only when its own words, name or place change. */
export const RichField = memo(function RichField(given: RichSlot) {
  // Inside a frame, the path takes the frame's index in doc.sections now (Frame.tsx).
  const path = useFieldPath(given.path);
  const o = useMemo(() => (path === given.path ? given : { ...given, path }), [given, path]);
  const store = useStore();
  const [start, setStart] = useState<Start>(false);
  const [ready, setReady] = useState(false);
  const readyWaiters = useRef<(() => void)[]>([]);
  const rest = useRef<HTMLDivElement>(null);
  const pressed = useRef(false);
  const id = o.path.replace(/\./g, "-");
  const issue = useFieldIssue(o.path);
  const empty = !hasWords(o.value);
  const pathNow = useRef(o.path);
  pathNow.current = o.path;

  // The resting words are drawn once per outside change (an undo, a rewrite), never for the person's own typing,
  // so React never touches what the browser changed. A new key draws them again from the doc.
  const [restKey, setRestKey] = useState(0);
  const drawn = useRef(o.value);
  useEffect(() => {
    const el = rest.current;
    if (!el || sameRuns(o.value, runsFromDom(el))) return;
    drawn.current = o.value;
    setRestKey((k) => k + 1);
  }, [o.value]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const restWords = useMemo(() => (hasWords(drawn.current) ? <RichText value={drawn.current} highlight={o.highlight} /> : null), [restKey, o.highlight]);

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

  /** The hand-over, in one step: the words and the selection on the screen go to the editor, then it takes the resting field's place, and the caret. */
  const onReady = (editor: Editor, name: () => void) => {
    const el = rest.current;
    const words = el ? runsFromDom(el) : null;
    const sel = el ? selectionIn(el) : null;
    const hadFocus = Boolean(el && el.contains(document.activeElement));
    if (words && !sameRuns(words, docToRuns(editor.getJSON() as TiptapNode))) editor.commands.setContent(runsToDoc(words), { emitUpdate: false });
    flushSync(() => setReady(true));
    name();
    if (hadFocus) {
      const size = editor.state.doc.content.size;
      const clamp = (n: number) => Math.max(1, Math.min(size - 1, n + 1));
      editor.chain().setTextSelection({ from: clamp(sel?.from ?? Number.MAX_SAFE_INTEGER), to: clamp(sel?.to ?? Number.MAX_SAFE_INTEGER) }).focus(null, { scrollIntoView: false }).run();
    }
    for (const done of readyWaiters.current.splice(0)) done();
  };

  // Each change typed in the resting field goes to the store, as the editor's would.
  const onInput = () => {
    const el = rest.current;
    if (!el) return;
    const runs = runsFromDom(el);
    // Emptied: no stray <br>, so the placeholder shows again.
    if (!runs.length && el.childNodes.length) el.replaceChildren();
    store.setAt(pathNow.current, runs);
  };

  return (
    <div
      className={cx(o.className, "xe-rich")}
      data-path={o.path}
      data-field="rich"
      data-empty={empty || undefined}
      data-live={ready || undefined}
      data-invalid={issue ? "" : undefined}
      // Nothing navigates in the editor: a link in the words is words.
      onClickCapture={(e) => {
        if ((e.target as Element).closest("a")) e.preventDefault();
      }}
    >
      {!ready && (
        <div
          key={restKey}
          ref={rest}
          className="xe-rest"
          id={id}
          role="textbox"
          contentEditable
          suppressContentEditableWarning
          spellCheck
          aria-label={o.label}
          aria-multiline
          aria-placeholder={o.placeholder}
          data-placeholder={o.placeholder}
          aria-invalid={issue ? true : undefined}
          aria-describedby={issue ? issueId(id) : undefined}
          onPointerDown={() => (pressed.current = true)}
          onFocus={(e) => {
            // Reached by Tab or a jump, not a press: the caret goes to the end, as the editor puts it.
            if (!pressed.current) caretAtEnd(e.currentTarget);
            pressed.current = false;
            setStart("person");
          }}
          onBeforeInput={(e) => {
            const type = (e.nativeEvent as InputEvent).inputType ?? "";
            if (REFUSED.test(type)) e.preventDefault();
          }}
          onPaste={(e) => {
            e.preventDefault();
            const t = e.clipboardData.getData("text/plain").replace(/\s*\n\s*/g, " ");
            if (t) document.execCommand("insertText", false, t);
          }}
          onDrop={(e) => e.preventDefault()}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.preventDefault();
          }}
          onInput={onInput}
        >
          {restWords}
        </div>
      )}
      {start && (
        <Suspense fallback={null}>
          <RichEditor slot={o} id={id} issue={issue} live={ready} onReady={onReady} />
        </Suspense>
      )}
      <IssueNote id={issueId(id)} text={issue} />
    </div>
  );
});
