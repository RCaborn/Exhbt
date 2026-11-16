"use client";

import { useState } from "react";
import { PortfolioHome } from "@/components/portfolio/PortfolioHome";
import type { PortfolioPerson } from "@/components/portfolio/PortfolioPage";
import { themeStyle } from "@/components/portfolio/themeFonts";
import { portfolioHost } from "@/lib/hosts";
import type { HomeProject } from "@/lib/portfolio-home";
import type { SectionKey, Tiles } from "@/lib/portfolio-layout";
import { DEFAULT_THEME, PORTFOLIO_THEMES } from "@/lib/portfolio-themes";
import { Preview } from "./Preview";

/** How many looks to offer: the first ones in the list, which is in plan order (decision 0012). */
const LOOKS_SHOWN = 8;

/**
 * The home page's portfolio, with the looks to try on it: the real `PortfolioHome` with Amara's
 * fictional page, in a browser frame at her address, and a radio group of looks under it that
 * restyles the page (the same `themeStyle` variables a live portfolio uses). The looks are read from
 * `PORTFOLIO_THEMES` by position and drawn from `themeStyle`, so a change to the list or its shape
 * doesn't need this file to change.
 */
export function LookPreview({
  person,
  projects,
  tiles,
  sections,
}: {
  person: PortfolioPerson;
  projects: HomeProject[];
  tiles: Tiles;
  sections: SectionKey[];
}) {
  const looks = PORTFOLIO_THEMES.slice(0, LOOKS_SHOWN);
  const [id, setId] = useState(DEFAULT_THEME.id);
  const theme = looks.find((t) => t.id === id) ?? DEFAULT_THEME;
  return (
    <div>
      <Preview
        url={portfolioHost(person.username ?? "name")}
        label={`${person.name}'s portfolio home page, in the ${theme.name} look: her photo, name and intro, then her best piece of work.`}
        crop="h-[34rem] sm:h-[38rem] lg:h-[44rem]"
        className="lg:[zoom:0.7]"
      >
        <PortfolioHome person={person} theme={theme} projects={projects} featuredId={null} sections={sections} tiles={tiles} />
      </Preview>
      <fieldset className="mt-6">
        <legend className="text-[0.95rem] font-semibold text-white">Try a look</legend>
        <div className="mt-3 flex flex-wrap gap-2">
          {looks.map((t) => {
            const v = themeStyle(t) as Record<string, string>;
            return (
              <label key={t.id} className="cursor-pointer">
                <input type="radio" name="home-look" value={t.id} checked={t.id === id} onChange={() => setId(t.id)} className="peer sr-only" />
                <span className="inline-flex min-h-11 items-center gap-2.5 rounded-full border border-graphite py-1.5 pr-4 pl-1.5 text-[0.9rem] font-medium text-white peer-checked:border-mint peer-checked:bg-white peer-checked:text-ink peer-focus-visible:outline-[3px] peer-focus-visible:outline-offset-2 peer-focus-visible:outline-mint peer-focus-visible:outline-solid hover:border-white">
                  <span
                    aria-hidden
                    className="inline-flex size-8 items-center justify-center rounded-full border border-white/25 text-[0.7rem] font-semibold"
                    style={{ background: v["--band-bg"], color: v["--band-text"], fontFamily: v["--font-display"] }}
                  >
                    Aa
                  </span>
                  {t.name}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>
    </div>
  );
}
