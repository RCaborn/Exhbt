import { SERIES_DARK, SERIES_LIGHT } from "@/components/charts/series";
import type { SkillPoint } from "@/lib/roadmap/skills";

/**
 * Skill radar: one axis per skill (3-6), levels 0-4 from the centre out. Two series in the
 * shared chart shades: the light one filled ("from", usually where they are now), the dark
 * one as an outline ("to": what the job asks for, or where the projects would take them).
 *
 * Radars exaggerate: area grows faster than the values and the shape depends on axis order.
 * So the axis order is fixed (the job's order, most important first), every value is printed
 * beside its axis, and a visually hidden table carries the same data.
 * SVG draws only the grid and the shapes; labels are HTML so they stay crisp and wrap on phones.
 */

const MAX_LEVEL = 4;
/** Radius of the plot, as a share of the box width, leaving the rest for labels. */
const PLOT = 0.235;
/** Where labels start, as a share of the box width from the centre. */
const LABEL_AT = 0.275;

type Props = {
  title: string;
  fromLabel: string;
  toLabel: string;
  points: SkillPoint[];
  /** Where the skills and levels come from. Always shown. */
  note: string;
  /**
   * Short words for printing both values on their own lines, e.g. ["you", "job"]. Use this when
   * "to" can be lower than "from" (a target), where an arrow would read as going backwards.
   * Without it, values print as a change: "1 → 3", or one number when nothing changes.
   */
  valueWords?: [string, string];
};

export function SkillRadar({ title, fromLabel, toLabel, points, note, valueWords }: Props) {
  const n = points.length;
  const angle = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / n;
  // SVG space: centre (0,0), level 4 at radius 100.
  const xy = (i: number, level: number) => {
    const r = (level / MAX_LEVEL) * 100;
    return [Math.cos(angle(i)) * r, Math.sin(angle(i)) * r] as const;
  };
  const polygon = (level: (i: number) => number) =>
    points.map((_, i) => xy(i, level(i)).map((v) => v.toFixed(2)).join(",")).join(" ");

  return (
    <figure className="m-0">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className="text-sm font-semibold text-ink">{title}</span>
        <span className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2" aria-hidden>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block size-2.5 rounded-[2px]" style={{ background: SERIES_LIGHT }} />
            {fromLabel}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block size-2.5 rounded-[2px] border-2" style={{ borderColor: SERIES_DARK }} />
            {toLabel}
          </span>
        </span>
      </figcaption>

      <div className="relative mx-auto mt-4 aspect-square w-full max-w-[30rem]" aria-hidden>
        <svg
          viewBox="-100 -100 200 200"
          className="absolute overflow-visible"
          style={{ left: `${(0.5 - PLOT) * 100}%`, top: `${(0.5 - PLOT) * 100}%`, width: `${PLOT * 200}%`, height: `${PLOT * 200}%` }}
        >
          {/* Grid: a ring per level and a spoke per skill, recessive. */}
          {[1, 2, 3, 4].map((level) => (
            <polygon
              key={level}
              points={polygon(() => level)}
              fill="none"
              stroke="var(--color-rule)"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {points.map((_, i) => {
            const [x, y] = xy(i, MAX_LEVEL);
            return <line key={i} x1={0} y1={0} x2={x} y2={y} stroke="var(--color-rule)" strokeWidth={1} vectorEffect="non-scaling-stroke" />;
          })}

          {/* From: filled, light. To: outline, dark, drawn on top. */}
          <polygon
            points={polygon((i) => points[i].from)}
            fill={SERIES_LIGHT}
            fillOpacity={0.35}
            stroke={SERIES_LIGHT}
            strokeWidth={2}
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
          <polygon
            points={polygon((i) => points[i].to)}
            fill="none"
            stroke={SERIES_DARK}
            strokeWidth={2.5}
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
          {points.map((p, i) => {
            const [fx, fy] = xy(i, p.from);
            const [tx, ty] = xy(i, p.to);
            return (
              <g key={p.skill}>
                <circle cx={fx} cy={fy} r={4} fill={SERIES_LIGHT} stroke="var(--color-surface)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
                <circle cx={tx} cy={ty} r={4} fill={SERIES_DARK} stroke="var(--color-surface)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
              </g>
            );
          })}
        </svg>

        {points.map((p, i) => {
          const cos = Math.cos(angle(i));
          const sin = Math.sin(angle(i));
          // Each label is sized from where it starts, so it always ends inside the box.
          const at = (v: number) => 50 + v * LABEL_AT * 100;
          const side = cos > 0.25 ? "right" : cos < -0.25 ? "left" : "centre";
          const style: React.CSSProperties =
            side === "right"
              ? { left: `${at(cos)}%`, width: `${99 - at(cos)}%`, top: `${at(sin)}%`, transform: "translateY(-50%)" }
              : side === "left"
                ? { right: `${100 - at(cos)}%`, width: `${at(cos) - 1}%`, top: `${at(sin)}%`, transform: "translateY(-50%)" }
                : sin < 0
                  ? { left: "27%", width: "46%", bottom: `${100 - at(sin)}%` }
                  : { left: "27%", width: "46%", top: `${at(sin)}%` };
          return (
            <div
              key={p.skill}
              className={`absolute leading-tight [overflow-wrap:anywhere] hyphens-auto ${
                side === "right" ? "text-left" : side === "left" ? "text-right" : "text-center"
              }`}
              style={style}
              title={`${p.skill}: ${fromLabel.toLowerCase()} ${p.from}, ${toLabel.toLowerCase()} ${p.to}, out of ${MAX_LEVEL}`}
            >
              <span className="block text-[0.72rem] font-medium text-ink-2 sm:text-[0.85rem]">{p.skill}</span>
              {/* Values in text ink, never the series colour. */}
              {valueWords ? (
                <span className="mt-0.5 block font-mono text-[0.7rem] text-ink sm:text-[0.72rem]">
                  <span className="block">{valueWords[0]} {p.from}</span>
                  <span className="block">{valueWords[1]} {p.to}</span>
                </span>
              ) : (
                <span className="mt-0.5 block font-mono text-[0.7rem] text-ink sm:text-[0.72rem]">
                  {p.from === p.to ? p.from : `${p.from} → ${p.to}`}
                </span>
              )}
            </div>
          );
        })}
      </div>

      <p className="mt-2 text-xs text-ink-2">
        Levels run from 0 (not shown) to {MAX_LEVEL} (used repeatedly, with results). {note}
      </p>

      {/* A table ignores the 1px width of sr-only and keeps its full width, which would widen
          the page on phones. The wrapper div is what clips it. */}
      <div className="sr-only">
        <table>
          <caption>{title}</caption>
          <thead>
            <tr>
              <th scope="col">Skill</th>
              <th scope="col">{fromLabel}</th>
              <th scope="col">{toLabel}</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p) => (
              <tr key={p.skill}>
                <th scope="row">{p.skill}</th>
                <td>{p.from} of {MAX_LEVEL}</td>
                <td>{p.to} of {MAX_LEVEL}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}
