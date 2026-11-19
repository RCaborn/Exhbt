"use client";

import { createContext, useContext, useLayoutEffect, useRef, useSyncExternalStore } from "react";
import type { TextSlot } from "@/components/portfolio/page-ctx";
import { useStore } from "../store";

/*
 * Plain text typed in the page's own type (decision 0026, "Typing in the page's own type"): a field
 * with no box of its own, in the face, size, weight, spacing and line height of whatever it sits in.
 * It never changes size or place when it takes the focus (the ring is an outline), and Enter never
 * starts a new line. A real, labelled control, found and named like any form field.
 *
 * Where the page sets the words as a block (the title, a fact, a flowchart box, a description) the
 * field is a textarea that grows with `field-sizing: content`, or, where a browser lacks it, with a
 * hidden mirror of its words in the same grid cell (`?grow=mirror` forces that, in development).
 *
 * Where the page sets the words inline, among other words (a quote between its marks, the name and
 * the role on one line, a pull quote, a link's words beside its arrow), a textarea cannot flow with
 * the text round it, so the field is an inline span the person types in (`contenteditable` as plain
 * text only): it wraps exactly as the published words do.
 */

/** The paths whose words the page sets inline: a quote's words, name and role, a pull quote, a link's words. */
const INLINE = /^sections\.\d+\.(text|name|role|label)$/;

/** How the block fields grow: "css" (`field-sizing`) or "mirror". */
export const GrowContext = createContext<"css" | "mirror" | null>(null);

const noSub = () => () => {};
/** Whether this browser has `field-sizing`; true on the server, where nothing is drawn anyway. */
function useFieldSizing(): boolean {
  return useSyncExternalStore(
    noSub,
    () => typeof CSS !== "undefined" && CSS.supports("field-sizing", "content"),
    () => true,
  );
}

const oneLine = (s: string) => s.replace(/\r?\n/g, " ");

export function InlineText({ path, value, label, placeholder, id, maxChars }: TextSlot) {
  const store = useStore();
  const domId = id ?? path.replace(/\./g, "-");
  if (INLINE.test(path)) return <InlineSpan path={path} value={value} label={label} placeholder={placeholder} id={domId} onText={(t) => store.setAt(path, t)} />;
  return <BlockText path={path} value={value} label={label} placeholder={placeholder} id={domId} maxChars={maxChars} onText={(t) => store.setAt(path, t)} />;
}

function BlockText({ path, value, label, placeholder, id, maxChars, onText }: { path: string; value: string; label: string; placeholder: string; id: string; maxChars?: number; onText(t: string): void }) {
  const forced = useContext(GrowContext);
  const supported = useFieldSizing();
  const mirror = forced === "mirror" || !supported;
  const field = (
    <textarea
      id={id}
      rows={1}
      aria-label={label}
      data-path={path}
      data-field="text"
      data-grow={mirror ? "mirror" : "css"}
      value={value}
      placeholder={placeholder}
      maxLength={maxChars}
      spellCheck
      onChange={(e) => onText(oneLine(e.target.value))}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.preventDefault();
      }}
      className="xe-text"
    />
  );
  if (!mirror) return field;
  return (
    <span className="xe-grow">
      {/* The zero-width space keeps a last, empty line as tall as a line. */}
      <span aria-hidden className="xe-text xe-grow-mirror">
        {value || placeholder}
        {"​"}
      </span>
      {field}
    </span>
  );
}

function InlineSpan({ path, value, label, placeholder, id, onText }: { path: string; value: string; label: string; placeholder: string; id: string; onText(t: string): void }) {
  const ref = useRef<HTMLSpanElement>(null);
  // The words are the DOM's own while the person types; they are written in only when they differ (a change from outside).
  useLayoutEffect(() => {
    const el = ref.current;
    if (el && (el.textContent ?? "") !== value) el.textContent = value;
  }, [value]);
  return (
    <span
      ref={ref}
      id={id}
      role="textbox"
      aria-label={label}
      aria-placeholder={placeholder}
      data-placeholder={placeholder}
      data-path={path}
      data-field="text"
      contentEditable="plaintext-only"
      suppressContentEditableWarning
      spellCheck
      tabIndex={0}
      className="xe-inline"
      onInput={(e) => {
        const el = e.currentTarget;
        const t = oneLine(el.textContent ?? "");
        // An emptied field keeps nothing (not even a <br>), so its placeholder shows.
        if (!t && el.childNodes.length) el.replaceChildren();
        onText(t);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.preventDefault();
      }}
    />
  );
}
