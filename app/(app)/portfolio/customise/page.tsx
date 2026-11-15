import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { ENTITLEMENTS, PLAN_NAMES } from "@/lib/entitlements";
import { tileFromDoc } from "@/lib/exhbt/headline";
import { signedFileUrl } from "@/lib/files";
import { canPublish as publishVerdict, canUseExtraTiles, canUseTheme, customisableExhbts, getPlan } from "@/lib/plan";
import { portfolioHref } from "@/lib/portfolio-links";
import { isTileKind, sequence, TILE_KINDS } from "@/lib/portfolio-layout";
import type { CustomiseState } from "@/lib/portfolio-customise";
import { PORTFOLIO_THEMES, themeById, themeFor } from "@/lib/portfolio-themes";
import { isPhase2Enabled } from "@/lib/site";
import { getStore } from "@/lib/store";
import { Customiser, type CustomiseProject } from "./Customiser";
import type { ThemeLock } from "./ThemeStrip";

export const metadata: Metadata = { title: "Customise portfolio", robots: { index: false } };
// Per person, and EXHBT_PHASE2 is read at request time: never prerender (it would bake in the 404).
export const dynamic = "force-dynamic";

/**
 * Customise portfolio (decision 0014): a live, real-size preview of the person's at-a-glance page,
 * built from the same components as /p/<username>, where they drag tiles, hide and feature
 * exhbts, pick a look, switch header bits and add extra tiles. Everything saves itself
 * (saveCustomisationAction). This page only loads; Customiser.tsx does the work.
 */
export default async function CustomisePortfolioPage() {
  if (!isPhase2Enabled()) notFound();
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/portfolio/customise");

  const store = getStore();
  const [plan, exhbts, profile, host] = await Promise.all([
    getPlan(user.id),
    store.listExhbts(user.id),
    store.getPortfolioProfile(user.id),
    headers().then((h) => h.get("x-forwarded-host") ?? h.get("host")),
  ]);
  const photoUrl = await signedFileUrl(profile.photoFileId);
  const canPublish = ENTITLEMENTS[plan].publicPortfolio;
  const tilesVerdict = canUseExtraTiles(plan);
  // On Free the customiser is a preview; the usual reason publishing is held back comes from the plan rules.
  const held = canPublish ? null : publishVerdict(plan, exhbts, "");

  // The tiles: the exhbts the portfolio shows (any exhbt on Free, which can't publish, so there is something to arrange).
  const candidates = customisableExhbts(plan, exhbts);
  const projects: CustomiseProject[] = candidates.map((e) => {
    const doc = canPublish && e.published ? e.published : e.doc;
    return { id: e.id, title: doc.title.trim() || "Untitled exhbt", tile: tileFromDoc(doc), live: e.status === "published" };
  });
  const ids = new Set(projects.map((p) => p.id));

  // Extra tiles are held, not deleted, when a plan doesn't have them: they come back with the plan.
  const stored = profile.layout.slots.filter(isTileKind);
  const order = sequence(profile.layout, projects.map((p) => p.id)).filter((k) => !isTileKind(k) || tilesVerdict.ok);
  const featured = profile.featuredExhbtId && ids.has(profile.featuredExhbtId) ? profile.featuredExhbtId : null;
  const hidden = candidates.filter((e) => e.hiddenOnPortfolio).map((e) => e.id);
  const shown = themeFor(profile, plan);
  const stateTiles = tilesVerdict.ok ? profile.layout.tiles : {};

  const initial: CustomiseState = {
    order,
    hidden,
    featured: featured && !hidden.includes(featured) ? featured : null,
    themeId: shown.id,
    header: profile.layout.header,
    tiles: Object.fromEntries(TILE_KINDS.filter((k) => order.includes(k)).map((k) => [k, stateTiles[k]])) as CustomiseState["tiles"],
  };

  // Looks the plan doesn't have are locked, with the offer that opens them (as on /account/portfolio).
  const locks: Record<string, ThemeLock> = {};
  for (const t of PORTFOLIO_THEMES) {
    const v = canUseTheme(plan, t);
    if (!v.ok) locks[t.id] = { reason: v.reason, upgradeTo: v.upgradeTo, planName: PLAN_NAMES[v.upgradeTo ?? "max"] };
  }
  const stored_theme = themeById(profile.themeId);
  const savedButLocked = stored_theme && stored_theme.id !== shown.id ? stored_theme.name : null;

  const username = profile.username;
  return (
    <div className="bg-mist">
      <div className="mx-auto max-w-[64rem] px-4 pt-8 pb-16 sm:px-8 lg:pt-12">
        <p className="text-sm">
          <Link href="/account/portfolio" className="link">
            Portfolio settings
          </Link>
          <span aria-hidden className="mx-2 text-slate">
            /
          </span>
          <Link href="/exhbts" className="link">
            Your exhbts
          </Link>
        </p>
        <h1 className="mt-2">Customise portfolio</h1>
        {!username ? (
          <p className="mt-4 max-w-[40rem] text-graphite">
            Choose a username first: it&rsquo;s your portfolio&rsquo;s address.{" "}
            <Link href="/account/portfolio" className="link font-semibold text-ink">
              Go to portfolio settings
            </Link>
          </p>
        ) : (
          <Customiser
            initial={initial}
            projects={projects}
            owner={{ username, name: profile.name?.trim() || username, headline: profile.headline, bio: profile.bio, linkedin: profile.linkedin, photoUrl }}
            plan={{
              name: PLAN_NAMES[plan],
              canPublish,
              publishNote: held && !held.ok ? { reason: held.reason, upgradeTo: held.upgradeTo } : null,
              extraTiles: tilesVerdict.ok,
              extraTilesReason: tilesVerdict.ok ? null : tilesVerdict.reason,
              heldTiles: !tilesVerdict.ok && stored.length > 0,
            }}
            locks={locks}
            savedButLocked={savedButLocked}
            viewHref={canPublish ? portfolioHref(username, host) : null}
            unpublished={exhbts.length - candidates.length}
          />
        )}
      </div>
    </div>
  );
}
