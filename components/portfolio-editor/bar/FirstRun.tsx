"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePortfolioApi, usePortfolioData, usePortfolioState, usePortfolioUi } from "../runtime";
import { useBarSize, useNarrow } from "./hooks";
import { STRIP, StripView, allDone, factsOf, stepShown } from "./strip";

export { STRIP };

/*
 * The first minute (decision 0031, "A new student" and "Data": first run). Under the bar, in app chrome,
 * a strip that tells a stranger what this page is, what to do now and what comes next, in three steps:
 *   1. Account, done: signing up was the first step, so the strip starts one in (decision 0033, G5);
 *   2. Your page, about a minute: the name, a one-line headline, a photo (optional) and a look, each one
 *      going to its field or opening its menu, and ticked when done;
 *   3. Your first exhbt: it goes to the band ("Your best project goes here") or the Add tile.
 * "Skip to your first exhbt" is there from the start; "Hide this" is kept in the browser for this person
 * (localStorage, in try and catch: losing it only brings the strip back). It shows until both are done,
 * worked out from the data. On a narrow window it is one line, "Step 2 of 3", with Next.
 *
 * The steps, their words and what ticks them are data (STRIP, in strip.tsx), and the strip is drawn there
 * with no hooks, so the loading view draws the same strip and nothing moves when the editor arrives.
 */

const hiddenKey = (owner: string) => `exhbt:portfolio-first-run-hidden:${owner}`;

function readHidden(owner: string): boolean {
  try {
    return window.localStorage.getItem(hiddenKey(owner)) === "1";
  } catch {
    return false;
  }
}

function writeHidden(owner: string): void {
  try {
    window.localStorage.setItem(hiddenKey(owner), "1");
  } catch {
    // Kept for this visit only.
  }
}

export function FirstRun(): ReactNode {
  const api = usePortfolioApi();
  const data = usePortfolioData();
  const narrow = useNarrow();
  const size = useBarSize();
  const visitor = usePortfolioUi((u) => u.visitor);
  const name = usePortfolioState((s) => s.profile.name);
  const headline = usePortfolioState((s) => s.profile.headline);
  const themeId = usePortfolioState((s) => s.arrangement.themeId);
  const [firstLook] = useState(themeId);
  // Opening the Look menu counts as choosing: on Free there is one look, and keeping it is a choice too.
  const lookOpen = usePortfolioUi((u) => u.sheet === "look");
  const [lookSeen, setLookSeen] = useState(false);
  useEffect(() => {
    if (lookOpen) setLookSeen(true);
  }, [lookOpen]);
  const [hidden, setHidden] = useState(false);
  const [skipped, setSkipped] = useState(false);
  const [viewing, setViewing] = useState<number | null>(null);

  // Read after the first paint: the server has no browser storage.
  useEffect(() => setHidden(readHidden(data.owner)), [data.owner]);

  const facts = factsOf(data, { name, headline, themeId }, lookSeen || themeId !== firstLook);
  if (hidden || allDone(facts) || visitor) return null;

  const current = viewing ?? stepShown(facts, skipped);
  const on = {
    api,
    hide: () => {
      writeHidden(data.owner);
      setHidden(true);
      api.say("The steps are hidden. Everything they pointed to is on your page and in the bar.");
    },
    skip: () => {
      setSkipped(true);
      setViewing(STRIP.steps.length - 1);
    },
    view: (i: number) => setViewing(i),
  };
  return <StripView facts={facts} current={current} narrow={narrow} size={size} on={on} />;
}
