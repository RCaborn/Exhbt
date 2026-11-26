"use client";

import { LEVEL_NOTE, type Level } from "../lab";
import { useLab } from "../LabFrame";
import { TokenValue } from "./TokenValue";

const CHARACTER: Record<Level, string> = {
  restrained: "crisp, no overshoot",
  confident: "a little overshoot",
  maximal: "more overshoot",
};
const WORK: Record<Level, string> = {
  restrained: "Today's corners and shadow",
  confident: "20px corners, a deeper shadow",
  maximal: "A drawn ink edge, the deepest shadow",
};

/** What the level in the lab bar is changing right now, with each figure read from the page. */
export function LevelFacts() {
  const { level } = useLab();
  return (
    <div className="kit-level">
      <p className="kit-level-now">
        <b>
          Showing <span className="capitalize">{level}</span>.
        </b>{" "}
        {LEVEL_NOTE[level]} The switch is in the lab bar.
      </p>
      <dl className="kit-level-facts">
        <div>
          <dt>A page&rsquo;s opening line</dt>
          <dd>
            <TokenValue name="--text-display-1-size" kind="size" />
          </dd>
        </div>
        <div>
          <dt>Home&rsquo;s opening line</dt>
          <dd>
            <TokenValue name="--exhbt-hero-size" kind="size" />
          </dd>
        </div>
        <div>
          <dt>Something arriving</dt>
          <dd>
            <TokenValue name="--duration-medium" kind="time" />, {CHARACTER[level]}
          </dd>
        </div>
        <div>
          <dt>The work&rsquo;s frame</dt>
          <dd>{WORK[level]}</dd>
        </div>
      </dl>
    </div>
  );
}
