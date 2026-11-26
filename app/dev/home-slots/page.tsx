import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PortfolioHome, type HomeProps } from "@/components/portfolio/PortfolioHome";
import { personFrom } from "@/components/portfolio/PortfolioPage";
import { loadPortfolio } from "@/lib/portfolio";
import { themeById } from "@/lib/portfolio-themes";
import { isSupabaseConfigured } from "@/lib/store";
import { CASES, isCase, standIn } from "./stand-in";

export const metadata: Metadata = { title: "Home slots", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * Development only: the portfolio's slot harness (decision 0031, "The adapter"; brief D of
 * docs/briefs/portfolio-first). It draws a person's portfolio home with a stand-in for the portfolio
 * editor's adapter (./stand-in.tsx), which marks every slot the page calls and adds no box, so
 * e2e/home-slots.spec.ts can check that every field is reachable and that the editing page sits
 * where the visitor's page does.
 *
 *   ?u=       the person: any fixture of e2e/fixtures/portfolio-pages.ts seeded through
 *             POST /dev/portfolio-parity, loaded as their public page loads it (loadPortfolio)
 *   ?look=    a look's id (any colourway); the person's own by default
 *   ?read=1   the same page with no adapter: the visitor's page
 *   ?case=    full (as seeded, the default), none (no exhbt yet), one (one exhbt), no-work (More of
 *             my work off the page), empty (all six sections, no words in any, no links)
 *
 * Not found in production or with a database configured, as the other development pages are, and
 * for a person with nothing live.
 */
export default async function HomeSlots({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (process.env.NODE_ENV === "production" || isSupabaseConfigured()) notFound();
  const q = await searchParams;
  const p = typeof q.u === "string" ? await loadPortfolio(q.u) : null;
  if (!p || p.status !== "ok" || p.items.length === 0) notFound();
  const seeded: HomeProps = {
    person: personFrom(p.profile, p.displayName, p.photoUrl, p.layout),
    theme: p.theme,
    projects: p.projects,
    featuredId: p.featuredId,
    sections: p.sections,
    tiles: p.layout.tiles,
  };
  const props = CASES[isCase(q.case) ? q.case : "full"](seeded);
  const theme = (typeof q.look === "string" && themeById(q.look)) || p.theme;
  const read = q.read === "1";

  return (
    <main id="main" data-home-slots={read ? "read" : "edit"}>
      <PortfolioHome {...props} theme={theme} edit={read ? undefined : standIn()} />
    </main>
  );
}
