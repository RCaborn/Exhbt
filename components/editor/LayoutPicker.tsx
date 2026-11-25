"use client";

import { useId, useRef, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { ExhbtDoc } from "@/lib/exhbt/blocks";
import { figureSentence, layoutSentence, type FigureNews, type LayoutReason } from "@/lib/exhbt/drafted";
import { FORMAT_RULES, formatOf, offeredIn, withFormat, type Format } from "@/lib/exhbt/formats";
import { layoutNotes } from "@/lib/exhbt/sections";

/**
 * The layout choice at the top of the editor (decision 0024): case study, gallery or research.
 * Three native radios in a vertical list (not a card grid), each with a small sketch and one line
 * on what it suits. Switching takes effect at once, changes `format` and nothing else, and says
 * what was kept but isn't shown and what is over the layout's caps, with an Undo.
 *
 * Right after a draft it also says, once and quietly, which layout the AI chose and why, and
 * whether a figure was taken from the person's files (decision 0025, lib/exhbt/drafted.ts).
 *
 * This editor only ever offers those three (CLASSIC_FORMATS), whatever the new editor offers: it has
 * no way to edit what the other four add (My role, the pull quote, the Before and After marks, a
 * source with no address), so a person who picked one here could never publish it. An exhbt that is
 * already one of the four keeps its layout: it is listed too, selected, with one line saying where
 * it is edited.
 */

/** The layouts this editor offers. */
const HERE = offeredIn("classic");

/**
 * How this person gets from here to the new editor, if they may use it. "visit": their editor is the
 * new one and this visit asked for the classic one, so a link opens the same exhbt there. "switch": an
 * admin whose editor is the classic one, who can turn the new one on for themselves (the same form as
 * TryNewEditor). Left out for everyone else: nobody is sent the way to an editor they can't use.
 */
export type NewEditorWay = "visit" | "switch";

const SKETCHES: Partial<Record<Format, React.ReactNode>> = {
  // A title bar, a row of three boxes, two columns.
  "case-study": (
    <>
      <rect x="2" y="2" width="30" height="5" rx="1" />
      <rect x="2" y="11" width="14" height="7" rx="1" />
      <rect x="20" y="11" width="14" height="7" rx="1" />
      <rect x="38" y="11" width="16" height="7" rx="1" />
      <rect x="2" y="23" width="24" height="15" rx="1" />
      <rect x="30" y="23" width="24" height="15" rx="1" />
    </>
  ),
  // One big frame over a row of small frames.
  gallery: (
    <>
      <rect x="2" y="2" width="52" height="22" rx="1" />
      <rect x="2" y="28" width="10" height="10" rx="1" />
      <rect x="16" y="28" width="12" height="10" rx="1" />
      <rect x="32" y="28" width="9" height="10" rx="1" />
      <rect x="45" y="28" width="9" height="10" rx="1" />
    </>
  ),
  // A narrow column beside a big frame, two columns under.
  research: (
    <>
      <rect x="2" y="2" width="16" height="22" rx="1" />
      <rect x="22" y="2" width="32" height="22" rx="1" />
      <rect x="2" y="28" width="24" height="10" rx="1" />
      <rect x="30" y="28" width="24" height="10" rx="1" />
    </>
  ),
};

/**
 * What the draft page passed on, said once right after drafting (decision 0025): the layout the AI
 * chose, why (a fixed signal), and what came of looking for a figure when none went on.
 */
export type Drafted = { format: Format; reason?: LayoutReason; figure?: FigureNews };

export function LayoutPicker({ id, doc, setDoc, drafted, newEditor }: { id: string; doc: ExhbtDoc; setDoc: React.Dispatch<React.SetStateAction<ExhbtDoc>>; drafted?: Drafted; newEditor?: NewEditorWay }) {
  const f = formatOf(doc);
  const name = useId();
  const group = useRef<HTMLDivElement>(null);
  const [said, setSaid] = useState<{ to: Format; from: Format | null } | null>(null);
  const [dismissed, setDismissed] = useState(false);

  function choose(next: Format) {
    if (next === f) return;
    setSaid({ to: next, from: f });
    setDoc((d) => withFormat(d, next));
  }
  function undo() {
    if (!said?.from) return;
    const back = said.from;
    setDoc((d) => withFormat(d, back));
    setSaid({ to: back, from: null });
  }

  const notes = layoutNotes(doc);
  const showSaid = said && said.to === f;
  // The one line after a draft: the layout and why (until it is switched), then the figure.
  const layoutLine = drafted && drafted.format === f && !said ? layoutSentence(f, drafted.reason) : null;
  const figureLine = drafted ? figureSentence(doc, drafted.figure) : null;
  const showDrafted = !dismissed && Boolean(layoutLine || figureLine);

  return (
    <section id="card-layout" aria-labelledby="card-layout-h" className="rounded-[20px] border border-line bg-surface p-5 sm:p-6">
      <fieldset>
        <legend id="card-layout-h" className="scroll-mt-24 text-[1.375rem] font-semibold">
          Layout
        </legend>
        <p className="hint mt-1">How the page reads. Switching never deletes anything.</p>
        <div ref={group} role="radiogroup" aria-label="Layout" className="mt-4 space-y-2">
          {(HERE.includes(f) ? HERE : [...HERE, f]).map((k) => {
            const hint = `${name}-${k}`;
            return (
              <label key={k} className="flex cursor-pointer items-center gap-3 rounded-[12px] border border-line p-3 has-[:checked]:border-ink has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ink">
                <input type="radio" name={name} value={k} checked={f === k} onChange={() => choose(k)} aria-describedby={hint} className="size-4 shrink-0 accent-jade" />
                <svg aria-hidden width="56" height="40" viewBox="0 0 56 40" fill="none" stroke="currentColor" strokeWidth="1.5" className="shrink-0 text-graphite">
                  {SKETCHES[k] ?? SKETCHES["case-study"]}
                </svg>
                <span className="min-w-0">
                  <span className="block font-semibold">{FORMAT_RULES[k].name}</span>
                  <span id={hint} className="block text-sm text-graphite">
                    {FORMAT_RULES[k].bestFor}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>
      {!HERE.includes(f) && (
        <div data-new-editor-layout className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-graphite">
          {/* Said before the switch, because the server lets this layout be saved only while it is the one stored: once another is saved, this editor can't put it back. */}
          <span>The {FORMAT_RULES[f].name} layout is edited in the new editor. If you switch layout here, only the new editor can switch it back.</span>
          {newEditor === "visit" && (
            // A full page load, so this editor's check for changes not yet saved runs.
            <a href={`/exhbts/${id}/edit`} className="link font-semibold">
              Open it in the new editor
            </a>
          )}
          {newEditor === "switch" && (
            <form method="post" action="/api/exhbts/editor">
              <input type="hidden" name="kind" value="page" />
              <input type="hidden" name="exhbt" value={id} />
              <Button type="submit" size="sm">
                Open it in the new editor
              </Button>
            </form>
          )}
        </div>
      )}
      <div role="status" className="mt-3 space-y-1 text-sm">
        {showSaid && (
          <>
            <p className="flex flex-wrap items-center gap-2">
              <span>{said.from ? `Switched to ${FORMAT_RULES[f].name}. Nothing was deleted.` : `Switched back to ${FORMAT_RULES[f].name}.`}</span>
              {/* No Undo back to a layout this editor doesn't offer: once the switch is saved, the server would refuse it. */}
              {said.from && !HERE.includes(said.from) && <span>Only the new editor can switch it back to {FORMAT_RULES[said.from].name}.</span>}
              {said.from && HERE.includes(said.from) && (
                <Button size="sm" onClick={undo} label={`Undo: back to ${FORMAT_RULES[said.from].name}`}>
                  Undo
                </Button>
              )}
            </p>
            {notes.hidden.length > 0 && <p className="text-graphite">Kept, not shown in this layout: {notes.hidden.join(", ")}.</p>}
            {notes.over.map((o) => (
              <p key={o} className="text-error">
                {o}
              </p>
            ))}
          </>
        )}
        {showDrafted && (
          <p data-drafted className="flex flex-wrap items-center gap-x-2 gap-y-1 text-graphite">
            {layoutLine && (
              <>
                <span>{layoutLine}</span>
                <a
                  href="#card-layout-h"
                  className="link"
                  onClick={(e) => {
                    // The choices are just above: put the cursor on the one in use.
                    e.preventDefault();
                    group.current?.querySelector<HTMLInputElement>("input:checked")?.focus();
                  }}
                >
                  Change layout
                </a>
              </>
            )}
            {figureLine && <span data-drafted-figure>{figureLine}</span>}
            <Button size="sm" label="Dismiss this note" onClick={() => setDismissed(true)}>
              <X aria-hidden size={14} strokeWidth={2.25} />
            </Button>
          </p>
        )}
      </div>
    </section>
  );
}
