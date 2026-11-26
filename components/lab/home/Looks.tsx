"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { AspectRatio } from "@astryxdesign/core/AspectRatio";
import { Heading } from "@astryxdesign/core/Heading";
import { RadioList, RadioListItem } from "@astryxdesign/core/RadioList";
import { Text } from "@astryxdesign/core/Text";
import { PortfolioHome } from "@/components/portfolio/PortfolioHome";
import { headingFamily } from "@/components/portfolio/themeFonts";
import { demoHomeProjects, demoPortfolio } from "@/lib/exhbt";
import { ENTITLEMENTS, PLAN_NAMES } from "@/lib/entitlements";
import { portfolioHost } from "@/lib/hosts";
import { DEFAULT_THEME, PORTFOLIO_THEMES } from "@/lib/portfolio-themes";
import { Frame } from "../Frame";
import { useLab } from "../LabFrame";
import { inWords } from "./address";
import { useHomeName } from "./HomeName";

const LOOKS = PORTFOLIO_THEMES;

/** Which plan has which looks, read from lib/entitlements.ts. */
function plansLine(): string {
  const count = (n: number | "all") => (n === "all" ? LOOKS.length : n);
  const premium = count(ENTITLEMENTS.premium.portfolioThemes);
  return `${PLAN_NAMES.free} has the ${DEFAULT_THEME.name} look, ${PLAN_NAMES.premium} has ${inWords(premium)} and ${PLAN_NAMES.max} has all ${inWords(LOOKS.length)}.`;
}

type WithTransitions = Document & {
  startViewTransition?: (arg: (() => void) | { update: () => void; types?: string[] }) => unknown;
};

/**
 * "One page, eight looks" (decision 0033's sixth thing, after the name in the hero). The same
 * portfolio page, with the name typed in the hero, changes look as the page scrolls, while its
 * words stay put: that is the point. Each look's name is set large in its own typeface, and the
 * names are the control: an Astryx RadioList, so a look can be picked by hand at any level.
 *
 * At confident and maximal, with motion allowed, the frame and the names stay put (sticky, in
 * home.css) while the page scrolls past one marker per look, and one IntersectionObserver turns the
 * marker crossing the middle of the screen into the look shown, cross-faded with a view transition
 * that names only the page in the frame. A look picked by hand wins: from then on the scroll leaves
 * it alone, until the scene has left the screen. Nothing advances by itself; it is not a carousel.
 *
 * At restrained, with Motion off or reduced motion: nothing is pinned, nothing follows the scroll
 * and nothing cross-fades. The radios are the control.
 *
 * The page keeps the live home page's props (her page, `sections={["featured"]}`), and the radios
 * are named `home-look`, so a promoted page can still be pictured look by look (e2e parity spec).
 */
export function Looks() {
  const { level, moves } = useLab();
  const me = useHomeName();
  const [id, setId] = useState(DEFAULT_THEME.id);
  const shown = useRef(id);
  const held = useRef(false);
  const track = useRef<HTMLDivElement>(null);
  const scrollLed = moves && level !== "restrained";
  const look = LOOKS.find((t) => t.id === id) ?? DEFAULT_THEME;

  const show = useCallback(
    (next: string, animate: boolean) => {
      if (next === shown.current) return;
      shown.current = next;
      const doc = document as WithTransitions;
      if (!animate || !doc.startViewTransition || !track.current) {
        setId(next);
        return;
      }
      // The cross-fade takes the theme's "something arriving" tempo, read off the lab (it follows the level).
      const ms = getComputedStyle(track.current).getPropertyValue("--duration-medium").trim();
      document.documentElement.style.setProperty("--hl-look-fade", ms || "320ms");
      const update = () => flushSync(() => setId(next));
      try {
        doc.startViewTransition({ update, types: ["hl-look"] });
      } catch {
        setId(next);
      }
    },
    [],
  );

  // One observer: the marker crossing the middle of the screen is the look shown. Off unless the
  // scene is scroll-led (confident or maximal, motion allowed). Leaving the scene lets go of a hand pick.
  useEffect(() => {
    held.current = false;
    const root = track.current;
    if (!scrollLed || !root) return;
    const markers = Array.from(root.querySelectorAll<HTMLElement>("[data-look-step]"));
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const step = (e.target as HTMLElement).dataset.lookStep;
          if (step === undefined) {
            if (!e.isIntersecting) held.current = false;
          } else if (e.isIntersecting && !held.current) {
            show(step, true);
          }
        }
      },
      { rootMargin: "-50% 0px -50% 0px" },
    );
    markers.forEach((m) => io.observe(m));
    io.observe(root);
    return () => io.disconnect();
  }, [scrollLed, show]);

  const host = portfolioHost(me.username);
  return (
    <section id="looks" aria-labelledby="hl-looks-title" className="hl-section hl-looks">
      <div ref={track} className="hl-looks-track" style={{ "--hl-steps": LOOKS.length } as React.CSSProperties}>
        <div className="hl-looks-stage">
          <div className="lab-content hl-looks-grid">
            <div className="hl-looks-words">
              <Heading level={2} type="display-2" id="hl-looks-title">
                One page, {inWords(LOOKS.length)} looks.
              </Heading>
              <Text as="p" display="block" type="large" color="secondary">
                Your words stay as they are. Only the look changes.
              </Text>
              <div className="hl-looks-list">
                <RadioList
                  label="Try a look"
                  value={id}
                  htmlName="home-look"
                  onChange={(v) => {
                    held.current = true;
                    show(v, moves);
                  }}
                >
                  {LOOKS.map((t) => (
                    <RadioListItem
                      key={t.id}
                      value={t.id}
                      label={
                        <span className="hl-look-name" style={{ fontFamily: headingFamily(t), fontWeight: t.type.displayWeight }}>
                          {t.name}
                        </span>
                      }
                    />
                  ))}
                </RadioList>
              </div>
              <Text as="p" display="block" type="supporting">
                {plansLine()}
              </Text>
            </div>
            <div className="hl-looks-work">
              <Frame
                url={host}
                label={`${me.person.name}'s portfolio home page in the ${look.name} look: the same words in a different face, colours and layout. The projects are made up.`}
                page="hl-looks-page"
              >
                <AspectRatio ratio={4 / 3}>
                  <PortfolioHome
                    person={me.person}
                    theme={look}
                    projects={demoHomeProjects()}
                    featuredId={null}
                    sections={["featured"]}
                    tiles={demoPortfolio.tiles}
                  />
                </AspectRatio>
              </Frame>
            </div>
          </div>
        </div>
        {LOOKS.map((t, i) => (
          <span key={t.id} aria-hidden data-look-step={t.id} className="hl-look-step" style={{ "--i": i } as React.CSSProperties} />
        ))}
      </div>
    </section>
  );
}
