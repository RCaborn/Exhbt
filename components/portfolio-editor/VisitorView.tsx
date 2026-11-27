"use client";

import { useMemo, type ReactNode } from "react";
import { Banner } from "@astryxdesign/core/Banner";
import type { PortfolioData } from "@/app/(app)/portfolio/load";
import { PortfolioHome } from "@/components/portfolio/PortfolioHome";
import { lookAttrs, themeStyle } from "@/components/portfolio/themeFonts";
import { Button } from "@/components/ui/Button";
import { GROUND } from "./geometry";
import { visitorHome, type Home } from "./home-props";
import { usePortfolioApi, usePortfolioData, usePortfolioState } from "./runtime";

/**
 * "See as a visitor" (decision 0031): the same page with no adapter, in public mode, from the published
 * copies only, in the person's order and without hidden exhbts, drafts, exhbts over the plan's limit,
 * held extras or a look that is only being previewed: exactly what an employer gets once the page is
 * online. It is what the editing page is tested against.
 *
 * When visitors get "not found" today, a line above the page says so and why, in this order: the plan
 * has no public page; there is no address; nothing is live (no exhbt yet, only drafts, or every live one
 * hidden). Each line offers the one step that puts the page online. The line is app chrome (Astryx's
 * Banner); the page under it is the person's own.
 */
export function VisitorView(): ReactNode {
  const state = usePortfolioState((s) => s);
  const data = usePortfolioData();
  const home = useMemo(() => visitorHome(state, data), [state, data]);
  return (
    <section aria-label="Preview" data-canvas="visitor">
      <NotOnline data={data} home={home} />
      <div {...lookAttrs(home.theme)} style={themeStyle(home.theme)} className={GROUND}>
        <PortfolioHome {...home} mode="public" />
      </div>
    </section>
  );
}

/** Why visitors get "not found" for now, or nothing when the page is online. */
function NotOnline({ data, home }: { data: PortfolioData; home: Home }): ReactNode {
  const api = usePortfolioApi();
  const plan = data.builder.plan.name;
  if (!data.visitor.publicPlan) {
    return (
      <Banner
        status="info"
        container="section"
        data-not-online="plan"
        title={`Only you can see this page on ${plan}`}
        description="Visitors get “not found” for now. This is how your page will look once it is online."
        endContent={
          <Button href="/account/billing" size="sm">
            See plans
          </Button>
        }
      />
    );
  }
  if (!data.builder.username) {
    return (
      <Banner
        status="info"
        container="section"
        data-not-online="address"
        title="Not online yet: claim your address"
        description="Your page needs an address before anyone can visit it. This is how it will look."
        endContent={
          <Button size="sm" onClick={(e) => api.open("address", e.currentTarget as HTMLElement)}>
            Claim your address
          </Button>
        }
      />
    );
  }
  if (home.projects.length === 0) return <NothingLive data={data} />;
  return null;
}

/** A draft's title, short enough for a button. */
const short = (title: string) => (title.length > 32 ? `${title.slice(0, 31).trimEnd()}…` : title);

/**
 * Nothing on the page is live, by why: no exhbt at all, only drafts, or every live one hidden from the
 * page. Each with the one step that changes it.
 */
function NothingLive({ data }: { data: PortfolioData }): ReactNode {
  const api = usePortfolioApi();
  const draft = data.visitor.newestDraft;
  if (data.visitor.published.length > 0) {
    return (
      <Banner
        status="info"
        container="section"
        data-not-online="all-hidden"
        title="Not online yet: every exhbt is hidden"
        description="Visitors get “not found” while none of your live exhbts is shown on your portfolio. This is how your page will look."
        endContent={
          <Button size="sm" onClick={() => showHidden(api)}>
            Show one
          </Button>
        }
      />
    );
  }
  if (draft) {
    return (
      <Banner
        status="info"
        container="section"
        data-not-online="drafts-only"
        title="Not online yet: publish an exhbt"
        description="Visitors get “not found” until one of your exhbts is live. Finish a draft and publish it. This is how your page will look."
        endContent={
          <Button href={`/exhbts/${draft.id}/edit`} size="sm">
            {draft.title ? `Open ${short(draft.title)}` : "Open your draft"}
          </Button>
        }
      />
    );
  }
  return (
    <Banner
      status="info"
      container="section"
      data-not-online="no-exhbt"
      title="Not online yet: add an exhbt"
      description="Visitors get “not found” until one of your exhbts is live. This is how your page will look."
      endContent={
        <Button href="/exhbts/new" size="sm">
          Add an exhbt
        </Button>
      }
    />
  );
}

/**
 * "Show one": back to the editing page, at the hidden exhbts (the row F draws, `[data-hidden-row]`, each
 * with its own Show button), with the focus on the first Show. Waits a frame at a time for the editing
 * page to be drawn; with no hidden row on the page, the work is the place.
 */
function showHidden(api: ReturnType<typeof usePortfolioApi>): void {
  api.seeAsVisitor(false);
  let tries = 40;
  const go = () => {
    const page = document.querySelector<HTMLElement>('[data-editor="portfolio"] [data-canvas="edit"]');
    const row = page?.querySelector<HTMLElement>("[data-hidden-row]");
    if (!row && tries-- > 0) return void requestAnimationFrame(go);
    const place = row ?? page?.querySelector<HTMLElement>('[data-section="work"]');
    if (!place) return;
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    place.scrollIntoView({ block: "center", behavior: calm ? "auto" : "smooth" });
    (row?.querySelector<HTMLElement>("[data-show], button") ?? place).focus({ preventScroll: true });
  };
  requestAnimationFrame(go);
}
