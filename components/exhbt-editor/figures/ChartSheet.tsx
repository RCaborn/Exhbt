"use client";

import "../css/figures.css";
import { useLayoutEffect, useRef, type ReactNode } from "react";
import { ChartEditor } from "@/components/editor/ChartEditor";
import { Button } from "@/components/ui/Button";
import type { Chart } from "@/lib/exhbt/charts";
import { useIssues, useRuntime, useUiState } from "../context";
import { labelOf } from "../labels";
import { useDoc, useSection, useStore } from "../store";
import { Sheet } from "../ui/Sheet";

/*
 * A graph's figures (decision 0026, "What the page does not draw"): the existing ChartEditor, `bare`,
 * in a sheet at the side, the group named "Graph N" with its kind radios as in the classic editor.
 * Each change goes straight to the store with no undo entry, so the graph on the page redraws behind
 * the sheet as the person types. A graph just added opens here (F's board.add); so do "Edit figures"
 * and a press on the graph (GraphExtras), and "Things to fix" for any issue under `sections.N.chart`.
 *
 * ChartEditor's fields carry ids and names, not issue paths, so once it has drawn, each field and row
 * is given the `data-path` of the issues about it (`sections.N.chart.title`, `….rows.2.label`,
 * `….rows.2`, `….rows`): G's jump finds the exact field in the open sheet, or the row or grid an
 * issue with no field of its own is about.
 */
export function ChartSheet(): ReactNode {
  return (
    <Sheet name="chart" title="Edit figures">
      <ChartBody />
    </Sheet>
  );
}

function ChartBody() {
  const id = useUiState((s) => (s.sheet?.name === "chart" ? (s.sheet.sectionId ?? "") : ""));
  const store = useStore();
  const { uiApi } = useRuntime();
  const issues = useIssues();
  const s = useSection(id);
  const index = useDoc((d) => d.sections.findIndex((x) => x.id === id));
  const n = useDoc((d) => d.sections.filter((x) => x.kind === "graph").findIndex((x) => x.id === id));
  const label = useDoc((d) => labelOf(d, id));
  const root = useRef<HTMLDivElement>(null);
  const chart = s?.kind === "graph" ? s.chart : null;
  const base = `sections.${index}.chart`;
  const at = Math.max(0, n);

  // After every draw: the issue paths on ChartEditor's fields (a row added or the kind changed draws new ones).
  useLayoutEffect(() => {
    if (root.current && chart) tagPaths(root.current, chart, base, at);
  });

  if (!chart) return <p className="text-graphite">This graph is no longer on the page.</p>;
  return (
    <div ref={root} className="xe-fig-chart" data-chart-of={id}>
      <p className="mb-4 text-sm text-graphite">{label} on the page changes as you type.</p>
      <ChartEditor chart={chart} index={at} base={base} bare onChange={(c) => store.patch(id, (x) => (x.kind === "graph" ? { ...x, chart: c } : x))} issues={issues.shown} />
      <div className="mt-6 flex justify-end">
        <Button variant="ink" size="sm" onClick={() => uiApi.close()}>
          Done
        </Button>
      </div>
    </div>
  );
}

/** Gives ChartEditor's fields the issue paths chartIssues (lib/exhbt/charts.ts) reports, by their ids and their place in its grid. */
function tagPaths(root: HTMLElement, c: Chart, base: string, index: number) {
  const tag = (el: Element | null | undefined, path: string) => {
    const want = path ? `${base}.${path}` : base;
    if (el && el.getAttribute("data-path") !== want) el.setAttribute("data-path", want);
  };
  tag(root.querySelector("fieldset"), "");
  for (const key of ["title", "xTitle", "yTitle", "unit", "xUnit", "beforeLabel", "afterLabel", "protect", "highlight"]) tag(root.querySelector(`#chart-${index}-${key}`), key);

  // The figures: a table of rows (most kinds), of points (scatter), of cells (table), or a list of numbers.
  if (c.kind === "numbers") {
    const list = root.querySelector("fieldset ol");
    tag(list, "tiles");
    list?.querySelectorAll(":scope > li").forEach((li, j) => {
      tag(li, `tiles.${j}`);
      tag(li.querySelector("input"), `tiles.${j}.label`);
    });
    return;
  }
  const table = root.querySelector("fieldset table");
  if (!table) return;
  const rows = c.kind === "scatter" ? "points" : "rows";
  tag(table, rows);
  table.querySelectorAll(":scope > tbody > tr").forEach((tr, j) => {
    tag(tr, `${rows}.${j}`);
    if (c.kind === "table") tr.querySelectorAll("input").forEach((cell, k) => tag(cell, `rows.${j}.${k}`));
    else tag(tr.querySelector("input"), `${rows}.${j}.label`);
  });
  // Series names (grouped, stacked, line) and a table's headings sit in the head row.
  const head = table.querySelector(":scope > thead > tr");
  const names = head ? [...head.querySelectorAll("input")] : [];
  if (c.kind === "table") {
    tag(head, "columns");
    names.forEach((el, k) => tag(el, `columns.${k}`));
  } else if (names.length) {
    tag(head, "series");
    names.forEach((el, k) => tag(el, `series.${k}`));
  }
}
