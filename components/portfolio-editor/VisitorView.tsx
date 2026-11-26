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
 * has no public page; there is no address; nothing is live. The line is app chrome (Astryx's Banner);
 * the page under it is the person's own.
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
          <Button size="sm" onClick={() => api.open("address")}>
            Claim your address
          </Button>
        }
      />
    );
  }
  if (home.projects.length === 0) {
    return (
      <Banner
        status="info"
        container="section"
        data-not-online="nothing-live"
        title="Not online yet: publish an exhbt"
        description="Visitors get “not found” until one of your exhbts is live and shown here. This is how your page will look."
      />
    );
  }
  return null;
}
