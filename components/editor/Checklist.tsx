"use client";

import { Check, X } from "lucide-react";
import { plain, words, type ExhbtDoc } from "@/lib/exhbt/blocks";
import { Button } from "@/components/ui/Button";

/** True for a doc with nothing typed in yet: what "Start from scratch" makes. */
export function isBlank(doc: ExhbtDoc): boolean {
  return (
    !doc.title.trim() &&
    !doc.context.trim() &&
    words(plain(doc.gap)) === 0 &&
    doc.flow.every((s) => !s.step.trim() && !(s.detail ?? "").trim()) &&
    doc.findings.every((f) => words(plain(f)) === 0) &&
    doc.skills.length === 0 &&
    doc.charts.length === 0 &&
    doc.images.length === 0 &&
    !doc.evidence
  );
}

export type Step = { key: string; label: string; done: boolean; target: string };

/** The first-exhbt steps, each ticking when the doc has it (and the last when it is live). */
export function stepsFor(doc: ExhbtDoc, live: boolean): Step[] {
  return [
    { key: "title", label: "Give it a title", done: doc.title.trim().length > 0, target: "card-header" },
    { key: "question", label: "Write the question", done: words(plain(doc.gap)) > 0, target: "card-gap" },
    { key: "process", label: "Fill in 3 or more process boxes", done: doc.flow.filter((s) => s.step.trim()).length >= 3, target: "card-flow" },
    { key: "findings", label: "Add 2 or more findings", done: doc.findings.filter((f) => words(plain(f)) > 0).length >= 2, target: "card-findings" },
    { key: "publish", label: "Publish it", done: live, target: "card-publish" },
  ];
}

/** A dismissible checklist for someone's first, still-empty exhbt. */
export function Checklist({ steps, onDismiss, onJump }: { steps: Step[]; onDismiss: () => void; onJump: (target: string) => void }) {
  const left = steps.filter((s) => !s.done).length;
  return (
    <section aria-labelledby="guide-title" className="rounded-[20px] border border-line bg-surface p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="guide-title" className="text-[1.375rem]">
            Your first exhbt
          </h2>
          <p className="hint mt-1">{left === 0 ? "All done." : `${left} to go. Short is good: the whole exhbt is under 200 words.`}</p>
        </div>
        <Button size="sm" label="Hide the checklist" onClick={onDismiss}>
          <X aria-hidden size={14} strokeWidth={2.25} />
        </Button>
      </div>
      <ol className="mt-4 space-y-2">
        {steps.map((s) => (
          <li key={s.key} data-done={s.done || undefined} className="flex items-center gap-3">
            <span
              aria-hidden
              className={`inline-flex size-[22px] shrink-0 items-center justify-center rounded-full border ${s.done ? "border-ink bg-mint" : "border-field bg-surface"}`}
            >
              {s.done && <Check size={13} strokeWidth={3} />}
            </span>
            <a
              href={`#${s.target}`}
              onClick={(e) => {
                e.preventDefault();
                onJump(s.target);
              }}
              className={`link ${s.done ? "text-graphite line-through" : "font-semibold text-ink"}`}
            >
              {s.label}
            </a>
            <span className="sr-only">{s.done ? "(done)" : "(not done yet)"}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
