/**
 * One scale per axis: clean ticks (steps of 1, 2, 2.5 or 5 times a power of ten) that cover the
 * data, and the position of a value along them as a percentage. Every mark and every tick on an
 * axis comes from the same scale.
 */

const tidy = (v: number) => Number(v.toPrecision(12));

export function niceTicks(lo: number, hi: number, count = 4): number[] {
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return [0, 1];
  if (lo === hi) {
    if (lo === 0) return [0, 1];
    const pad = Math.abs(lo) * 0.25;
    lo = lo > 0 ? Math.max(0, lo - pad) : lo - pad;
    hi = hi < 0 ? Math.min(0, hi + pad) : hi + pad;
  }
  const span = hi - lo;
  const mag = 10 ** Math.floor(Math.log10(span / count));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => span / s <= count) ?? 10 * mag;
  const start = Math.floor(tidy(lo / step)) * step;
  const end = Math.ceil(tidy(hi / step)) * step;
  const out: number[] = [];
  for (let i = 0; start + i * step <= end + step / 1e6; i++) out.push(tidy(start + i * step));
  return out;
}

export type Scale = { ticks: number[]; lo: number; hi: number; at: (v: number) => number };

/**
 * A scale over the values. `zero` makes it start (or end) at 0, as bars must. `pad` leaves a
 * little room past the smallest and largest values, so points never sit on the plot's edge
 * (never below 0 for data that has none).
 */
export function scaleFor(values: number[], { zero = false, pad = false, count = 4 } = {}): Scale {
  const finite = values.filter(Number.isFinite);
  let lo = finite.length ? Math.min(...finite) : 0;
  let hi = finite.length ? Math.max(...finite) : 1;
  if (zero) {
    lo = Math.min(0, lo);
    hi = Math.max(0, hi);
  }
  if (pad && hi > lo) {
    const room = (hi - lo) * 0.06;
    lo = lo >= 0 ? Math.max(0, lo - room) : lo - room;
    hi = hi + room;
  }
  const ticks = niceTicks(lo, hi, count);
  const a = ticks[0]!;
  const b = ticks[ticks.length - 1]!;
  return { ticks, lo: a, hi: b, at: (v: number) => (b === a ? 0 : ((v - a) / (b - a)) * 100) };
}

const compact = new Intl.NumberFormat("en-GB", { notation: "compact", maximumFractionDigits: 1 });
const full = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 2 });

/** A tick label: in full under 100,000 (12,500), compact above (250K), with % when the values are percentages. */
export function tickLabel(v: number, scale: Scale, unit?: string): string {
  const big = Math.max(Math.abs(scale.lo), Math.abs(scale.hi)) >= 100_000;
  const s = (big ? compact : full).format(Math.abs(v));
  return `${v < 0 ? "−" : ""}${s}${unit?.trim() === "%" ? "%" : ""}`;
}
