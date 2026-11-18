"use client";

import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState } from "react";

/**
 * How the lab's text fields grow: by CSS (`field-sizing: content`) where the browser has it, or
 * by script where it doesn't. `?grow=js` forces the script, so the fallback can be tested in a
 * browser that has the CSS.
 */
export const GrowContext = createContext<"css" | "script">("css");

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * A line or two of plain text typed in place, in the type of whatever it sits in: a textarea with
 * no box of its own (no border, padding or ground; the face, size, weight, spacing, colour and
 * line height all inherited), as wide as its parent and as tall as its words. It is a real form
 * control with a label, so it is found, named and focused like any other field.
 *
 * It never changes size or place when it takes focus: the focus ring is an outline, which takes
 * no room. Enter doesn't start a new line; these are one-paragraph texts.
 */
export function AutoText({
  value,
  onChange,
  label,
  placeholder,
  className = "",
  id,
}: {
  value: string;
  onChange: (value: string) => void;
  /** The field's name, read out and used by tests ("Title", "Finding 2"). */
  label: string;
  placeholder?: string;
  className?: string;
  id?: string;
}) {
  const forced = useContext(GrowContext);
  const ref = useRef<HTMLTextAreaElement>(null);
  const [supported, setSupported] = useState(true);
  useEffect(() => setSupported(typeof CSS !== "undefined" && CSS.supports("field-sizing", "content")), []);
  const script = forced === "script" || !supported;

  // The fallback: as tall as the words, set again when they change or the field's width does.
  useIsoLayoutEffect(() => {
    const el = ref.current;
    if (!script || !el) return;
    const fit = () => {
      el.style.height = "0px";
      el.style.height = `${el.scrollHeight}px`;
    };
    fit();
    let width = el.clientWidth;
    const watch = new ResizeObserver(() => {
      if (el.clientWidth === width) return;
      width = el.clientWidth;
      fit();
    });
    watch.observe(el);
    return () => watch.disconnect();
  }, [script, value]);

  return (
    <textarea
      ref={ref}
      id={id}
      rows={1}
      aria-label={label}
      value={value}
      placeholder={placeholder}
      data-grow={script ? "script" : "css"}
      onChange={(e) => onChange(e.target.value.replace(/\n/g, " "))}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.preventDefault();
      }}
      className={`lab-text ${script ? "" : "[field-sizing:content]"} ${className}`}
    />
  );
}
