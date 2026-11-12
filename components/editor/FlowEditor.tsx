"use client";

import { ArrowDown, ArrowLeft, ArrowRight, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { LIMITS, type FlowStep, type Issue } from "@/lib/exhbt/blocks";
import { issuesAt } from "./model";
import { FieldIssues } from "./FieldIssues";

/**
 * The process flowchart, edited on the diagram (decision 0007). Drawn like MethodFlow: step
 * boxes joined by arrows, the result (last box) filled ink. Type in a box; "+" between boxes
 * (or at the end) adds one, × removes one, ← and → move it. Within LIMITS.flow, and it redraws as you type.
 * A row when the card is wide enough (@container), a vertical pipeline otherwise.
 */
export function FlowEditor({ steps, onChange, issues }: { steps: FlowStep[]; onChange: (s: FlowStep[]) => void; issues: Issue[] }) {
  const { min, max } = LIMITS.flow;
  const set = (i: number, patch: Partial<FlowStep>) =>
    onChange(
      steps.map((s, j) => {
        if (j !== i) return s;
        const next = { ...s, ...patch };
        if (!next.detail) delete next.detail;
        return next;
      }),
    );
  const insert = (at: number) => steps.length < max && onChange([...steps.slice(0, at), { step: "" }, ...steps.slice(at)]);
  const remove = (i: number) => steps.length > min && onChange(steps.filter((_, j) => j !== i));
  const move = (i: number, by: -1 | 1) => {
    const j = i + by;
    if (j < 0 || j >= steps.length) return;
    const next = [...steps];
    [next[i], next[j]] = [next[j]!, next[i]!];
    onChange(next);
  };

  return (
    <div className="@container">
      <ol aria-label="Process flowchart" className="flex flex-col @4xl:flex-row @4xl:items-stretch">
        {steps.map((s, i) => {
          const last = i === steps.length - 1;
          const n = i + 1;
          const stepIssues = issuesAt(issues, `flow.${i}.step`);
          const detailIssues = issuesAt(issues, `flow.${i}.detail`);
          const issueId = `flow-${i}-issues`;
          const input = `w-full resize-none bg-transparent [field-sizing:content] focus-visible:outline-none ${
            last ? "placeholder:text-on-ink" : "placeholder:text-slate"
          }`;
          return (
            <li key={i} className="flex flex-col items-stretch @4xl:flex-1 @4xl:flex-row @4xl:items-center">
              <div
                className={`flex flex-col gap-1.5 rounded-[8px] border px-3 py-2.5 focus-within:border-jade @4xl:h-full @4xl:flex-1 ${
                  last ? "border-ink bg-ink text-white" : "border-line bg-surface"
                }`}
              >
                <span className={`font-mono text-[0.68rem] ${last ? "text-mint" : "text-slate"}`} aria-hidden>
                  {String(n).padStart(2, "0")}
                </span>
                <textarea
                  rows={1}
                  aria-label={`Box ${n}`}
                  aria-describedby={stepIssues.length || detailIssues.length ? issueId : undefined}
                  aria-invalid={stepIssues.length > 0 || undefined}
                  value={s.step}
                  placeholder={last ? "The result" : "A short step"}
                  onChange={(e) => set(i, { step: e.target.value.replace(/\n/g, " ") })}
                  className={`${input} text-[0.86rem] leading-tight font-semibold`}
                />
                <textarea
                  rows={1}
                  aria-label={`Box ${n} detail`}
                  value={s.detail ?? ""}
                  placeholder="Detail (optional)"
                  onChange={(e) => set(i, { detail: e.target.value.replace(/\n/g, " ") })}
                  className={`${input} font-mono text-[0.75rem] leading-snug ${last ? "text-wash" : "text-graphite"}`}
                />
                <FieldIssues id={issueId} issues={[...stepIssues, ...detailIssues]} onInk={last} />
                <div className="mt-1 flex flex-wrap gap-1">
                  <Button size="sm" variant="secondary" label={`Move box ${n} earlier`} disabled={i === 0} onClick={() => move(i, -1)}>
                    <ArrowLeft aria-hidden size={14} strokeWidth={2.25} />
                  </Button>
                  <Button size="sm" variant="secondary" label={`Move box ${n} later`} disabled={last} onClick={() => move(i, 1)}>
                    <ArrowRight aria-hidden size={14} strokeWidth={2.25} />
                  </Button>
                  <Button size="sm" variant="secondary" label={`Remove box ${n}`} disabled={steps.length <= min} onClick={() => remove(i)}>
                    <X aria-hidden size={14} strokeWidth={2.25} />
                  </Button>
                </div>
              </div>
              {!last && (
                <span className="flex items-center justify-center gap-1 py-1 text-field @4xl:flex-col @4xl:px-1 @4xl:py-0">
                  <ArrowDown aria-hidden size={14} strokeWidth={2} className="@4xl:hidden" />
                  <ArrowRight aria-hidden size={14} strokeWidth={2} className="hidden @4xl:block" />
                  {steps.length < max && (
                    <Button size="sm" variant="secondary" label={`Add a box after box ${n}`} onClick={() => insert(i + 1)}>
                      <Plus aria-hidden size={14} strokeWidth={2.25} />
                    </Button>
                  )}
                </span>
              )}
            </li>
          );
        })}
      </ol>
      {steps.length < max && (
        <div className="mt-2 flex justify-center @4xl:justify-end">
          <Button size="sm" label="Add a box at the end" onClick={() => insert(steps.length)}>
            <Plus aria-hidden size={14} strokeWidth={2.25} /> Add a box
          </Button>
        </div>
      )}
      <p className="hint mt-2">
        {min} to {max} boxes, up to {LIMITS.flow.stepWords} words each. The last box is the result.
      </p>
    </div>
  );
}
