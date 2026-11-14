"use client";

import { useEffect, useState } from "react";
import { ArrowRightLeft, ChartBar, ChartBarBig, ChartBarStacked, ChartLine, ChartScatter, Hash, Plus, Table, X, type LucideIcon } from "lucide-react";
import { Chart as ChartView } from "@/components/charts/Chart";
import { Button } from "@/components/ui/Button";
import type { Issue } from "@/lib/exhbt/blocks";
import {
  CHART_KINDS,
  CHART_LIMITS as L,
  KIND_NAMES,
  convertChart,
  hasData,
  newChart,
  protectModes,
  type Chart,
  type ChartKind,
  type ChartOf,
  type Protect,
} from "@/lib/exhbt/charts";
import { FieldIssues } from "./FieldIssues";
import { issuesAt } from "./model";

const ICONS: Record<ChartKind, LucideIcon> = {
  beforeAfter: ArrowRightLeft,
  bar: ChartBar,
  groupedBar: ChartBarBig,
  stackedBar: ChartBarStacked,
  line: ChartLine,
  scatter: ChartScatter,
  numbers: Hash,
  table: Table,
};

/** What each kind is for, under the picker. */
const KIND_HINTS: Record<ChartKind, string> = {
  beforeAfter: "One measure, before and after a change. Up to 3 rows.",
  bar: "One measure across 2 to 8 things.",
  groupedBar: "2 to 4 series side by side, in up to 6 groups.",
  stackedBar: "Parts that add up to a whole, up to 8 bars.",
  line: "Up to 4 lines over weeks, months or rounds, 2 to 12 points.",
  scatter: "3 to 30 pairs of figures, to show how two measures move together.",
  numbers: "2 to 4 headline figures, each with what it measures.",
  table: "A small table: up to 5 columns and 6 rows.",
};

/**
 * One graph: its kind (switching keeps what fits), its title and labels, which part stands out,
 * whether to protect the real numbers, and its figures as a small grid typed in by hand. Drawn
 * live below with the same Chart the project page uses.
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
  const base = `charts.${index}`;
  const c = chart;
  /** Sets fields on this graph, dropping optional text fields left empty. */
  const set = (patch: Record<string, unknown>) => {
    const next = { ...c, ...patch } as Record<string, unknown>;
    for (const k of ["unit", "xTitle", "yTitle", "xUnit"]) if (k in next && next[k] === "" && !(c.kind === "scatter" && (k === "xTitle" || k === "yTitle"))) delete next[k];
    for (const k of ["highlight", "protect", "lowerIsBetter"]) if (k in next && next[k] === undefined) delete next[k];
    if (c.kind !== "beforeAfter" && next.lowerIsBetter === false) delete next.lowerIsBetter;
    onChange(next as Chart);
  };
  const at = (path: string) => issuesAt(issues, `${base}.${path}`);
  const bad = (path: string) => at(path).length > 0 || undefined;
  const dataIssues = issues.filter((i) => i.path.startsWith(`${base}.`) && !/\.(title|xTitle|yTitle|protect)$/.test(i.path));

  return (
    <fieldset className="rounded-[14px] border border-line p-4">
      <legend className="px-1 text-sm font-semibold">Graph {n}</legend>

      <KindPicker name={`${p}-kind`} n={n} value={c.kind} onChange={(k) => onChange(untouched(c) ? { ...newChart(k), title: c.title } : convertChart(c, k))} />

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor={`${p}-title`} className="label">
            Title
          </label>
          <input
            id={`${p}-title`}
            className="field"
            value={c.title}
            onChange={(e) => set({ title: e.target.value })}
            placeholder="e.g. Missed appointments (%)"
            aria-invalid={bad("title")}
            aria-describedby={`${p}-title-issues`}
          />
          <FieldIssues id={`${p}-title-issues`} issues={at("title")} />
        </div>
        <Settings c={c} p={p} set={set} at={at} bad={bad} />
      </div>

      {protectModes(c.kind).length > 0 && "rows" in c && <ProtectChoice c={c as ProtectableChart} p={p} set={set} issues={at("protect")} />}

      <div className="mt-4">
        <Grid c={c} n={n} set={set} bad={bad} />
      </div>
      <FieldIssues id={`${p}-data-issues`} issues={dataIssues.map((i) => ({ ...i, message: `${where(i.path, c)}${i.message}` }))} />

      <div className="mt-3 flex flex-wrap justify-end gap-2">
        <Button size="sm" variant="danger" label={`Remove graph ${n}`} onClick={onRemove}>
          Remove graph
        </Button>
      </div>

      {hasData(c) && (
        <div className="mt-4 rounded-[12px] border border-line bg-surface p-4">
          <p className="mb-3 text-xs font-semibold text-graphite" aria-hidden>
            How it looks
          </p>
          <ChartView data={c} />
        </div>
      )}
    </fieldset>
  );
}

/* ---------------- The kind ---------------- */

/** Nothing filled in but perhaps the title: switching kind starts that kind afresh rather than carrying empty rows over. */
const untouched = (c: Chart) => JSON.stringify({ ...c, title: "" }) === JSON.stringify({ ...newChart(c.kind), title: "" });

function KindPicker({ name, n, value, onChange }: { name: string; n: number; value: ChartKind; onChange: (k: ChartKind) => void }) {
  return (
    <fieldset>
      <legend className="label">Type of graph {n}</legend>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {CHART_KINDS.map((k) => {
          const Icon = ICONS[k];
          return (
            <label
              key={k}
              className={`flex cursor-pointer items-center gap-2 rounded-[10px] border-[1.5px] px-2.5 py-2 text-sm has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-solid has-[:focus-visible]:outline-jade ${
                value === k ? "border-ink bg-wash font-semibold" : "border-line hover:border-field"
              }`}
            >
              <input type="radio" name={name} value={k} checked={value === k} onChange={() => onChange(k)} className="sr-only" />
              <Icon aria-hidden size={16} strokeWidth={2} className="shrink-0" />
              {KIND_NAMES[k]}
            </label>
          );
        })}
      </div>
      <p className="hint mt-1.5">{KIND_HINTS[value]} Switching keeps the figures that fit.</p>
    </fieldset>
  );
}

/* ---------------- Labels, unit, which way is better, the highlight ---------------- */

type SetFn = (patch: Record<string, unknown>) => void;
type At = (path: string) => Issue[];
type Bad = (path: string) => true | undefined;

function Settings({ c, p, set, at, bad }: { c: Chart; p: string; set: SetFn; at: At; bad: Bad }) {
  const text = (key: string, label: string, value: string | undefined, placeholder?: string, opts: { optional?: boolean; max?: number } = {}) => (
    <div>
      <label htmlFor={`${p}-${key}`} className="label">
        {label} {opts.optional && <span className="font-normal text-graphite">(optional)</span>}
      </label>
      <input
        id={`${p}-${key}`}
        className="field"
        value={value ?? ""}
        placeholder={placeholder}
        maxLength={opts.max}
        onChange={(e) => set({ [key]: e.target.value })}
        aria-invalid={bad(key)}
        aria-describedby={`${p}-${key}-issues`}
      />
      <FieldIssues id={`${p}-${key}-issues`} issues={at(key)} />
    </div>
  );
  const unit = (key = "unit", label = "Unit") => text(key, label, (c as { unit?: string; xUnit?: string })[key as "unit"], "e.g. % or £ or min", { optional: true, max: 8 });
  const lower = (
    <label className="flex items-center gap-3 self-end pb-3">
      <input type="checkbox" className="size-4 accent-jade" checked={"lowerIsBetter" in c && Boolean(c.lowerIsBetter)} onChange={(e) => set({ lowerIsBetter: e.target.checked })} />
      <span>Lower is better</span>
    </label>
  );

  switch (c.kind) {
    case "beforeAfter":
      return (
        <>
          {text("beforeLabel", "Before is called", c.beforeLabel)}
          {text("afterLabel", "After is called", c.afterLabel)}
          {c.protect ? <ProtectedUnit /> : unit()}
          {lower}
        </>
      );
    case "bar":
    case "groupedBar":
    case "stackedBar":
    case "line": {
      const line = c.kind === "line";
      const options =
        c.kind === "bar"
          ? [{ value: "", label: "None: all bars the same" }, ...c.rows.map((r, j) => ({ value: String(j), label: r.label.trim() || `Bar ${j + 1}` }))]
          : c.series.map((s, k) => ({ value: String(k), label: s.trim() || `Series ${k + 1}` }));
      return (
        <>
          {text("xTitle", line ? "Along the bottom" : "What the rows are", c.xTitle, line ? "e.g. Week" : "e.g. Till", { optional: true })}
          {text("yTitle", "What the values measure", c.yTitle, "e.g. Minutes waited", { optional: true })}
          {c.protect ? <ProtectedUnit /> : unit()}
          {c.kind !== "stackedBar" ? lower : <span />}
          <Highlight
            id={`${p}-highlight`}
            label={c.kind === "bar" ? "Bar to stand out" : line ? "Line to stand out (darkest, with its values)" : "Series to stand out (darkest)"}
            value={c.highlight === undefined ? (c.kind === "bar" ? "" : "0") : String(c.highlight)}
            options={options}
            onChange={(v) => set({ highlight: v === "" ? undefined : Number(v) })}
          />
        </>
      );
    }
    case "scatter":
      return (
        <>
          {text("xTitle", "Across: what it measures", c.xTitle, "e.g. Hours revised")}
          {unit("xUnit", "Across: unit")}
          {text("yTitle", "Up: what it measures", c.yTitle, "e.g. Exam mark")}
          {unit("unit", "Up: unit")}
          <Highlight
            id={`${p}-highlight`}
            label="Point to stand out"
            value={c.highlight === undefined ? "" : String(c.highlight)}
            options={[{ value: "", label: "None" }, ...c.points.map((pt, j) => ({ value: String(j), label: pt.label?.trim() || `Point ${j + 1}` }))]}
            onChange={(v) => set({ highlight: v === "" ? undefined : Number(v) })}
          />
        </>
      );
    case "numbers":
      return (
        <Highlight
          id={`${p}-highlight`}
          label="Number to stand out"
          value={c.highlight === undefined ? "" : String(c.highlight)}
          options={[{ value: "", label: "None" }, ...c.tiles.map((t, j) => ({ value: String(j), label: t.label.trim() || `Number ${j + 1}` }))]}
          onChange={(v) => set({ highlight: v === "" ? undefined : Number(v) })}
        />
      );
    case "table":
      return (
        <Highlight
          id={`${p}-highlight`}
          label="Row to stand out"
          value={c.highlight === undefined ? "" : String(c.highlight)}
          options={[{ value: "", label: "None" }, ...c.rows.map((r, j) => ({ value: String(j), label: r[0]?.trim() || `Row ${j + 1}` }))]}
          onChange={(v) => set({ highlight: v === "" ? undefined : Number(v) })}
        />
      );
  }
}

function ProtectedUnit() {
  return (
    <div>
      <span className="label">Unit</span>
      <p className="hint pt-2">None: the numbers are protected, so the graph shows changes, not units.</p>
    </div>
  );
}

function Highlight({ id, label, value, options, onChange }: { id: string; label: string; value: string; options: { value: string; label: string }[]; onChange: (v: string) => void }) {
  return (
    <div>
      <label htmlFor={id} className="label">
        {label}
      </label>
      <select id={id} className="field" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/* ---------------- Protect the real numbers ---------------- */

type ProtectableChart = ChartOf<"beforeAfter" | "bar" | "groupedBar" | "stackedBar" | "line">;

function ProtectChoice({ c, p, set, issues }: { c: ProtectableChart; p: string; set: SetFn; issues: Issue[] }) {
  const modes = protectModes(c.kind);
  const start: Record<string, string> = {
    beforeAfter: "each before value",
    bar: "the first bar",
    groupedBar: "the first bar in each group",
    line: "each line's first point",
    stackedBar: "the first bar's total",
  };
  return (
    <div className="mt-4 rounded-[12px] bg-mist p-3">
      <label htmlFor={`${p}-protect`} className="label">
        Protect the real numbers
      </label>
      <select
        id={`${p}-protect`}
        className="field"
        value={c.protect ?? ""}
        aria-describedby={`${p}-protect-hint ${p}-protect-issues`}
        aria-invalid={issues.length > 0 || undefined}
        onChange={(e) => set({ protect: (e.target.value || undefined) as Protect | undefined })}
      >
        <option value="">No: show the figures as typed</option>
        {modes.includes("change") && <option value="change">Yes: show the change from {start[c.kind]}, in %</option>}
        {modes.includes("index") && <option value="index">Yes: show an index, {start[c.kind]} = 100</option>}
      </select>
      <p id={`${p}-protect-hint`} className="hint mt-1.5">
        For confidential work. Type the real figures, or ones you&apos;ve already turned into changes. When protected, your exhbt shows only the change, with a note saying so, and the figures you typed stay in your draft: they&apos;re never published. Check the title, labels and findings don&apos;t give them away.
      </p>
      <FieldIssues id={`${p}-protect-issues`} issues={issues} />
    </div>
  );
}

/* ---------------- The figures ---------------- */

const cell = "field min-w-[4.5rem] px-2 py-1.5 text-sm";

function Grid({ c, n, set, bad }: { c: Chart; n: number; set: SetFn; bad: Bad }) {
  switch (c.kind) {
    case "beforeAfter":
      return (
        <SeriesGrid
          n={n}
          rowNoun="row"
          labelNoun="group"
          labelHead="Group"
          names={[c.beforeLabel || "Before", c.afterLabel || "After"]}
          rows={c.rows.map((r) => ({ label: r.label, values: [r.before, r.after] }))}
          maxRows={L.beforeAfter.rows.max}
          minRows={L.beforeAfter.rows.min}
          bad={bad}
          onRows={(rows) => set({ rows: rows.map((r) => ({ label: r.label, before: r.values[0] ?? 0, after: r.values[1] ?? 0 })) })}
        />
      );
    case "bar":
      return (
        <SeriesGrid
          n={n}
          rowNoun="bar"
          labelNoun="label"
          labelHead="Bar"
          names={[c.yTitle || "Value"]}
          rows={c.rows.map((r) => ({ label: r.label, values: [r.value] }))}
          maxRows={L.bar.rows.max}
          minRows={1}
          bad={bad}
          onRows={(rows) => set({ rows: rows.map((r) => ({ label: r.label, value: r.values[0] ?? 0 })) })}
        />
      );
    case "groupedBar":
    case "stackedBar":
    case "line": {
      const lim = L[c.kind];
      const nouns = { groupedBar: ["group", "Group"], stackedBar: ["bar", "Bar"], line: ["point", "Point"] }[c.kind];
      return (
        <SeriesGrid
          n={n}
          rowNoun={nouns[0]!}
          labelNoun="label"
          labelHead={c.xTitle || nouns[1]!}
          names={c.series}
          editableNames
          seriesNoun={c.kind === "line" ? "line" : c.kind === "stackedBar" ? "part" : "series"}
          rows={c.rows}
          maxRows={lim.rows.max}
          minRows={1}
          maxSeries={lim.series.max}
          minSeries={1}
          bad={bad}
          onRows={(rows) => set({ rows })}
          onNames={(names, rows) => set({ series: names, rows, ...(c.highlight !== undefined && c.highlight >= names.length ? { highlight: undefined } : {}) })}
        />
      );
    }
    case "scatter":
      return <ScatterGrid c={c} n={n} set={set} bad={bad} />;
    case "numbers":
      return <NumbersGrid c={c} n={n} set={set} bad={bad} />;
    case "table":
      return <TableGrid c={c} n={n} set={set} bad={bad} />;
  }
}

type Row = { label: string; values: number[] };

/** Rows of a label and one number per series; series can be added, named and removed where the kind allows. */
function SeriesGrid({
  n,
  rowNoun,
  labelNoun,
  labelHead,
  names,
  editableNames = false,
  seriesNoun = "series",
  rows,
  maxRows,
  minRows,
  maxSeries = names.length,
  minSeries = names.length,
  bad,
  onRows,
  onNames,
}: {
  n: number;
  rowNoun: string;
  labelNoun: string;
  labelHead: string;
  names: string[];
  editableNames?: boolean;
  seriesNoun?: string;
  rows: Row[];
  maxRows: number;
  minRows: number;
  maxSeries?: number;
  minSeries?: number;
  bad: Bad;
  onRows: (rows: Row[]) => void;
  onNames?: (names: string[], rows: Row[]) => void;
}) {
  const setRow = (j: number, patch: Partial<Row>) => onRows(rows.map((r, i) => (i === j ? { ...r, ...patch } : r)));
  const setValue = (j: number, k: number, v: number) => setRow(j, { values: names.map((_, i) => (i === k ? v : (rows[j]!.values[i] ?? 0))) });
  const valueName = (k: number) => names[k]?.trim() || (names.length === 1 ? "value" : `${seriesNoun} ${k + 1}`);
  const rowPath = (j: number) => `rows.${j}`;
  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">Graph {n} figures</caption>
          <thead>
            <tr className="text-left text-graphite">
              <th scope="col" className="pr-2 pb-1 font-semibold">
                {labelHead}
              </th>
              {names.map((name, k) => (
                <th key={k} scope="col" className="pr-2 pb-1 align-bottom font-semibold">
                  {editableNames && onNames ? (
                    <span className="flex items-center gap-1">
                      <input
                        aria-label={`Graph ${n}, ${seriesNoun} ${k + 1} name`}
                        className={cell}
                        value={name}
                        placeholder={`${seriesNoun[0]!.toUpperCase()}${seriesNoun.slice(1)} ${k + 1}`}
                        aria-invalid={bad(`series.${k}`)}
                        onChange={(e) => onNames(names.map((x, i) => (i === k ? e.target.value : x)), rows)}
                      />
                      {names.length > minSeries && (
                        <Button
                          size="sm"
                          label={`Remove ${seriesNoun} ${k + 1} from graph ${n}`}
                          onClick={() =>
                            onNames(
                              names.filter((_, i) => i !== k),
                              rows.map((r) => ({ ...r, values: r.values.filter((_, i) => i !== k) })),
                            )
                          }
                        >
                          <X aria-hidden size={14} strokeWidth={2.25} />
                        </Button>
                      )}
                    </span>
                  ) : (
                    name
                  )}
                </th>
              ))}
              <th scope="col" className="sr-only">
                Remove
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, j) => (
              <tr key={j}>
                <td className="py-1 pr-2">
                  <input
                    aria-label={`Graph ${n}, ${rowNoun} ${j + 1} ${labelNoun}`}
                    className={cell}
                    value={r.label}
                    aria-invalid={bad(`${rowPath(j)}.label`) ?? bad(rowPath(j))}
                    onChange={(e) => setRow(j, { label: e.target.value })}
                  />
                </td>
                {names.map((_, k) => (
                  <td key={k} className="py-1 pr-2">
                    <NumberInput label={`Graph ${n}, ${rowNoun} ${j + 1} ${valueName(k)}`} value={r.values[k] ?? 0} onChange={(v) => setValue(j, k, v)} />
                  </td>
                ))}
                <td className="py-1">
                  <Button size="sm" label={`Remove ${rowNoun} ${j + 1} from graph ${n}`} disabled={rows.length <= minRows} onClick={() => onRows(rows.filter((_, i) => i !== j))}>
                    <X aria-hidden size={14} strokeWidth={2.25} />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <Button size="sm" disabled={rows.length >= maxRows} label={`Add a ${rowNoun} to graph ${n}`} onClick={() => onRows([...rows, { label: "", values: names.map(() => 0) }])}>
          <Plus aria-hidden size={14} strokeWidth={2.25} /> Add a {rowNoun}
        </Button>
        {editableNames && onNames && (
          <Button
            size="sm"
            disabled={names.length >= maxSeries}
            label={`Add a ${seriesNoun} to graph ${n}`}
            onClick={() =>
              onNames(
                [...names, ""],
                rows.map((r) => ({ ...r, values: [...r.values, 0] })),
              )
            }
          >
            <Plus aria-hidden size={14} strokeWidth={2.25} /> Add a {seriesNoun}
          </Button>
        )}
      </div>
    </div>
  );
}

function ScatterGrid({ c, n, set, bad }: { c: ChartOf<"scatter">; n: number; set: SetFn; bad: Bad }) {
  const setPoint = (j: number, patch: Partial<ChartOf<"scatter">["points"][number]>) =>
    set({
      points: c.points.map((pt, i) => {
        if (i !== j) return pt;
        const next = { ...pt, ...patch };
        if (!next.label) delete next.label;
        return next;
      }),
    });
  const across = c.xTitle.trim() || "across";
  const up = c.yTitle.trim() || "up";
  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">Graph {n} points</caption>
          <thead>
            <tr className="text-left text-graphite">
              <th scope="col" className="pr-2 pb-1 font-semibold">
                Label <span className="font-normal">(optional)</span>
              </th>
              <th scope="col" className="pr-2 pb-1 font-semibold">
                {c.xTitle || "Across"}
              </th>
              <th scope="col" className="pr-2 pb-1 font-semibold">
                {c.yTitle || "Up"}
              </th>
              <th scope="col" className="sr-only">
                Remove
              </th>
            </tr>
          </thead>
          <tbody>
            {c.points.map((pt, j) => (
              <tr key={j}>
                <td className="py-1 pr-2">
                  <input aria-label={`Graph ${n}, point ${j + 1} label`} className={cell} value={pt.label ?? ""} aria-invalid={bad(`points.${j}.label`)} onChange={(e) => setPoint(j, { label: e.target.value })} />
                </td>
                <td className="py-1 pr-2">
                  <NumberInput label={`Graph ${n}, point ${j + 1} ${across}`} value={pt.x} onChange={(x) => setPoint(j, { x })} />
                </td>
                <td className="py-1 pr-2">
                  <NumberInput label={`Graph ${n}, point ${j + 1} ${up}`} value={pt.y} onChange={(y) => setPoint(j, { y })} />
                </td>
                <td className="py-1">
                  <Button size="sm" label={`Remove point ${j + 1} from graph ${n}`} disabled={c.points.length <= 1} onClick={() => set({ points: c.points.filter((_, i) => i !== j) })}>
                    <X aria-hidden size={14} strokeWidth={2.25} />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-2">
        <Button size="sm" disabled={c.points.length >= L.scatter.points.max} label={`Add a point to graph ${n}`} onClick={() => set({ points: [...c.points, { x: 0, y: 0 }] })}>
          <Plus aria-hidden size={14} strokeWidth={2.25} /> Add a point
        </Button>
      </div>
    </div>
  );
}

function NumbersGrid({ c, n, set, bad }: { c: ChartOf<"numbers">; n: number; set: SetFn; bad: Bad }) {
  type Tile = ChartOf<"numbers">["tiles"][number];
  const setTile = (j: number, patch: Partial<Tile>) =>
    set({
      tiles: c.tiles.map((t, i) => {
        if (i !== j) return t;
        const next = { ...t, ...patch };
        if (!next.unit) delete next.unit;
        if (next.from === undefined) delete next.from;
        return next;
      }),
    });
  return (
    <div>
      <ol className="space-y-3">
        {c.tiles.map((t, j) => (
          <li key={j} className="grid grid-cols-2 gap-2 rounded-[12px] border border-line p-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,0.7fr)_minmax(0,1fr)_auto] sm:items-end">
            <div className="col-span-2 sm:col-span-1">
              <span className="mb-1 block text-xs font-semibold text-graphite" aria-hidden>
                What number {j + 1} measures
              </span>
              <input aria-label={`Graph ${n}, number ${j + 1} label`} className={cell} value={t.label} placeholder="e.g. missed appointments" aria-invalid={bad(`tiles.${j}.label`)} onChange={(e) => setTile(j, { label: e.target.value })} />
            </div>
            <div>
              <span className="mb-1 block text-xs font-semibold text-graphite" aria-hidden>
                Value
              </span>
              <NumberInput label={`Graph ${n}, number ${j + 1} value`} value={t.value} onChange={(value) => setTile(j, { value })} />
            </div>
            <div>
              <span className="mb-1 block text-xs font-semibold text-graphite" aria-hidden>
                Unit
              </span>
              <input aria-label={`Graph ${n}, number ${j + 1} unit`} className={cell} value={t.unit ?? ""} maxLength={8} placeholder="%" onChange={(e) => setTile(j, { unit: e.target.value })} />
            </div>
            <div>
              <span className="mb-1 block text-xs font-semibold text-graphite" aria-hidden>
                From <span className="font-normal">(optional)</span>
              </span>
              <NumberInput label={`Graph ${n}, number ${j + 1} from`} value={t.from} onChange={(from) => setTile(j, { from })} onClear={() => setTile(j, { from: undefined })} />
            </div>
            <div className="flex justify-end">
              <Button size="sm" label={`Remove number ${j + 1} from graph ${n}`} disabled={c.tiles.length <= 1} onClick={() => set({ tiles: c.tiles.filter((_, i) => i !== j) })}>
                <X aria-hidden size={14} strokeWidth={2.25} />
              </Button>
            </div>
          </li>
        ))}
      </ol>
      <div className="mt-2">
        <Button size="sm" disabled={c.tiles.length >= L.numbers.tiles.max} label={`Add a number to graph ${n}`} onClick={() => set({ tiles: [...c.tiles, { value: 0, label: "" }] })}>
          <Plus aria-hidden size={14} strokeWidth={2.25} /> Add a number
        </Button>
      </div>
    </div>
  );
}

function TableGrid({ c, n, set, bad }: { c: ChartOf<"table">; n: number; set: SetFn; bad: Bad }) {
  const setCell = (j: number, k: number, v: string) => set({ rows: c.rows.map((r, i) => (i === j ? c.columns.map((_, x) => (x === k ? v : (r[x] ?? ""))) : r)) });
  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">Graph {n} table</caption>
          <thead>
            <tr>
              {c.columns.map((h, k) => (
                <th key={k} scope="col" className="pr-2 pb-1 text-left align-bottom">
                  <span className="flex items-center gap-1">
                    <input aria-label={`Graph ${n}, column ${k + 1} heading`} className={`${cell} font-semibold`} value={h} placeholder={`Column ${k + 1}`} aria-invalid={bad(`columns.${k}`)} onChange={(e) => set({ columns: c.columns.map((x, i) => (i === k ? e.target.value : x)) })} />
                    {c.columns.length > 1 && (
                      <Button
                        size="sm"
                        label={`Remove column ${k + 1} from graph ${n}`}
                        onClick={() => set({ columns: c.columns.filter((_, i) => i !== k), rows: c.rows.map((r) => r.filter((_, i) => i !== k)) })}
                      >
                        <X aria-hidden size={14} strokeWidth={2.25} />
                      </Button>
                    )}
                  </span>
                </th>
              ))}
              <th scope="col" className="sr-only">
                Remove
              </th>
            </tr>
          </thead>
          <tbody>
            {c.rows.map((r, j) => (
              <tr key={j}>
                {c.columns.map((_, k) => (
                  <td key={k} className="py-1 pr-2">
                    <input aria-label={`Graph ${n}, row ${j + 1}, column ${k + 1}`} className={cell} value={r[k] ?? ""} aria-invalid={bad(`rows.${j}.${k}`) ?? bad(`rows.${j}`)} onChange={(e) => setCell(j, k, e.target.value)} />
                  </td>
                ))}
                <td className="py-1">
                  <Button size="sm" label={`Remove row ${j + 1} from graph ${n}`} disabled={c.rows.length <= 1} onClick={() => set({ rows: c.rows.filter((_, i) => i !== j) })}>
                    <X aria-hidden size={14} strokeWidth={2.25} />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <Button size="sm" disabled={c.rows.length >= L.table.rows.max} label={`Add a row to graph ${n}`} onClick={() => set({ rows: [...c.rows, c.columns.map(() => "")] })}>
          <Plus aria-hidden size={14} strokeWidth={2.25} /> Add a row
        </Button>
        <Button
          size="sm"
          disabled={c.columns.length >= L.table.columns.max}
          label={`Add a column to graph ${n}`}
          onClick={() => set({ columns: [...c.columns, ""], rows: c.rows.map((r) => [...r, ""]) })}
        >
          <Plus aria-hidden size={14} strokeWidth={2.25} /> Add a column
        </Button>
      </div>
    </div>
  );
}

/* ---------------- Numbers, typed ---------------- */

/** "1,250", "£1,250", "18%", "−4.5": the number, or null when it isn't one. */
export function parseTyped(s: string): number | null {
  const t = s.trim().replace(/[,£$€%\s]/g, "").replace(/^[−–]/, "-");
  if (!t || !/^[-+]?(\d+\.?\d*|\.\d+)$/.test(t)) return null;
  const v = Number(t);
  return Number.isFinite(v) ? v : null;
}

/**
 * A number box that lets the person clear it or type freely; only numbers reach the doc. Says
 * so, under the box, when what's typed isn't a number. `optional` lets it be left empty.
 */
function NumberInput({ label, value, onChange, onClear }: { label: string; value: number | undefined; onChange: (v: number) => void; onClear?: () => void }) {
  const [text, setText] = useState(value === undefined ? "" : String(value));
  useEffect(() => {
    const typed = parseTyped(text);
    if (typed !== (value ?? null)) setText(value === undefined ? "" : String(value));
    // Only when the value changes from outside.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  const parsed = parseTyped(text);
  const wrong = text.trim() !== "" && parsed === null;
  return (
    <span className="block">
      <input
        aria-label={label}
        inputMode="decimal"
        className={`${cell} font-mono ${wrong ? "border-error" : ""}`}
        value={text}
        aria-invalid={wrong || undefined}
        onChange={(e) => {
          setText(e.target.value);
          const v = parseTyped(e.target.value);
          if (v !== null) onChange(v);
          else if (onClear && e.target.value.trim() === "") onClear();
        }}
      />
      {wrong && (
        <span role="alert" className="mt-0.5 block text-xs text-error">
          Type a number
        </span>
      )}
    </span>
  );
}

/* ---------------- Where an issue is ---------------- */

/** "Bar 3: " for charts.0.rows.2.label, so the message under the grid says which box. */
function where(path: string, c: Chart): string {
  const parts = path.split(".").slice(2);
  const [what, i] = parts;
  const k = i !== undefined && /^\d+$/.test(i) ? Number(i) + 1 : null;
  if (!k) return "";
  const rowNoun: Record<string, string> = { beforeAfter: "Row", bar: "Bar", groupedBar: "Group", stackedBar: "Bar", line: "Point", table: "Row" };
  if (what === "rows") return `${rowNoun[c.kind] ?? "Row"} ${k}: `;
  if (what === "series") return `${c.kind === "line" ? "Line" : c.kind === "stackedBar" ? "Part" : "Series"} ${k}: `;
  if (what === "columns") return `Column ${k}: `;
  if (what === "points") return `Point ${k}: `;
  if (what === "tiles") return `Number ${k}: `;
  return "";
}
