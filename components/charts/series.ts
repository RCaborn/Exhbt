/**
 * The only chart colours: the brand's one hue, jade to mint (docs/brand.md).
 *
 * SERIES_LIGHT / SERIES_DARK are the before/after pair (BeforeAfterChart, SkillRadar): mint and
 * jade. They differ strongly in lightness (3.7:1 against each other), so they stay apart for
 * colour-blind readers. Mint is faint on white (1.5:1), so charts never rely on it alone: values
 * are printed or listed in text ink, and a hidden table carries the data. Checked by contrast
 * maths on 9 Nov 2026.
 *
 * SERIES_RAMP is for every other graph (decision 0011): four steps of the same hue, darkest
 * first, for up to four series. The highlighted series takes the first (jade); the others take
 * the next steps in order. Validated on 14 Nov 2026 with the dataviz palette validator as an
 * ordinal ramp on white (one hue, lightness falling in steps of at least 0.06, the lightest step
 * 2.03:1 on white): `validate_palette.js "#3dcc9f,#2aaf89,#179274,#00755d" --ordinal --surface
 * "#ffffff"` passes every check. One hue can't pass the categorical checks, so series are never
 * told apart by colour alone: each also has a legend entry, its values printed, and on line
 * graphs its own marker shape and dash. Charts sit on white (surface), not mist.
 *
 * On a portfolio, the person's look sets the two shades and the ramp (`--chart-*`, from
 * lib/portfolio-themes.ts, decision 0018), so a dark look's graphs are drawn light on its own dark
 * card. The graphs read the CHART_* values below, which fall back to these brand colours anywhere
 * else (the editor, the demo). The radar and the admin panel keep the brand's hex values.
 */
export const SERIES_LIGHT = "#4fe9b4";
export const SERIES_DARK = "#00755d";

export const SERIES_RAMP = ["#00755d", "#179274", "#2aaf89", "#3dcc9f"] as const;

/** The strong shade (the highlighted series, "after"), the look's or the brand's. */
export const CHART_STRONG = `var(--chart-strong, ${SERIES_DARK})`;
/** The soft shade ("before"). */
export const CHART_SOFT = `var(--chart-soft, ${SERIES_LIGHT})`;
/** The ramp, strongest first. */
export const CHART_RAMP = SERIES_RAMP.map((c, i) => `var(--chart-${i + 1}, ${c})`) as readonly string[];

/** Place of series `k` of `n` in the drawing order: 0 for the highlighted one (default the first), then the rest in order. */
export function seriesRank(k: number, n: number, highlight = 0): number {
  const h = highlight >= 0 && highlight < n ? highlight : 0;
  return Math.min([h, ...Array.from({ length: n }, (_, i) => i).filter((i) => i !== h)].indexOf(k), SERIES_RAMP.length - 1);
}

/** Colour for series `k` of `n`: the highlighted one the strong shade, the others the next steps. */
export const seriesColour = (k: number, n: number, highlight = 0): string => CHART_RAMP[seriesRank(k, n, highlight)]!;

/** Bars that aren't the highlighted one, when one is: the lightest step, so the highlight reads first. */
export const MUTED_BAR = CHART_RAMP[3]!;

/** Line dashes by rank (the highlighted line is solid). */
export const DASHES = ["", "6 4", "2 3", "8 3 2 3"] as const;

/** Marker shapes by rank. */
export const MARKERS = ["circle", "square", "triangle", "diamond"] as const;
export type Marker = (typeof MARKERS)[number];
