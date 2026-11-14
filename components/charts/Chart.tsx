import { BeforeAfterChart } from "@/components/exhbt/BeforeAfterChart";
import { asChart, chartSummary, displayed, protectNote, type BeforeAfter, type Chart as ChartData } from "@/lib/exhbt/charts";
import { BarChart, GroupedBarChart } from "./BarChart";
import { LineChart } from "./LineChart";
import { NumberTiles } from "./NumberTiles";
import { ScatterChart } from "./ScatterChart";
import { StackedBarChart } from "./StackedBarChart";
import { TableChart } from "./TableChart";

/**
 * One graph on an exhbt, whatever its kind (decision 0011). Used by the project page
 * (components/portfolio/ProjectView.tsx) and the editor's preview, so both draw the same thing.
 * No hooks and no client code: it renders on the server and prints. Every kind prints its
 * values, sums itself up for screen readers and carries a hidden table of every figure (a
 * table graph is its own table).
 */
export function Chart({ data }: { data: ChartData }) {
  const c = asChart(data);
  switch (c.kind) {
    case "beforeAfter": {
      const shown = displayed(c) as BeforeAfter;
      return <BeforeAfterChart data={shown} summary={chartSummary(c)} note={protectNote(c)} signed={c.protect === "change"} showChange={c.protect !== "change"} />;
    }
    case "bar":
      return <BarChart data={c} />;
    case "groupedBar":
      return <GroupedBarChart data={c} />;
    case "stackedBar":
      return <StackedBarChart data={c} />;
    case "line":
      return <LineChart data={c} />;
    case "scatter":
      return <ScatterChart data={c} />;
    case "numbers":
      return <NumberTiles data={c} />;
    case "table":
      return <TableChart data={c} />;
  }
}
