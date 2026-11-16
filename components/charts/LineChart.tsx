import { chartSummary, displayed, protectNote, valueFormatter, type ChartOf } from "@/lib/exhbt/charts";
import { ChartFrame, MarkerShape } from "./ChartFrame";
import { scaleFor, tickLabel } from "./scale";
import { DASHES, MARKERS, SERIES_RAMP, seriesRank } from "./series";

/**
 * Up to four lines over an ordered axis (weeks, months, rounds). The lines are SVG, stretched to
 * the plot with strokes that keep their 2px width; markers, values and labels are HTML laid over
 * it, so text stays crisp at any width. Each line has its own shade, dash and marker shape.
 * The highlighted line's values are printed above its points (on a narrow graph with many
 * points, the first and last only); each other line's last value is printed at its end where
 * it doesn't collide. Every figure is in the hidden table.
 */
export function LineChart({ data }: { data: ChartOf<"line"> }) {
  const c = displayed(data) as ChartOf<"line">;
  const f = valueFormatter(c);
  const n = c.series.length;
  const pts = c.rows.length;
  const s = scaleFor(c.rows.flatMap((r) => r.values), { pad: true });
  const x = (j: number) => (pts <= 1 ? 50 : (j / (pts - 1)) * 100);
  const y = (v: number) => 100 - s.at(v);
  const name = (k: number) => c.series[k]?.trim() || `Line ${k + 1}`;
  const rank = (k: number) => seriesRank(k, n, c.highlight);
  const top = c.series.findIndex((_, k) => rank(k) === 0);
  const crowded = pts > 6;

  // End labels for the other lines, dropped where they'd sit on top of one already placed.
  const ends: { k: number; at: number }[] = [];
  for (const k of c.series.map((_, k) => k).filter((k) => k !== top)) {
    const at = y(c.rows[pts - 1]?.values[k] ?? 0);
    if ([...ends.map((e) => e.at), y(c.rows[pts - 1]?.values[top] ?? 0)].every((o) => Math.abs(o - at) >= 9)) ends.push({ k, at });
  }

  return (
    <ChartFrame
      title={c.title}
      summary={chartSummary(data)}
      legend={c.series.map((_, k) => ({ label: name(k), colour: SERIES_RAMP[rank(k)]!, marker: MARKERS[rank(k)]!, dash: DASHES[rank(k)] }))}
      notes={[c.lowerIsBetter ? "Lower is better." : null, protectNote(data)]}
      table={{ head: [c.xTitle || "Point", ...c.series.map((_, k) => name(k))], rows: c.rows.map((r) => [r.label, ...c.series.map((_, k) => f(r.values[k] ?? 0))]) }}
    >
      {c.yTitle && <p className="mb-1 text-xs font-semibold text-graphite">{c.yTitle}</p>}
      <div className="pt-5 pr-16 pb-6 pl-11">
        <div className="relative h-40 @lg:h-48 print:h-[38mm]">
          {s.ticks.map((t) => (
            <div key={t} className="absolute inset-x-0" style={{ top: `${y(t)}%` }}>
              <span className={`absolute inset-x-0 h-px ${t === 0 && s.lo < 0 ? "bg-graphite" : "bg-line"}`} />
              <span className="absolute right-[calc(100%+6px)] -translate-y-1/2 font-mono text-[0.68rem] whitespace-nowrap text-slate">{tickLabel(t, s, c.unit)}</span>
            </div>
          ))}

          <svg aria-hidden viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible">
            {c.series
              .map((_, k) => k)
              .sort((a, b) => rank(b) - rank(a))
              .map((k) => (
                <polyline
                  key={k}
                  points={c.rows.map((r, j) => `${x(j).toFixed(2)},${y(r.values[k] ?? 0).toFixed(2)}`).join(" ")}
                  fill="none"
                  stroke={SERIES_RAMP[rank(k)]}
                  strokeWidth={rank(k) === 0 ? 2.5 : 2}
                  strokeDasharray={DASHES[rank(k)] || undefined}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
              ))}
          </svg>

          {c.series.map((_, k) =>
            c.rows.map((r, j) => (
              <svg aria-hidden key={`${k}-${j}`} width="10" height="10" viewBox="0 0 10 10" className="absolute -translate-x-1/2 -translate-y-1/2 overflow-visible" style={{ left: `${x(j)}%`, top: `${y(r.values[k] ?? 0)}%` }}>
                <MarkerShape marker={MARKERS[rank(k)]!} colour={SERIES_RAMP[rank(k)]!} cx={5} cy={5} r={4} />
              </svg>
            )),
          )}

          {top >= 0 &&
            c.rows.map((r, j) => (
              <span
                key={j}
                className={`absolute -translate-x-1/2 -translate-y-[calc(100%+7px)] font-mono text-[0.7rem] font-semibold whitespace-nowrap text-ink ${
                  crowded && j !== 0 && j !== pts - 1 ? "hidden @xl:block" : ""
                }`}
                style={{ left: `${x(j)}%`, top: `${y(r.values[top] ?? 0)}%` }}
              >
                {f(r.values[top] ?? 0)}
              </span>
            ))}

          {ends.map(({ k, at }) => (
            <span key={k} className="absolute left-[calc(100%+8px)] -translate-y-1/2 font-mono text-[0.7rem] whitespace-nowrap text-ink" style={{ top: `${at}%` }}>
              {f(c.rows[pts - 1]?.values[k] ?? 0)}
            </span>
          ))}

          {c.rows.map((r, j) => (
            <span
              key={j}
              className={`absolute top-[calc(100%+6px)] w-max max-w-[7rem] text-center text-[0.72rem] leading-tight text-graphite ${j === 0 ? "" : j === pts - 1 ? "-translate-x-full text-right" : "-translate-x-1/2"} ${
                crowded && j % 2 === 1 && j !== pts - 1 ? "hidden @lg:block" : ""
              }`}
              style={{ left: `${x(j)}%` }}
            >
              {r.label}
            </span>
          ))}
        </div>
      </div>
      {c.xTitle && <p className="mt-1 text-center text-xs text-graphite">{c.xTitle}</p>}
    </ChartFrame>
  );
}
