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
  restrained: "today's corners and shadow",
  confident: "20px corners, the high shadow",
  maximal: "a drawn ink edge and a deep shadow",
};

/** What the level in the lab bar is changing right now, with each figure read from the page. */
export function LevelFacts() {
  const { level } = useLab();
  return (
    <table className="kit-facts">
      <caption>
        Showing <span className="capitalize">{level}</span>. <span className="font-normal text-graphite">{LEVEL_NOTE[level]}</span>
      </caption>
      <tbody>
        <tr>
          <th scope="row">A page&rsquo;s opening line</th>
          <td>
            <TokenValue name="--text-display-1-size" kind="size" />
          </td>
        </tr>
        <tr>
          <th scope="row">Home&rsquo;s opening line</th>
          <td>
            <TokenValue name="--exhbt-hero-size" kind="size" />
          </td>
        </tr>
        <tr>
          <th scope="row">Something arriving</th>
          <td>
            <TokenValue name="--duration-medium" kind="time" />, {CHARACTER[level]}
          </td>
        </tr>
        <tr>
          <th scope="row">The work&rsquo;s frame</th>
          <td>{WORK[level]}</td>
        </tr>
      </tbody>
    </table>
  );
}
