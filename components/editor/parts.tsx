"use client";

import { LIMITS, type Issue } from "@/lib/exhbt/blocks";
import { FieldIssues } from "./FieldIssues";

/**
 * The editor's building blocks: a card per part of the exhbt, its word count, and a labelled text
 * field. Shared by the fixed cards (components/editor/Editor.tsx) and the sections below the
 * flowchart (components/editor/Sections.tsx).
 */

export function Card({
  id,
  title,
  words: n,
  limit,
  hint,
  flagged,
  heaviest,
  level = "h2",
  controls,
  children,
}: {
  id: string;
  title: string;
  words?: number;
  limit?: number;
  hint?: string;
  /** Something here needs attention: drawn with an error edge. */
  flagged?: boolean;
  /** The whole exhbt is over the word limit and this card has the most. */
  heaviest?: boolean;
  /** h3 for the cards inside "Sections". */
  level?: "h2" | "h3";
  /** Buttons beside the title (move, remove), and a drag handle before it. */
  controls?: { before?: React.ReactNode; after?: React.ReactNode };
  children: React.ReactNode;
}) {
  const H = level;
  return (
    <section aria-labelledby={id} className={`rounded-[20px] border bg-surface p-5 sm:p-6 ${flagged ? "border-error" : "border-line"}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          {controls?.before}
          <H id={id} className="scroll-mt-24 text-[1.375rem]">
            {title}
          </H>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {n !== undefined && <WordsOf n={n} limit={limit} />}
          {controls?.after}
        </div>
      </div>
      {hint && <p className="hint mt-1">{hint}</p>}
      {heaviest && (
        <p className="mt-1 text-sm font-semibold text-error">
          The whole exhbt is over {LIMITS.totalWords} words, and this part has the most ({n}). Start trimming here.
        </p>
      )}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function WordsOf({ n, limit }: { n: number; limit?: number }) {
  const over = limit !== undefined && n > limit;
  return (
    <span className={`font-mono text-sm ${over ? "font-semibold text-error" : "text-graphite"}`}>
      {limit !== undefined ? `${n} / ${limit}` : n} {n === 1 && limit === undefined ? "word" : "words"}
    </span>
  );
}

export function TextInput({
  id,
  label,
  value,
  onChange,
  issues,
  max,
  placeholder,
  type = "text",
  multiline = false,
  hint,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  issues: Issue[];
  max?: number;
  placeholder?: string;
  type?: "text" | "url";
  /** A textarea that grows with its text, for long answers such as image descriptions. */
  multiline?: boolean;
  /** A line under the label, e.g. what this layout's title is for. */
  hint?: string;
}) {
  const common = {
    id,
    className: multiline ? "field resize-none [field-sizing:content] min-h-[2.75rem]" : "field",
    value,
    placeholder,
    "aria-invalid": issues.length > 0 || undefined,
    "aria-describedby": hint ? `${id}-hint ${id}-issues` : `${id}-issues`,
  };
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="label">
          {label}
        </label>
        {max !== undefined && (
          <span className={`font-mono text-sm ${value.length > max ? "font-semibold text-error" : "text-graphite"}`}>
            {value.length} / {max}
          </span>
        )}
      </div>
      {hint && (
        <p id={`${id}-hint`} className="hint mb-1">
          {hint}
        </p>
      )}
      {multiline ? (
        <textarea rows={2} {...common} onChange={(e) => onChange(e.target.value.replace(/\n/g, " "))} />
      ) : (
        <input type={type} {...common} onChange={(e) => onChange(e.target.value)} />
      )}
      <FieldIssues id={`${id}-issues`} issues={issues} />
    </div>
  );
}
