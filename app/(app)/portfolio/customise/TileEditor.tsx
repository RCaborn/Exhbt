"use client";

import { Plus, X } from "lucide-react";
import { countWords, TILE_LIMITS, TILE_NAMES, type TileKind, type Tiles } from "@/lib/portfolio-layout";
import type { TileProblems } from "@/lib/portfolio-customise";

/**
 * The words in one extra tile, edited in place where the tile sits (decision 0014). Fields are
 * controlled and apply as they are typed; the page saves them. `problems` is what the tile rules
 * refused (lib/portfolio-customise.ts checkTiles), keyed "kind.field", shown under the field.
 */

type Props<K extends TileKind> = { kind: K; value: NonNullable<Tiles[K]>; onChange: (next: NonNullable<Tiles[K]>) => void; problems: TileProblems; ready: boolean };

function Field({
  id,
  label,
  hint,
  error,
  count,
  over,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  count?: string;
  over?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="label">
        {label}
        {hint && <span className="ml-1.5 font-normal text-slate">{hint}</span>}
      </label>
      {children}
      <div className="mt-1 flex flex-wrap justify-between gap-x-4 text-[0.8125rem]">
        <p id={`${id}-error`} className="text-error">
          {error}
        </p>
        {count && (
          <p id={`${id}-count`} className={over ? "font-semibold text-error" : "text-slate"}>
            {count}
          </p>
        )}
      </div>
    </div>
  );
}

const wordsCount = (s: string, max: number) => ({ count: `${countWords(s)} of ${max} words`, over: countWords(s) > max });

function Lines({ kind, value, onChange, problems, ready }: Props<"education" | "experience">) {
  const lines = value.lines.length ? value.lines : [""];
  const set = (i: number, text: string) => onChange({ lines: lines.map((l, j) => (j === i ? text : l)) });
  const noun = kind === "education" ? "education" : "experience";
  const sample = kind === "education" ? "BSc Data Science, University of Example, 2026" : "Retail supervisor, Example Stores, 2023 to 2025";
  const error = problems[`${kind}.lines`];
  return (
    <div className="space-y-3">
      {lines.map((l, i) => (
        <div key={i} className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <Field id={`${kind}-line-${i}`} label={`Line ${i + 1}`} {...wordsCount(l, TILE_LIMITS.lineWords)}>
              <input
                id={`${kind}-line-${i}`}
                value={l}
                onChange={(e) => set(i, e.target.value)}
                maxLength={TILE_LIMITS.lineChars + 40}
                placeholder={sample}
                readOnly={!ready}
                aria-describedby={`${kind}-line-${i}-count`}
                className="field"
              />
            </Field>
          </div>
          {lines.length > 1 && (
            <button
              type="button"
              onClick={() => onChange({ lines: lines.filter((_, j) => j !== i) })}
              aria-label={`Remove ${noun} line ${i + 1}`}
              className="mt-7 inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-line bg-surface hover:border-ink"
            >
              <X aria-hidden size={16} strokeWidth={2.25} />
            </button>
          )}
        </div>
      ))}
      {error && (
        <p role="alert" className="text-[0.8125rem] text-error">
          {error}
        </p>
      )}
      {lines.length < TILE_LIMITS.lines && (
        <button
          type="button"
          onClick={() => onChange({ lines: [...lines, ""] })}
          className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-sm font-semibold hover:border-ink"
        >
          <Plus aria-hidden size={14} strokeWidth={2.5} /> Add a line
        </button>
      )}
    </div>
  );
}

function About({ value, onChange, problems, ready }: Props<"about">) {
  const w = wordsCount(value.text, TILE_LIMITS.aboutWords);
  return (
    <Field id="about-text" label="About me" error={problems["about.text"]} {...w}>
      <textarea
        id="about-text"
        value={value.text}
        onChange={(e) => onChange({ text: e.target.value })}
        rows={4}
        maxLength={900}
        readOnly={!ready}
        aria-describedby="about-text-count about-text-error"
        className="field"
      />
    </Field>
  );
}

function Quote({ value, onChange, problems, ready }: Props<"quote">) {
  const w = wordsCount(value.text, TILE_LIMITS.quoteWords);
  return (
    <div className="space-y-3">
      <Field id="quote-text" label="The quote" error={problems["quote.text"]} {...w}>
        <textarea
          id="quote-text"
          value={value.text}
          onChange={(e) => onChange({ ...value, text: e.target.value })}
          rows={3}
          maxLength={400}
          readOnly={!ready}
          aria-describedby="quote-text-count quote-text-error"
          className="field"
        />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field id="quote-name" label="Who said it" error={problems["quote.name"]}>
          <input id="quote-name" value={value.name} onChange={(e) => onChange({ ...value, name: e.target.value })} maxLength={TILE_LIMITS.nameChars + 20} readOnly={!ready} aria-describedby="quote-name-error" className="field" />
        </Field>
        <Field id="quote-role" label="Their role" error={problems["quote.role"]}>
          <input
            id="quote-role"
            value={value.role}
            onChange={(e) => onChange({ ...value, role: e.target.value })}
            maxLength={TILE_LIMITS.roleChars + 20}
            placeholder="Module tutor, University of Example"
            readOnly={!ready}
            aria-describedby="quote-role-error"
            className="field"
          />
        </Field>
      </div>
    </div>
  );
}

function Links({ value, onChange, problems, ready }: Props<"links">) {
  const row = (key: "linkedin" | "github" | "website" | "email", label: string, placeholder: string, type: "url" | "email" = "url") => (
    <Field id={`links-${key}`} label={label} error={problems[`links.${key}`]}>
      <input
        id={`links-${key}`}
        value={value[key]}
        onChange={(e) => onChange({ ...value, [key]: e.target.value })}
        inputMode={type}
        autoComplete="off"
        maxLength={TILE_LIMITS.linkChars + 20}
        placeholder={placeholder}
        readOnly={!ready}
        aria-describedby={`links-${key}-error`}
        className="field"
      />
    </Field>
  );
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {row("linkedin", "LinkedIn", "linkedin.com/in/your-name")}
      {row("github", "GitHub", "github.com/your-name")}
      {row("website", "Website", "https://your-name.co.uk")}
      {row("email", "Email", "you@example.com", "email")}
      <p className="text-[0.8125rem] text-slate sm:col-span-2">Your email shows as text, not a link, so it&rsquo;s harder for scrapers to collect.</p>
    </div>
  );
}

/** The form for one extra tile, with a Done button that closes it. */
export function TileEditor<K extends TileKind>({
  kind,
  value,
  onChange,
  onDone,
  problems,
  ready,
}: Props<K> & { onDone: () => void }) {
  const props = { kind, value, onChange, problems, ready } as never;
  return (
    <div className="flex h-full flex-col rounded-[16px] border border-ink bg-surface p-5 shadow-pack sm:p-6" data-tile-editor={kind}>
      <h3 className="mb-3 text-[1.2rem] leading-snug font-bold tracking-[-0.015em]">{TILE_NAMES[kind]}</h3>
      {kind === "about" && <About {...(props as Props<"about">)} />}
      {(kind === "education" || kind === "experience") && <Lines {...(props as Props<"education" | "experience">)} />}
      {kind === "quote" && <Quote {...(props as Props<"quote">)} />}
      {kind === "links" && <Links {...(props as Props<"links">)} />}
      <div className="mt-4">
        <button type="button" onClick={onDone} className="rounded-full border border-ink bg-surface px-4 py-2 text-sm font-semibold hover:bg-mist">
          Done
        </button>
      </div>
    </div>
  );
}
