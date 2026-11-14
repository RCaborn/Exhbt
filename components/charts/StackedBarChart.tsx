import { chartSummary, displayed, protectNote, valueFormatter, type ChartOf } from "@/lib/exhbt/charts";
import { Axis, Row, Rows, Track, ValueLabel } from "./BarChart";
import { ChartFrame } from "./ChartFrame";
import { scaleFor } from "./scale";
import { seriesColour } from "./series";

/**
 * Stacked bars: one bar per row, split into its parts (the series), with a 2px gap of white
 * between parts. The total is printed at the bar's end. A part's value can't be printed inside
 * it without knowing it fits, so each bar's parts are listed under it, in the legend's order,
 * each with its swatch.
 */
export function StackedBarChart({ data }: { data: ChartOf<"stackedBar"> }) {
  const c = displayed(data) as ChartOf<"stackedBar">;
  const f = valueFormatter(c);
  const n = c.series.length;
  const totals = c.rows.map((r) => r.values.reduce((a, b) => a + Math.max(0, b), 0));
  const s = scaleFor(totals, { zero: true });
  const name = (k: number) => c.series[k]?.trim() || `Part ${k + 1}`;
  const colour = (k: number) => seriesColour(k, n, c.highlight);
  return (
    <ChartFrame
      title={c.title}
      summary={chartSummary(data)}
      legend={c.series.map((_, k) => ({ label: name(k), colour: colour(k) }))}
      notes={[protectNote(data)]}
      table={{
        head: [c.xTitle || "Bar", ...c.series.map((_, k) => name(k)), "Total"],
        rows: c.rows.map((r, j) => [r.label, ...c.series.map((_, k) => f(r.values[k] ?? 0)), f(totals[j]!)]),
      }}
    >
      <Rows xTitle={c.xTitle}>
        {c.rows.map((r, j) => (
          <Row key={j} label={r.label}>
            <div>
              <Track scale={s}>
                <span className="absolute top-1/2 flex h-4 -translate-y-1/2 gap-[2px] overflow-hidden rounded-r-[4px]" style={{ left: `${s.at(0)}%`, width: `${s.at(totals[j]!) - s.at(0)}%` }}>
                  {c.series.map((_, k) => {
                    const v = Math.max(0, r.values[k] ?? 0);
                    return v > 0 ? <span key={k} className="h-full min-w-[2px]" style={{ flex: `${v} 1 0`, background: colour(k) }} /> : null;
                  })}
                </span>
                <ValueLabel scale={s} value={totals[j]!} text={f(totals[j]!)} strong />
              </Track>
              <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 font-mono text-[0.68rem] text-ink">
                {c.series.map((_, k) => (
                  <span key={k} className="inline-flex items-center gap-1">
                    <span className="inline-block size-2 rounded-[2px]" style={{ background: colour(k) }} />
                    {f(r.values[k] ?? 0)}
                  </span>
                ))}
              </p>
            </div>
          </Row>
        ))}
      </Rows>
      <Axis scale={s} title={c.yTitle} />
    </ChartFrame>
  );
}
