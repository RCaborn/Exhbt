"use client";

import { useEffect, useId, useState } from "react";
import { BagMarker, SkillHighlights, UpMarker } from "@/components/charts/SkillHighlights";
import { SERIES_DARK, SERIES_LIGHT } from "@/components/charts/series";
import { Button } from "@/components/ui/Button";
import { groupsFor, statesFor, youLevel, type RadarSkill, type RadarView } from "@/lib/roadmap/radar";

/**
 * Skill radar: one axis per skill (3-6), levels 0-4 from the centre out. One radar per roadmap
 * (docs/decisions/0023-skill-radar.md), two series at a time in the shared chart shades:
 *  - the job ("What the job asks for") is always the dark outline;
 *  - "You" is the light fill, and a switch sets it to where you are now or, when suggested projects
 *    exist, where they would take you. Without JS (or before it loads) it shows Now.
 *
 * Every axis is marked for the view shown: a green tick when you meet the job, an ink arrow-up when
 * you are below it. The two lists under the chart (SkillHighlights) name every skill in each group.
 *
 * No numbers are printed (Rory, 9 Nov 2026): the levels are AI estimates, and figures would suggest
 * more precision than they have. The meaning is carried in words, and a visually hidden table holds
 * every level (now, after and the job's) whichever view is showing. Nothing animates. Radars exaggerate
 * area and depend on axis order, so the order is fixed (the job's order).
 * SVG draws only the grid and the shapes; labels are HTML so they stay crisp and wrap on phones.
 */

const MAX_LEVEL = 4;
/** Radius of the plot, as a share of the box width, leaving the rest for labels. */
const PLOT = 0.235;
/** Where labels start, as a share of the box width from the centre. */
const LABEL_AT = 0.275;

type Props = {
  title: string;
  skills: RadarSkill[];
  /** Offer the "After the projects" view. Only when suggested projects exist and move a level. */
  showAfter: boolean;
  /** Where the skills and levels come from. Always shown. */
  note: string;
};

const VIEW_LABEL: Record<RadarView, string> = { now: "Now", after: "After the projects" };

export function SkillRadar({ title, skills, showAfter, note }: Props) {
  const id = useId();
  const [view, setView] = useState<RadarView>("now");
  // The switch needs JS, so it only appears once the page has hydrated.
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const shown: RadarView = showAfter ? view : "now";
  const youLabel = shown === "after" ? "You after the projects" : "You now";
  const jobLabel = "What the job asks for";
  const states = statesFor(skills, shown);
  const groups = groupsFor(skills, shown);
  const points = skills.map((s) => ({ skill: s.skill, you: youLevel(s, shown), needed: s.needed }));
  const n = skills.length;
  const angle = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / n;
  // SVG space: centre (0,0), level 4 at radius 100.
  const xy = (i: number, level: number) => {
    const r = (level / MAX_LEVEL) * 100;
    return [Math.cos(angle(i)) * r, Math.sin(angle(i)) * r] as const;
  };
  const polygon = (level: (i: number) => number) =>
    skills
      .map((_, i) =>
        xy(i, level(i))
          .map((v) => v.toFixed(2))
          .join(","),
      )
      .join(" ");

  return (
    <div>
      {showAfter && (
        <div className="min-h-9" data-hydrated={ready}>
          {ready && (
            <div role="group" aria-labelledby={`${id}-you`} className="flex flex-wrap items-center gap-2">
              <span id={`${id}-you`} className="text-sm font-semibold text-ink">
                Show you
              </span>
              {(["now", "after"] as const).map((v) => (
                <Button key={v} size="sm" variant={shown === v ? "ink" : "secondary"} aria-pressed={shown === v} onClick={() => setView(v)}>
                  {VIEW_LABEL[v]}
                </Button>
              ))}
            </div>
          )}
        </div>
      )}
      <figure className="m-0 mt-4">
        <figcaption className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <span className="text-sm font-semibold text-ink">{title}</span>
          <span className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-graphite" aria-hidden>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block size-2.5 rounded-[2px]" style={{ background: SERIES_LIGHT }} />
              {youLabel}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block size-2.5 rounded-[2px] border-2" style={{ borderColor: SERIES_DARK }} />
              {jobLabel}
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
            {skills.map((_, i) => {
              const [x, y] = xy(i, MAX_LEVEL);
              return (
                <line key={i} x1={0} y1={0} x2={x} y2={y} stroke="var(--color-line)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
              );
            })}

            {/* From: filled, light. To: outline, dark, drawn on top. */}
            <polygon
              data-series="you"
              data-view={shown}
              points={polygon((i) => points[i].you)}
              fill={SERIES_LIGHT}
              fillOpacity={0.45}
              stroke={SERIES_LIGHT}
              strokeWidth={2}
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
            <polygon
              data-series="job"
              points={polygon((i) => points[i].needed)}
              fill="none"
              stroke={SERIES_DARK}
              strokeWidth={2.5}
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
            {points.map((p, i) => {
              const [fx, fy] = xy(i, p.you);
              const [tx, ty] = xy(i, p.needed);
              return (
                <g key={p.skill}>
                  <circle
                    cx={fx}
                    cy={fy}
                    r={4}
                    fill={SERIES_LIGHT}
                    stroke="var(--color-surface)"
                    strokeWidth={1.5}
                    vectorEffect="non-scaling-stroke"
                  />
                  <circle
                    cx={tx}
                    cy={ty}
                    r={4}
                    fill={SERIES_DARK}
                    stroke="var(--color-surface)"
                    strokeWidth={1.5}
                    vectorEffect="non-scaling-stroke"
                  />
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
            const state = states[i];
            return (
              <div
                key={p.skill}
                data-axis={p.skill}
                data-state={state}
                className={`absolute flex flex-col gap-1 leading-tight [overflow-wrap:anywhere] hyphens-auto ${
                  side === "right" ? "items-start text-left" : side === "left" ? "items-end text-right" : "items-center text-center"
                }`}
                style={style}
              >
                {state === "below" ? <UpMarker /> : <BagMarker />}
                <span className="block text-[0.72rem] font-semibold text-ink sm:text-[0.85rem]">{p.skill}</span>
              </div>
            );
          })}
        </div>

        <p className="mt-2 text-xs text-graphite">
          {shown === "after" ? "If you do the suggested projects. " : ""}
          {note}
        </p>

        {/* A table ignores the 1px width of sr-only and keeps its full width, which would widen
          the page on phones. The wrapper div is what clips it. */}
        <div className="sr-only">
          <table>
            <caption>{title}</caption>
            <thead>
              <tr>
                <th scope="col">Skill</th>
                <th scope="col">Now</th>
                {showAfter && <th scope="col">After the projects</th>}
                <th scope="col">{jobLabel}</th>
              </tr>
            </thead>
            <tbody>
              {skills.map((s) => (
                <tr key={s.skill}>
                  <th scope="row">{s.skill}</th>
                  <td>
                    {s.now} of {MAX_LEVEL}
                  </td>
                  {showAfter && (
                    <td>
                      {s.after} of {MAX_LEVEL}
                    </td>
                  )}
                  <td>
                    {s.needed} of {MAX_LEVEL}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </figure>
      <p role="status" className="sr-only">
        {`Showing ${youLabel.toLowerCase()}: ${groups.up.length} below what the job asks for, ${groups.bag.length} meeting it.`}
      </p>
      <SkillHighlights up={groups.up} bag={groups.bag} />
    </div>
  );
}
