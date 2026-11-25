"use client";

import type { ReactNode } from "react";
import { FieldIssues } from "@/components/editor/FieldIssues";
import { ExhbtTile } from "@/components/exhbt/ExhbtTile";
import { exhbtSummary, type ExhbtDoc } from "@/lib/exhbt/blocks";
import { tileFromDoc } from "@/lib/exhbt/headline";
import { useIssues } from "../context";
import { useDoc, useStore } from "../store";
import { Sheet } from "../ui/Sheet";
import "../css/sheets.css";

/*
 * "Card and link details" (decision 0026, "What the page does not draw"): the one-sentence summary
 * and the headline number, which the page does not draw, beside the portfolio tile drawn from the doc
 * as it is typed. Typing, so no undo entry. A port of two fields from the classic editor's first card.
 * The summary has no word limit of its own; its words count towards the page's (decision 0030).
 */
export function CardSheet(): ReactNode {
  return (
    <Sheet name="card" title="Card and link details">
      <CardBody />
    </Sheet>
  );
}

const headline = (value: string, label: string): ExhbtDoc["headline"] => (value.trim() || label.trim() ? { value, label } : undefined);

function CardBody() {
  const store = useStore();
  const issues = useIssues();
  const doc = useDoc((d) => d);
  const summaryIssues = issues.at("summary");
  const summary = exhbtSummary(doc);

  function set(next: Partial<ExhbtDoc>) {
    store.patchDoc((d) => {
      const out = { ...d, ...next };
      for (const k of Object.keys(next) as (keyof ExhbtDoc)[]) if (out[k] === undefined) delete out[k];
      return out;
    });
  }

  return (
    <div className="xe-card-cols">
      <div className="xe-sheet-stack">
        <div>
          <label htmlFor="summary" className="label">
            One-sentence summary
          </label>
          <p id="summary-hint" className="hint mb-1">
            What you found, in one sentence. Shown on your portfolio&apos;s cards.
          </p>
          <textarea
            id="summary"
            data-path="summary"
            rows={3}
            className="field resize-none [field-sizing:content] min-h-[2.75rem]"
            value={doc.summary ?? ""}
            aria-invalid={summaryIssues.length > 0 || undefined}
            aria-describedby="summary-hint summary-issues"
            onChange={(e) => set({ summary: e.target.value.replace(/\n/g, " ") })}
          />
          <FieldIssues id="summary-issues" issues={summaryIssues} />
        </div>
        <fieldset data-path="headline">
          <legend className="label">
            Headline number <span className="font-normal text-graphite">(optional, shown on job links)</span>
          </legend>
          <div className="grid grid-cols-[8rem_1fr] gap-2">
            <input
              aria-label="Headline number"
              className="field font-mono"
              value={doc.headline?.value ?? ""}
              placeholder="−18%"
              maxLength={12}
              onChange={(e) => set({ headline: headline(e.target.value, doc.headline?.label ?? "") })}
            />
            <input
              aria-label="What the number measures"
              className="field"
              value={doc.headline?.label ?? ""}
              placeholder="missed appointments"
              maxLength={40}
              onChange={(e) => set({ headline: headline(doc.headline?.value ?? "", e.target.value) })}
            />
          </div>
        </fieldset>
      </div>
      <div className="xe-card-preview">
        <p className="label">Your portfolio card</p>
        <div className="xe-card-tile" inert>
          <ExhbtTile exhbt={tileFromDoc({ ...doc, title: doc.title.trim() || "Untitled exhbt" })} href="#" position={1} headingLevel="h3" />
        </div>
        {summary && (
          <p data-testid="tile-summary" className="mt-2 text-[0.9375rem] leading-relaxed text-graphite">
            {summary}
          </p>
        )}
      </div>
    </div>
  );
}
