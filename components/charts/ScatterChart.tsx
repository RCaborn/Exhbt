import { chartSummary, fmtValue, type ChartOf } from "@/lib/exhbt/charts";
import { ChartFrame } from "./ChartFrame";
import { scaleFor, tickLabel } from "./scale";
import { CHART_STRONG } from "./series";

/**
 * x/y points: one 8px jade dot each with a 2px white ring, on a scale per axis. Labels the
 * person gave are printed beside their dots; the highlighted point is ringed in ink and
 * printed with its values. Printing both values beside all 30 dots would bury them, so the
 * rest are read off the axes, and every pair is in the hidden table.
 */
export function ScatterChart({ data }: { data: ChartOf<"scatter"> }) {
  const c = data;
  const sx = scaleFor(c.points.map((p) => p.x), { pad: true });
  const sy = scaleFor(c.points.map((p) => p.y), { pad: true });
  const fx = (v: number) => fmtValue(v, c.xUnit);
  const fy = (v: number) => fmtValue(v, c.unit);
  const hi = c.highlight !== undefined && c.highlight >= 0 && c.highlight < c.points.length ? c.highlight : undefined;
  return (
    <ChartFrame
      title={c.title}
      summary={chartSummary(c)}
      table={{ head: ["Point", c.xTitle || "Across", c.yTitle || "Up"], rows: c.points.map((p, j) => [p.label?.trim() || `Point ${j + 1}`, fx(p.x), fy(p.y)]) }}
    >
      {c.yTitle && <p className="mb-1 text-xs font-semibold text-graphite">{c.yTitle}</p>}
      <div className="pt-3 pr-6 pb-6 pl-11">
        <div className="relative h-48 @lg:h-56 print:h-[42mm]">
          {sy.ticks.map((t) => (
            <div key={`y${t}`} className="absolute inset-x-0" style={{ top: `${100 - sy.at(t)}%` }}>
              <span className="absolute inset-x-0 h-px bg-line" />
              <span className="absolute right-[calc(100%+6px)] -translate-y-1/2 font-mono text-[0.68rem] whitespace-nowrap text-slate">{tickLabel(t, sy, c.unit)}</span>
            </div>
          ))}
          {sx.ticks.map((t, i) => (
            <div key={`x${t}`} className="absolute inset-y-0" style={{ left: `${sx.at(t)}%` }}>
              <span className="absolute inset-y-0 w-px bg-line" />
              <span
                className={`absolute top-[calc(100%+6px)] font-mono text-[0.68rem] whitespace-nowrap text-slate ${i === 0 ? "" : i === sx.ticks.length - 1 ? "-translate-x-full" : "-translate-x-1/2"}`}
              >
                {tickLabel(t, sx, c.xUnit)}
              </span>
            </div>
          ))}
          {c.points.map((p, j) => (
            <span key={j} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${sx.at(p.x)}%`, top: `${100 - sy.at(p.y)}%` }}>
              <span className={`block rounded-full ${j === hi ? "size-3 ring-2 ring-ink" : "size-2 ring-2 ring-surface"}`} style={{ background: CHART_STRONG }} />
              {(p.label?.trim() || j === hi) && (
                <span
                  className={`absolute top-1/2 -translate-y-1/2 text-[0.7rem] whitespace-nowrap text-ink ${j === hi ? "font-semibold" : ""} ${
                    sx.at(p.x) > 70 ? "right-[calc(100%+5px)]" : "left-[calc(100%+5px)]"
                  }`}
                >
                  {p.label?.trim()}
                  {j === hi && <span className="font-mono font-normal"> {`(${fx(p.x)}, ${fy(p.y)})`}</span>}
                </span>
              )}
            </span>
          ))}
        </div>
      </div>
      {c.xTitle && <p className="mt-1 text-center text-xs text-graphite">{c.xTitle}</p>}
    </ChartFrame>
  );
}
