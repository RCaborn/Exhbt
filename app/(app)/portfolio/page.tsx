import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { ENTITLEMENTS, PLAN_NAMES } from "@/lib/entitlements";
import { signedFileUrl } from "@/lib/files";
import { canClaimUsername, canPublish as publishVerdict, canUseExtraTiles, canUseTheme, customisableExhbts, getPlan } from "@/lib/plan";
import type { CustomiseState } from "@/lib/portfolio-customise";
import { portfolioHref } from "@/lib/portfolio-links";
import { homeProject } from "@/lib/portfolio-home";
import { EXTRA_SECTIONS, sectionsOf, TILE_KINDS } from "@/lib/portfolio-layout";
import { draftFromProfile } from "@/lib/portfolio-profile";
import { PORTFOLIO_THEMES, themeById, themeFor } from "@/lib/portfolio-themes";
import { isPhase2Enabled } from "@/lib/site";
import { getStore } from "@/lib/store";
import { Builder } from "./Builder";
import { isStep, type BuilderProject, type Step, type ThemeLock } from "./steps";

export const metadata: Metadata = { title: "Build your portfolio", robots: { index: false } };
// Per person, and EXHBT_PHASE2 is read at request time: never prerender (it would bake in the 404).
export const dynamic = "force-dynamic";

/**
 * Build your portfolio (decision 0016): one guided flow in four steps, You, Your look, Your projects
 * and Publish, with a live preview of the whole page beside it. It replaces portfolio settings and
 * the customiser, which redirect here. This page only loads; Builder.tsx does the work and every
 * change goes through the checks in actions.ts.
 */
export default async function BuildPortfolioPage({ searchParams }: { searchParams: Promise<{ step?: string }> }) {
  if (!isPhase2Enabled()) notFound();
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/portfolio");
  const asked = (await searchParams).step;
  const step: Step = isStep(asked) ? asked : "you";

  const store = getStore();
  const [plan, exhbts, profile, host] = await Promise.all([
    getPlan(user.id),
    store.listExhbts(user.id),
    store.getPortfolioProfile(user.id),
    headers().then((h) => h.get("x-forwarded-host") ?? h.get("host")),
  ]);
  const photoUrl = await signedFileUrl(profile.photoFileId, user.id);
  const isPublic = ENTITLEMENTS[plan].publicPortfolio;
  const tilesVerdict = canUseExtraTiles(plan);
  const held = isPublic ? null : publishVerdict(plan, exhbts, "");

  // The exhbts the portfolio lists (any exhbt on Free, which can't publish, so there is something to arrange).
  const candidates = customisableExhbts(plan, exhbts);
  const projects: BuilderProject[] = await Promise.all(
    candidates.map(async (e) => {
      const doc = isPublic && e.published ? e.published : e.doc;
      const home = homeProject(e.id, doc, "#");
      if (home.figure.kind === "image") home.imageUrl = await signedFileUrl(home.figure.fileId, user.id);
      return { id: e.id, title: home.title, home, live: e.status === "published" };
    }),
  );
  const listed = new Set(projects.map((p) => p.id));
  const drafts = exhbts.filter((e) => !listed.has(e.id)).map((e) => ({ id: e.id, title: e.doc.title.trim() || "Untitled exhbt", live: e.status === "published" }));

  // Experience and a quote are held, not deleted, when a plan doesn't have them: they come back with the plan.
  const storedSections = sectionsOf(profile.layout);
  const order = projects.map((p) => p.id);
  const sections = storedSections.filter((k) => tilesVerdict.ok || !EXTRA_SECTIONS.includes(k));
  const featured = profile.featuredExhbtId && listed.has(profile.featuredExhbtId) ? profile.featuredExhbtId : null;
  const hidden = candidates.filter((e) => e.hiddenOnPortfolio).map((e) => e.id);
  const shown = themeFor(profile, plan);
  const stored = profile.layout.tiles;
  const stateTiles: CustomiseState["tiles"] = tilesVerdict.ok ? stored : { about: stored.about, education: stored.education, links: stored.links };
  const arrangement: CustomiseState = {
    order,
    sections,
    hidden,
    featured: featured && !hidden.includes(featured) ? featured : null,
    themeId: shown.id,
    header: profile.layout.header,
    tiles: Object.fromEntries(TILE_KINDS.filter((k) => stateTiles[k]).map((k) => [k, stateTiles[k]])) as CustomiseState["tiles"],
  };

  const locks: Record<string, ThemeLock> = {};
  // By look: a look's colourways come with it.
  for (const t of PORTFOLIO_THEMES) {
    const v = canUseTheme(plan, t);
    if (!v.ok) locks[t.look] = { reason: v.reason, upgradeTo: v.upgradeTo, planName: PLAN_NAMES[v.upgradeTo ?? "max"] };
  }
  const storedTheme = themeById(profile.themeId);
  const address = canClaimUsername(plan);

  return (
    <Builder
      step={step}
      initial={{ profile: draftFromProfile(profile), arrangement }}
      projects={projects}
      drafts={drafts}
      photoUrl={photoUrl}
      username={profile.username}
      plan={{
        name: PLAN_NAMES[plan],
        isPublic,
        publishNote: held && !held.ok ? { reason: held.reason, upgradeTo: held.upgradeTo } : null,
        extraTiles: tilesVerdict.ok,
        extraTilesReason: tilesVerdict.ok ? null : tilesVerdict.reason,
        heldTiles: !tilesVerdict.ok && storedSections.some((k) => EXTRA_SECTIONS.includes(k)),
        uploadMb: ENTITLEMENTS[plan].uploadMbPerFile,
      }}
      addressBlocked={
        address.ok
          ? null
          : { reason: profile.username ? `Changing your address comes with ${PLAN_NAMES.premium}.` : address.reason, upgradeTo: address.upgradeTo }
      }
      locks={locks}
      savedButLocked={storedTheme && storedTheme.id !== shown.id ? storedTheme.name : null}
      viewHref={profile.username ? portfolioHref(profile.username, host) : null}
    />
  );
}
