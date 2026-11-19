"use client";

import type { ReactNode } from "react";
import { ChartEditor } from "@/components/editor/ChartEditor";
import { useIssues, useUiState } from "../context";
import { useDoc, useSection, useStore } from "../store";
import { Sheet } from "../ui/Sheet";

/** A graph's figures: the existing ChartEditor in a sheet, the graph on the page redrawing behind it (decision 0026). J's: this is G's stub. */
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
  const issues = useIssues();
  const s = useSection(id);
  const index = useDoc((d) => d.sections.findIndex((x) => x.id === id));
  const n = useDoc((d) => d.sections.filter((x) => x.kind === "graph").findIndex((x) => x.id === id));
  if (s?.kind !== "graph") return null;
  return <ChartEditor chart={s.chart} index={Math.max(0, n)} base={`sections.${index}.chart`} bare onChange={(chart) => store.patch(id, (x) => (x.kind === "graph" ? { ...x, chart } : x))} issues={issues.shown} />;
}
