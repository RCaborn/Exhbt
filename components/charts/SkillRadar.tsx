import { BagMarker, UpMarker } from "@/components/charts/SkillHighlights";
import { SERIES_DARK, SERIES_LIGHT } from "@/components/charts/series";
import { namedIn, type SkillPoint } from "@/lib/roadmap/skills";

/**
 * Skill radar: one axis per skill (3-6), levels 0-4 from the centre out. Two series in the
 * shared chart shades: the light one filled ("from", usually where they are now), the dark
 * one as an outline ("to": what the job asks for, or where the projects would take them).
 *
 * No numbers are printed (Rory, 9 Nov 2026): the levels are AI estimates, and figures would
 * suggest more precision than they have. The meaning is carried in words instead: the
 * "Level up next" and "In the bag" skills are marked on their labels and listed under the chart
 * (SkillHighlights), and a visually hidden table holds every level for screen readers.
 * Radars exaggerate area and depend on axis order, so the order is fixed (the job's order).
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
  /** Skills to mark on their labels: "Level up next" (up) and "In the bag" (bag). */
  highlight?: { up: string[]; bag: string[] };
};

export function SkillRadar({ title, fromLabel, toLabel, points, note, highlight }: Props) {
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
        <span className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-graphite" aria-hidden>
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
              stroke="var(--color-line)"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {points.map((_, i) => {
            const [x, y] = xy(i, MAX_LEVEL);
            return <line key={i} x1={0} y1={0} x2={x} y2={y} stroke="var(--color-line)" strokeWidth={1} vectorEffect="non-scaling-stroke" />;
          })}

          {/* From: filled, light. To: outline, dark, drawn on top. */}
          <polygon
            points={polygon((i) => points[i].from)}
            fill={SERIES_LIGHT}
            fillOpacity={0.45}
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
          const up = highlight ? namedIn(p.skill, highlight.up) : false;
          const bag = !up && highlight ? namedIn(p.skill, highlight.bag) : false;
          return (
            <div
              key={p.skill}
              className={`absolute flex flex-col gap-1 leading-tight [overflow-wrap:anywhere] hyphens-auto ${
                side === "right" ? "items-start text-left" : side === "left" ? "items-end text-right" : "items-center text-center"
              }`}
              style={style}
            >
              {up && <UpMarker />}
              {bag && <BagMarker />}
              <span
                className={`block text-[0.72rem] sm:text-[0.85rem] ${up || bag ? "font-semibold text-ink" : "font-medium text-graphite"}`}
              >
                {p.skill}
              </span>
            </div>
          );
        })}
      </div>

      <p className="mt-2 text-xs text-graphite">{note}</p>

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
