"use client";

import { useRef, useState } from "react";
import { flushSync } from "react-dom";
import { AspectRatio } from "@astryxdesign/core/AspectRatio";
import { PortfolioHome } from "@/components/portfolio/PortfolioHome";
import { ProjectView } from "@/components/portfolio/ProjectView";
import { lookAttrs, themeStyle } from "@/components/portfolio/themeFonts";
import { demoHomeProjects, demoPortfolio } from "@/lib/exhbt";
import { portfolioHost, portfolioUrl } from "@/lib/hosts";
import { DEFAULT_THEME } from "@/lib/portfolio-themes";
import { Frame } from "../Frame";
import { exhbtOf } from "../samples";
import { useHomeName } from "./HomeName";

type WithTransitions = Document & {
  startViewTransition?: (arg: { update: () => void; types?: string[] }) => unknown;
};

/**
 * The page in the hero's frame: her portfolio home (with the typed name, if there is one).
 *
 * At maximal the frame is a working window instead of a picture: "See how I did it" on her best
 * work opens that exhbt inside the frame, and the band's title travels to become the exhbt's title,
 * a shared-element view transition (type `hl-open`, home.css). "All of her work" on the exhbt goes
 * back the same way. Nothing leaves the lab: the page's links are caught here. This is the
 * creative review's maximal tile, mocked on Home only; on visitors' pages it would change markup
 * the golden copies compare, so it can't be built there before launch.
 *
 * Without motion (Motion off, reduced motion) the page simply swaps.
 */
export function HeroPage({ live, moves }: { live: boolean; moves: boolean }) {
  const me = useHomeName();
  const [open, setOpen] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const shown = live && open ? exhbtOf(open) : null;
  const host = portfolioHost(me.username);

  const go = (slug: string | null) => {
    const doc = document as WithTransitions;
    if (!moves || !doc.startViewTransition || !root.current) {
      setOpen(slug);
      return;
    }
    const ms = getComputedStyle(root.current).getPropertyValue("--duration-slow").trim();
    document.documentElement.style.setProperty("--hl-open-time", ms || "720ms");
    try {
      doc.startViewTransition({ update: () => flushSync(() => setOpen(slug)), types: ["hl-open"] });
    } catch {
      setOpen(slug);
    }
  };

  // The page's own links would leave the lab: the exhbt's link opens it here, "All of her work" comes back, the rest do nothing.
  const catchLinks = (e: React.MouseEvent) => {
    const a = (e.target as HTMLElement).closest("a");
    if (!a) return;
    e.preventDefault();
    const href = a.getAttribute("href") ?? "";
    if (href.startsWith("/demo/")) go(href.slice("/demo/".length));
    else if (href === "/demo") go(null);
  };

  return (
    <div ref={root} className="hl-hero-window" data-live={live || undefined}>
      <Frame
        url={shown ? portfolioUrl(me.username, shown.slug) : host}
        label={
          me.yours
            ? `A preview of a portfolio home page with your name, ${me.name}, at ${host}, filled with made-up example projects`
            : `${demoPortfolio.person.name}'s portfolio home page, a made-up example: her name, her intro and her best piece of work`
        }
        page="hl-hero-page"
        live={live}
      >
        <AspectRatio ratio={4 / 3}>
          <div className="hl-hero-scroll" onClickCapture={live ? catchLinks : undefined}>
            {shown ? (
              <div {...lookAttrs(DEFAULT_THEME)} style={themeStyle(DEFAULT_THEME)} className="bg-[var(--pf-ground)] p-8 text-[color:var(--pf-ink)]">
                <ProjectView
                  doc={shown.doc}
                  owner={{ name: me.person.name, photoUrl: null, bio: demoPortfolio.person.headline, homeHref: "/demo" }}
                  evidenceUrl="#"
                  checkedOn={shown.checkedOn}
                  headingLevel="h2"
                />
              </div>
            ) : (
              <PortfolioHome
                person={me.person}
                theme={DEFAULT_THEME}
                projects={demoHomeProjects()}
                featuredId={null}
                sections={["featured"]}
                tiles={demoPortfolio.tiles}
              />
            )}
          </div>
        </AspectRatio>
      </Frame>
    </div>
  );
}
