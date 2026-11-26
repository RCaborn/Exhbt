"use client";

import { X } from "lucide-react";
import { findingsOf, formatLimits, imagesOf, plain, sectionsOf, words, type ExhbtDoc } from "@/lib/exhbt/blocks";
import { formatOf } from "@/lib/exhbt/formats";
import { hasData } from "@/lib/exhbt/charts";
import { Button } from "@/components/ui/Button";
import { Tick } from "@/components/ui/Tick";

/** True for a doc with nothing typed in yet: what "Write it myself" makes (Add an exhbt), in any layout. */
export function isBlank(doc: ExhbtDoc): boolean {
  return (
    !doc.title.trim() &&
    !doc.context.trim() &&
    !(doc.whereWhen ?? "").trim() &&
    !(doc.summary ?? "").trim() &&
    words(plain(doc.gap)) === 0 &&
    doc.flow.every((s) => !s.step.trim() && !(s.detail ?? "").trim()) &&
    doc.skills.length === 0 &&
    // Only the empty findings a new exhbt starts with: no other section, nothing typed.
    doc.sections.every((s) => s.kind === "findings" && s.items.every((f) => words(plain(f)) === 0)) &&
    !doc.evidence
  );
}

export type Step = { key: string; label: string; done: boolean; target: string };

/** The first-exhbt steps, each ticking when the doc has it (and the last when it is live). */
export function stepsFor(doc: ExhbtDoc, live: boolean): Step[] {
  const f = formatOf(doc);
  const L = formatLimits(f);
  const filled = (txt: { t: string }[]) => words(plain(txt)) > 0;
  const boxes = doc.flow.filter((s) => s.step.trim()).length >= 3;
  const publish: Step = { key: "publish", label: "Publish it", done: live, target: "card-publish" };
  const firstOf = (...kinds: string[]) => {
    const at = doc.sections.findIndex((s) => kinds.includes(s.kind));
    return at >= 0 ? `card-section-${at}` : "add-section";
  };
  if (f === "gallery") {
    const withAlt = imagesOf(doc).length;
    return [
      { key: "title", label: "Name the work (the title)", done: doc.title.trim().length > 0, target: "card-header" },
      { key: "question", label: "Write the brief", done: filled(doc.gap), target: "card-gap" },
      { key: "process", label: "Fill in 3 or more boxes for what you did", done: boxes, target: "card-flow" },
      { key: "images", label: `Add ${L.minImages} or more images`, done: withAlt >= L.minImages, target: firstOf("image") },
      publish,
    ];
  }
  if (f === "research") {
    const aim = sectionsOf(doc, "aim")[0];
    const conclusion = sectionsOf(doc, "conclusion")[0];
    const results = findingsOf(doc).filter((x) => words(plain(x)) > 0).length >= L.findings.min;
    const figure = doc.sections.some((s) => (s.kind === "graph" && hasData(s.chart)) || s.kind === "image");
    return [
      { key: "title", label: "Ask your research question (the title)", done: doc.title.trim().length > 0, target: "card-header" },
      { key: "question", label: "Write the background", done: filled(doc.gap), target: "card-gap" },
      { key: "aim", label: "Add your aim or hypothesis", done: Boolean(aim && filled(aim.text)), target: firstOf("aim") },
      { key: "process", label: "Fill in 3 or more method boxes", done: boxes, target: "card-flow" },
      { key: "figure", label: "Add the key figure: a graph or an image", done: figure, target: firstOf("graph", "image") },
      { key: "findings", label: `Add ${L.findings.min} or more results`, done: results, target: firstOf("findings") },
      { key: "conclusion", label: "Write your conclusion", done: Boolean(conclusion && filled(conclusion.text)), target: firstOf("conclusion") },
      publish,
    ];
  }
  // Publishing needs findings or a graph (decision 0015): the step points at the first of either, or the "Add a section" menu.
  const at = doc.sections.findIndex((s) => s.kind === "findings" || s.kind === "graph");
  const shown = findingsOf(doc).filter((f) => words(plain(f)) > 0).length >= 2 || doc.sections.some((s) => s.kind === "graph" && hasData(s.chart));
  return [
    { key: "title", label: "Ask your question (the title)", done: doc.title.trim().length > 0, target: "card-header" },
    { key: "question", label: "Write the context", done: words(plain(doc.gap)) > 0, target: "card-gap" },
    { key: "process", label: "Fill in 3 or more process boxes", done: doc.flow.filter((s) => s.step.trim()).length >= 3, target: "card-flow" },
    { key: "findings", label: "Add 2 or more findings, or a graph", done: shown, target: at >= 0 ? `card-section-${at}` : "add-section" },
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
            {s.done ? <Tick size="lg" /> : <span aria-hidden className="inline-flex size-[22px] shrink-0 rounded-full border border-field bg-surface" />}
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
