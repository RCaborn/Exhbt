"use client";

import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import { BeforeAfterChart } from "@/components/exhbt/BeforeAfterChart";
import { Button } from "@/components/ui/Button";
import { LIMITS, type Chart, type Issue } from "@/lib/exhbt/blocks";
import { FieldIssues } from "./FieldIssues";
import { issuesAt } from "./model";

/** A new graph: two empty rows' worth of shape, ready to fill in. */
export const newChart = (): Chart => ({
  title: "",
  beforeLabel: "Before",
  afterLabel: "After",
  lowerIsBetter: false,
  rows: [{ label: "", before: 0, after: 0 }],
});

/**
 * One graph as a small table (title, the two series, unit, which way is better, 1 to 3 rows),
 * drawn live with the real BeforeAfterChart beside it.
 */
export function ChartEditor({
  chart,
  index,
  onChange,
  onRemove,
  issues,
}: {
  chart: Chart;
  index: number;
  onChange: (c: Chart) => void;
  onRemove: () => void;
  issues: Issue[];
}) {
  const n = index + 1;
  const p = `chart-${index}`;
  const set = (patch: Partial<Chart>) => {
    const next = { ...chart, ...patch };
    if (!next.unit) delete next.unit;
    onChange(next);
  };
  const setRow = (r: number, patch: Partial<Chart["rows"][number]>) => set({ rows: chart.rows.map((row, j) => (j === r ? { ...row, ...patch } : row)) });
  const titleIssues = issuesAt(issues, `charts.${index}.title`);
  const rowIssues = issuesAt(issues, `charts.${index}.rows`);

  return (
    <fieldset className="rounded-[14px] border border-line p-4">
      <legend className="px-1 text-sm font-semibold">Graph {n}</legend>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor={`${p}-title`} className="label">Title</label>
          <input id={`${p}-title`} className="field" value={chart.title} onChange={(e) => set({ title: e.target.value })} placeholder="e.g. Missed appointments (%)" aria-describedby={`${p}-title-issues`} />
          <FieldIssues id={`${p}-title-issues`} issues={titleIssues} />
        </div>
        <div>
          <label htmlFor={`${p}-before`} className="label">Before is called</label>
          <input id={`${p}-before`} className="field" value={chart.beforeLabel} onChange={(e) => set({ beforeLabel: e.target.value })} />
        </div>
        <div>
          <label htmlFor={`${p}-after`} className="label">After is called</label>
          <input id={`${p}-after`} className="field" value={chart.afterLabel} onChange={(e) => set({ afterLabel: e.target.value })} />
        </div>
        <div>
          <label htmlFor={`${p}-unit`} className="label">
            Unit <span className="font-normal text-graphite">(optional)</span>
          </label>
          <input id={`${p}-unit`} className="field" value={chart.unit ?? ""} onChange={(e) => set({ unit: e.target.value })} placeholder="e.g. %" maxLength={8} />
        </div>
        <label className="flex items-center gap-3 self-end pb-3">
          <input type="checkbox" className="size-4 accent-jade" checked={chart.lowerIsBetter} onChange={(e) => set({ lowerIsBetter: e.target.checked })} />
          <span>Lower is better</span>
        </label>
      </div>

      <table className="mt-4 w-full text-sm">
        <caption className="sr-only">Graph {n} values</caption>
        <thead>
          <tr className="text-left text-graphite">
            <th scope="col" className="pb-1 font-semibold">Group</th>
            <th scope="col" className="pb-1 font-semibold">{chart.beforeLabel || "Before"}</th>
            <th scope="col" className="pb-1 font-semibold">{chart.afterLabel || "After"}</th>
            <th scope="col" className="sr-only">Remove</th>
          </tr>
        </thead>
        <tbody>
          {chart.rows.map((r, j) => (
            <tr key={j}>
              <td className="py-1 pr-2">
                <input aria-label={`Graph ${n}, row ${j + 1} group`} className="field" value={r.label} onChange={(e) => setRow(j, { label: e.target.value })} />
              </td>
              <td className="py-1 pr-2">
                <NumberInput label={`Graph ${n}, row ${j + 1} ${chart.beforeLabel || "before"}`} value={r.before} onChange={(v) => setRow(j, { before: v })} />
              </td>
              <td className="py-1 pr-2">
                <NumberInput label={`Graph ${n}, row ${j + 1} ${chart.afterLabel || "after"}`} value={r.after} onChange={(v) => setRow(j, { after: v })} />
              </td>
              <td className="py-1">
                <Button size="sm" label={`Remove row ${j + 1} from graph ${n}`} disabled={chart.rows.length <= 1} onClick={() => set({ rows: chart.rows.filter((_, k) => k !== j) })}>
                  <X aria-hidden size={14} strokeWidth={2.25} />
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <FieldIssues id={`${p}-rows-issues`} issues={rowIssues} />

      <div className="mt-3 flex flex-wrap justify-between gap-2">
        <Button size="sm" disabled={chart.rows.length >= LIMITS.charts.rows} label={`Add a row to graph ${n}`} onClick={() => set({ rows: [...chart.rows, { label: "", before: 0, after: 0 }] })}>
          <Plus aria-hidden size={14} strokeWidth={2.25} /> Add a row
        </Button>
        <Button size="sm" variant="danger" label={`Remove graph ${n}`} onClick={onRemove}>
          Remove graph
        </Button>
      </div>

      {chart.rows.length > 0 && (
        <div className="mt-4 rounded-[12px] bg-mist p-4">
          <BeforeAfterChart data={chart} />
        </div>
      )}
    </fieldset>
  );
}

/** A number box that lets the person clear it while typing; only whole numbers reach the doc. */
function NumberInput({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  const [text, setText] = useState(String(value));
  useEffect(() => {
    if (Number(text) !== value) setText(String(value));
    // Only when the value changes from outside.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <input
      aria-label={label}
      inputMode="decimal"
      className="field font-mono"
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        const v = Number(e.target.value.replace(/,/g, ""));
        if (e.target.value.trim() !== "" && Number.isFinite(v)) onChange(v);
      }}
    />
  );
}
