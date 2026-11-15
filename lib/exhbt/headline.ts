import type { TileExhbt } from "@/components/exhbt/ExhbtTile";
import { chartsOf, type ExhbtDoc } from "./blocks";
import { asChart } from "./charts";

export type Headline = { value: string; label: string };

/** "−25%" with a real minus sign, or "+12%", rounded as the graph rounds it (components/exhbt/BeforeAfterChart.tsx). */
function pct(before: number, after: number): string | null {
  if (!Number.isFinite(before) || !Number.isFinite(after) || before === 0) return null;
  const n = Math.round((Math.abs(after - before) / Math.abs(before)) * 100);
  if (n === 0) return null;
  return `${after < before ? "−" : "+"}${n}%`;
}

/**
 * The number that sums an exhbt up, for its tile, its page and its link preview: the one the
 * person wrote, or else the change in the first row of their first graph (the first graph section
 * on the page, wherever it sits) when that is a before-and-after graph (their own figures, worked
 * out, never invented; a ratio, so it is the same when the graph's numbers are protected). Null
 * when there is neither; the methodology then carries the tile.
 */
export function headlineFor(doc: Pick<ExhbtDoc, "headline" | "sections">): Headline | null {
  if (doc.headline?.value.trim()) return doc.headline;
  const first = chartsOf(doc)[0];
  const chart = first ? asChart(first) : undefined;
  if (!chart || chart.kind !== "beforeAfter") return null;
  const row = chart.rows[0];
  if (!row) return null;
  const value = pct(row.before, row.after);
  if (!value) return null;
  const label = chart.rows.length > 1 && row.label ? `${chart.title}, ${row.label}` : chart.title;
  return { value, label: label.trim() };
}

/** A published exhbt as a portfolio tile (components/exhbt/ExhbtTile.tsx): the same tile the demo uses. */
export function tileFromDoc(doc: ExhbtDoc): TileExhbt {
  return {
    title: doc.title,
    context: doc.context,
    headline: headlineFor(doc),
    methodology: doc.flow.filter((s) => s.step.trim()),
    skills: doc.skills,
  };
}
