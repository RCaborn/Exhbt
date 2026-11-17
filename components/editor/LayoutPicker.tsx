"use client";

import { useId, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { ExhbtDoc } from "@/lib/exhbt/blocks";
import { FORMAT_RULES, FORMATS, formatOf, withFormat, type Format } from "@/lib/exhbt/formats";
import { layoutNotes } from "@/lib/exhbt/sections";

/**
 * The layout choice at the top of the editor (decision 0024): case study, gallery or research.
 * Three native radios in a vertical list (not a card grid), each with a small sketch and one line
 * on what it suits. Switching takes effect at once, changes `format` and nothing else, and says
 * what was kept but isn't shown and what is over the layout's caps, with an Undo.
 */

const SKETCHES: Record<Format, React.ReactNode> = {
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

export function LayoutPicker({ doc, setDoc, draftedAs }: { doc: ExhbtDoc; setDoc: React.Dispatch<React.SetStateAction<ExhbtDoc>>; /** The layout the AI draft chose, for a one-off line right after drafting. */ draftedAs?: Format }) {
  const f = formatOf(doc);
  const name = useId();
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
  const showDrafted = draftedAs && draftedAs !== "case-study" && draftedAs === f && !dismissed && !said;

  return (
    <section id="card-layout" aria-labelledby="card-layout-h" className="rounded-[20px] border border-line bg-surface p-5 sm:p-6">
      <fieldset>
        <legend id="card-layout-h" className="scroll-mt-24 text-[1.375rem] font-semibold">
          Layout
        </legend>
        <p className="hint mt-1">How the page reads. Switching never deletes anything.</p>
        <div role="radiogroup" aria-label="Layout" className="mt-4 space-y-2">
          {FORMATS.map((k) => {
            const hint = `${name}-${k}`;
            return (
              <label key={k} className="flex cursor-pointer items-center gap-3 rounded-[12px] border border-line p-3 has-[:checked]:border-ink has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ink">
                <input type="radio" name={name} value={k} checked={f === k} onChange={() => choose(k)} aria-describedby={hint} className="size-4 shrink-0 accent-jade" />
                <svg aria-hidden width="56" height="40" viewBox="0 0 56 40" fill="none" stroke="currentColor" strokeWidth="1.5" className="shrink-0 text-graphite">
                  {SKETCHES[k]}
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
      <div role="status" className="mt-3 space-y-1 text-sm">
        {showSaid && (
          <>
            <p className="flex flex-wrap items-center gap-2">
              <span>{said.from ? `Switched to ${FORMAT_RULES[f].name}. Nothing was deleted.` : `Switched back to ${FORMAT_RULES[f].name}.`}</span>
              {said.from && (
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
          <p className="flex flex-wrap items-center gap-2 text-graphite">
            <span>Drafted as a {FORMAT_RULES[f].name.toLowerCase()}. Change it any time; nothing is lost.</span>
            <Button size="sm" label="Dismiss this note" onClick={() => setDismissed(true)}>
              <X aria-hidden size={14} strokeWidth={2.25} />
            </Button>
          </p>
        )}
      </div>
    </section>
  );
}
