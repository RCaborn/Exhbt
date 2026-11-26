import "server-only";
import { joinRequestsFor } from "@/lib/duplicates";
import { ENTITLEMENTS, PLAN_NAMES, type Plan } from "@/lib/entitlements";
import { signedFileUrl } from "@/lib/files";
import { canClaimUsername, canCreateExhbt, canMakeJobLinks, canPublish as publishVerdict, canUseExtraTiles, canUseTheme, customisableExhbts, getPlan, limitsFor, visibleOnPortfolio } from "@/lib/plan";
import type { CustomiseState } from "@/lib/portfolio-customise";
import { portfolioHref } from "@/lib/portfolio-links";
import { homeProject, type HomeProject } from "@/lib/portfolio-home";
import { EXTRA_SECTIONS, sectionsOf, TILE_KINDS } from "@/lib/portfolio-layout";
import { draftFromProfile } from "@/lib/portfolio-profile";
import { PORTFOLIO_THEMES, themeById, themeFor } from "@/lib/portfolio-themes";
import { getStore, type ExhbtRecord } from "@/lib/store";
import type { ExhbtDoc } from "@/lib/exhbt/blocks";
import type { BuilderProps } from "./Builder";
import type { BuilderProject, ThemeLock } from "./steps";

/*
 * Everything `/portfolio` loads for a person (decision 0031): what the step builder has always been
 * given (`builder`, built exactly as page.tsx built it), and what only the one-page editor draws (the
 * owner-only tiles, the Add tile's count, what "See as a visitor" shows, the team notice and the Job
 * links menu). page.tsx calls it for both, so the two builders can never be given different pages.
 * No figure is written here: every number comes from lib/entitlements.ts through the plan rules.
 */

/** On a paid plan, an exhbt the page does not arrange: a draft, or one over the plan's limit. Drawn from its working copy. Empty on Free, where every exhbt is arranged. */
export type OwnerOnlyExhbt = { id: string; title: string; home: HomeProject; why: "draft" | "over-limit" };

/** The Add tile's words: how many exhbts the plan holds and whether there is room (canCreateExhbt, limitsFor). */
export type AddRoom =
  | { ok: true; used: number; limit: number; planName: string }
  | { ok: false; used: number; limit: number; planName: string; reason: string; upgradeTo?: Plan };

/** What "See as a visitor" draws from: the published copies a visitor's page would list (visibleOnPortfolio), before the person's order and hiding are applied. */
export type VisitorSource = { publicPlan: boolean; published: { id: string; home: HomeProject }[] };

export type PortfolioData = {
  /** Exactly what page.tsx gives Builder today, but `step`. */
  builder: Omit<BuilderProps, "step">;
  ownerOnly: OwnerOnlyExhbt[];
  addRoom: AddRoom;
  visitor: VisitorSource;
  /** How many people are waiting for an answer to join one of the person's exhbts (joinRequestsFor). */
  teamRequests: number;
  /** canMakeJobLinks(plan).ok, for the bar's Job links menu. */
  jobLinks: boolean;
  /** Whether the person is an admin, as /admin recognises one: the bar's menu offers an admin the step builder for good (decision 0031, "The admin trial"). */
  admin: boolean;
};

/** An exhbt as the home page draws it, from `doc`, with its picture's address signed when its key figure is one. */
async function homeOf(e: ExhbtRecord, doc: ExhbtDoc, href: string | null): Promise<HomeProject> {
  const home = homeProject(e.id, doc, href);
  if (home.figure.kind === "image") home.imageUrl = await signedFileUrl(home.figure.fileId, e.userId);
  return home;
}

/**
 * How many people are waiting to join one of the person's exhbts. Only the editor's notice reads it, so a
 * failure here (a table the database lacks) is logged and counted as none: it must never cost anyone the page.
 */
async function waitingToJoin(userId: string): Promise<number> {
  try {
    return (await joinRequestsFor(userId)).length;
  } catch (e) {
    console.error("portfolio: could not read the requests to join, so the notice is left out:", (e as Error).message);
    return 0;
  }
}

/** `admin` is isAdmin(user), checked on this request by the page, which decides the builder with it. */
export async function loadPortfolioData(userId: string, host: string | null, admin = false): Promise<PortfolioData> {
  const store = getStore();
  const [plan, exhbts, profile, teamRequests] = await Promise.all([getPlan(userId), store.listExhbts(userId), store.getPortfolioProfile(userId), waitingToJoin(userId)]);
  const photoUrl = await signedFileUrl(profile.photoFileId, userId);
  const isPublic = ENTITLEMENTS[plan].publicPortfolio;
  const tilesVerdict = canUseExtraTiles(plan);
  const held = isPublic ? null : publishVerdict(plan, exhbts, "");

  // The exhbts the portfolio lists (any exhbt on Free, which can't publish, so there is something to arrange).
  const candidates = customisableExhbts(plan, exhbts);
  const projects: BuilderProject[] = await Promise.all(
    candidates.map(async (e) => {
      const home = await homeOf(e, isPublic && e.published ? e.published : e.doc, "#");
      return { id: e.id, title: home.title, home, live: e.status === "published" };
    }),
  );
  const listed = new Set(projects.map((p) => p.id));
  const unlisted = exhbts.filter((e) => !listed.has(e.id));
  const drafts = unlisted.map((e) => ({ id: e.id, title: e.doc.title.trim() || "Untitled exhbt", live: e.status === "published" }));

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
  const viewHref = profile.username ? portfolioHref(profile.username, host) : null;

  // On a paid plan the page arranges only what can be live (customisableExhbts), so a draft or an exhbt
  // over the plan's limit is the owner's alone: drawn after the work from its working copy. On Free every
  // exhbt is arranged, so there is none.
  const ownerOnly: OwnerOnlyExhbt[] = isPublic
    ? await Promise.all(
        [...unlisted]
          .sort((a, b) => a.position - b.position)
          .map(async (e) => {
            const home = await homeOf(e, e.doc, null);
            return { id: e.id, title: home.title, home, why: e.status === "published" ? ("over-limit" as const) : ("draft" as const) };
          }),
      )
    : [];

  const limit = limitsFor(plan).exhbts;
  const room = canCreateExhbt(plan, exhbts);
  const count = { used: exhbts.length, limit, planName: PLAN_NAMES[plan] };
  const addRoom: AddRoom = room.ok ? { ok: true, ...count } : { ok: false, ...count, reason: room.reason, upgradeTo: room.upgradeTo };

  // What a visitor's page would list: the published copies, each linked to its own page as the public page links it.
  const published = await Promise.all(visibleOnPortfolio(plan, exhbts).map(async (e) => ({ id: e.id, home: await homeOf(e, e.published!, viewHref ? `${viewHref}/${e.slug}` : "#") })));

  return {
    builder: {
      initial: { profile: draftFromProfile(profile), arrangement },
      projects,
      drafts,
      photoUrl,
      username: profile.username,
      plan: {
        name: PLAN_NAMES[plan],
        isPublic,
        publishNote: held && !held.ok ? { reason: held.reason, upgradeTo: held.upgradeTo } : null,
        extraTiles: tilesVerdict.ok,
        extraTilesReason: tilesVerdict.ok ? null : tilesVerdict.reason,
        heldTiles: !tilesVerdict.ok && storedSections.some((k) => EXTRA_SECTIONS.includes(k)),
        uploadMb: ENTITLEMENTS[plan].uploadMbPerFile,
      },
      addressBlocked: address.ok ? null : { reason: profile.username ? `Changing your address comes with ${PLAN_NAMES.premium}.` : address.reason, upgradeTo: address.upgradeTo },
      locks,
      savedButLocked: storedTheme && storedTheme.id !== shown.id ? storedTheme.name : null,
      viewHref,
    },
    ownerOnly,
    addRoom,
    visitor: { publicPlan: isPublic, published },
    teamRequests,
    // Whether the plan has job links at all (the menu shows the links, or the upgrade line).
    jobLinks: canMakeJobLinks(plan, 0).ok,
    admin,
  };
}
