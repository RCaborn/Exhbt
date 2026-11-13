import type { KeyResult } from "@/lib/exhbt";
import { SERIES_DARK, SERIES_LIGHT } from "@/components/charts/series";

/**
 * Before/after dumbbell: one row per measure, a light dot (before) joined to a dark dot
 * (after). One hue, two shades (components/charts/series.ts). The light shade sits below
 * 3:1 on white, so every value is printed beside its dot, and a visually hidden table
 * carries the same data.
 * Built in HTML rather than SVG so text stays crisp and the layout reflows on phones.
 */

const BEFORE = SERIES_LIGHT;
const AFTER = SERIES_DARK;

export function BeforeAfterChart({ data }: { data: KeyResult }) {
  const unit = data.unit ?? "";
  const values = data.rows.flatMap((r) => [r.before, r.after]);
  const lo0 = Math.min(...values);
  const hi0 = Math.max(...values);
  // Dots encode position, not length, so the scale needn't start at zero. Pad around the
  // data so outward labels have room on both sides.
  const pad = Math.max((hi0 - lo0) * 0.7, hi0 * 0.15, 1);
  const dMin = Math.max(0, lo0 - pad);
  const dMax = hi0 + pad;
  const x = (v: number) => `${((v - dMin) / (dMax - dMin)) * 100}%`;
  const fmt = (v: number) => `${Number.isInteger(v) ? v : v.toFixed(1)}${unit}`;

  return (
    <figure className="m-0">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className="text-sm font-semibold text-ink">{data.title}</span>
        <span className="flex gap-4 text-xs text-graphite" aria-hidden>
          <Legend color={BEFORE} label={data.beforeLabel} />
          <Legend color={AFTER} label={data.afterLabel} />
        </span>
      </figcaption>

      <div className="@container mt-3 space-y-3" aria-hidden>
        {data.rows.map((r) => {
          const lo = Math.min(r.before, r.after);
          const hi = Math.max(r.before, r.after);
          const change = r.after - r.before;
          const improved = data.lowerIsBetter ? change < 0 : change > 0;
          const pct = r.before === 0 ? 0 : Math.round((Math.abs(change) / r.before) * 100);
          return (
            <div key={r.label} className="grid grid-cols-[1fr_3.5rem] items-center gap-x-3 gap-y-0.5 @md:grid-cols-[6.5rem_1fr_4rem]">
              <span className="col-span-2 text-[0.85rem] text-graphite @md:col-span-1">{r.label}</span>
              <div className="relative h-7">
                {/* Baseline: recessive. */}
                <span className="absolute top-1/2 right-0 left-0 h-px bg-line" />
                {/* Connector between the two values. */}
                <span className="absolute top-1/2 h-[2px] -translate-y-1/2 rounded-full bg-[#a5e6d0]" style={{ left: x(lo), width: `calc(${x(hi)} - ${x(lo)})` }} />
                {/* Labels sit outside the pair (lower value left, higher right), so they never collide. */}
                <Dot left={x(r.before)} side={r.before <= r.after ? "left" : "right"} color={BEFORE} title={`${data.beforeLabel}: ${fmt(r.before)}`} label={fmt(r.before)} />
                <Dot left={x(r.after)} side={r.after < r.before ? "left" : "right"} color={AFTER} title={`${data.afterLabel}: ${fmt(r.after)}`} label={fmt(r.after)} />
              </div>
              <span className={`text-right text-[0.8rem] font-semibold ${improved ? "text-ink" : "text-graphite"}`}>
                {change < 0 ? "−" : "+"}
                {pct}%
              </span>
            </div>
          );
        })}
      </div>

      {/* The wrapper clips the table: a table ignores sr-only's 1px width and would widen the page. */}
      <div className="sr-only">
        <table>
          <caption>{data.title}</caption>
          <thead>
            <tr>
              <th scope="col">Group</th>
              <th scope="col">{data.beforeLabel}</th>
              <th scope="col">{data.afterLabel}</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((r) => (
              <tr key={r.label}>
                <th scope="row">{r.label}</th>
                <td>{fmt(r.before)}</td>
                <td>{fmt(r.after)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}

function Dot({
  left,
  side,
  color,
  title,
  label,
}: {
  left: string;
  side: "left" | "right";
  color: string;
  title: string;
  label: string;
}) {
  return (
    <span className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ left }} title={title}>
      {/* Value label beside the dot, outside the pair, in text ink (never the series colour). */}
      <span
        className={`absolute top-1/2 -translate-y-1/2 font-mono text-[0.72rem] whitespace-nowrap text-ink ${
          side === "left" ? "right-[calc(100%+6px)]" : "left-[calc(100%+6px)]"
        }`}
      >
        {label}
      </span>
      {/* 12px marker with a 2px surface ring so overlapping dots stay distinct. */}
      <span className="block size-3 rounded-full ring-2 ring-surface" style={{ background: color }} />
    </span>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-block size-2.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}
