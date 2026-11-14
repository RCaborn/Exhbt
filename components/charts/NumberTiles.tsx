import { chartSummary, fmtValue, type ChartOf } from "@/lib/exhbt/charts";
import { ChartFrame } from "./ChartFrame";

/**
 * Two to four big figures, each with what it measures and, if given, where it started
 * ("from 7.9%"). For results that are one number each, where a bar would add nothing. The
 * highlighted figure sits on the wash tint.
 */
export function NumberTiles({ data }: { data: ChartOf<"numbers"> }) {
  const c = data;
  const cols = c.tiles.length >= 4 ? "@xl:grid-cols-4" : c.tiles.length === 3 ? "@lg:grid-cols-3" : "";
  return (
    <ChartFrame
      title={c.title}
      summary={chartSummary(c)}
      table={{
        head: ["Measure", "Value", "From"],
        rows: c.tiles.map((t) => [t.label, fmtValue(t.value, t.unit), t.from === undefined ? "" : fmtValue(t.from, t.unit)]),
      }}
    >
      <div className={`grid grid-cols-2 gap-2.5 ${cols}`}>
        {c.tiles.map((t, j) => (
          <div key={j} className={`rounded-[12px] border px-3 py-2.5 ${j === c.highlight ? "border-transparent bg-wash" : "border-line"}`}>
            <p className="font-[family-name:var(--font-display)] text-[1.6rem] leading-none font-semibold tracking-[-0.02em] text-ink tabular-nums">{fmtValue(t.value, t.unit)}</p>
            <p className="mt-1.5 text-[0.85rem] leading-snug text-graphite">{t.label}</p>
            {t.from !== undefined && <p className="mt-0.5 font-mono text-[0.72rem] text-ink">from {fmtValue(t.from, t.unit)}</p>}
          </div>
        ))}
      </div>
    </ChartFrame>
  );
}
