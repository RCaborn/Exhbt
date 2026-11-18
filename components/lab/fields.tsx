"use client";

import { createContext, useContext, useEffect, useState } from "react";

/**
 * How the lab's text fields grow: by CSS (`field-sizing: content`) where the browser has it, or
 * with a hidden mirror of their words where it doesn't. `?grow=mirror` forces the mirror, so the
 * fallback can be tested in a browser that has the CSS.
 */
export const GrowContext = createContext<"css" | "mirror">("css");

/**
 * A line or two of plain text typed in place, in the type of whatever it sits in: a textarea with
 * no box of its own (no border, padding or ground; the face, size, weight, spacing, colour and
 * line height all inherited), as wide as its parent and as tall as its words. It is a real form
 * control with a label, so it is found, named and focused like any other field.
 *
 * It never changes size or place when it takes focus: the focus ring is an outline, which takes
 * no room. Enter doesn't start a new line; these are one-paragraph texts.
 *
 * The fallback for browsers without `field-sizing` is a mirror, not a script: the same words in a
 * hidden element sharing the field's grid cell, so the cell is exactly as tall as the words and
 * the field fills it. (Setting the height from scrollHeight was tried first and was up to 3px out:
 * scrollHeight is whole pixels and counts the overhang of a tight line height.)
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
  const [supported, setSupported] = useState(true);
  useEffect(() => setSupported(typeof CSS !== "undefined" && CSS.supports("field-sizing", "content")), []);
  const mirror = forced === "mirror" || !supported;

  const field = (
    <textarea
      id={id}
      rows={1}
      aria-label={label}
      value={value}
      placeholder={placeholder}
      data-grow={mirror ? "mirror" : "css"}
      onChange={(e) => onChange(e.target.value.replace(/\n/g, " "))}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.preventDefault();
      }}
      className={`lab-text ${mirror ? "" : "[field-sizing:content]"} ${className}`}
    />
  );
  if (!mirror) return field;
  return (
    <span className="lab-grow">
      {/* The zero-width space keeps a last, empty line as tall as a line. */}
      <span aria-hidden className={`lab-text lab-grow-mirror ${className}`}>
        {value || placeholder || ""}
        {"​"}
      </span>
      {field}
    </span>
  );
}
