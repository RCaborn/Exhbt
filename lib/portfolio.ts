import "server-only";
import { headers } from "next/headers";
import { imagesOf, type ExhbtDoc } from "./exhbt/blocks";
import { signedFileUrl } from "./files";
import { parseHost, portfolioHost } from "./hosts";
import { ENTITLEMENTS } from "./entitlements";
import { homeProject, type HomeProject } from "./portfolio-home";
import { EXTRA_SECTIONS, sectionsOf, type PortfolioLayout, type SectionKey } from "./portfolio-layout";
import { themeFor, type PortfolioTheme } from "./portfolio-themes";
import { visibleOnPortfolio } from "./plan-rules";
import { getStore, type ExhbtRecord, type PortfolioProfile } from "./store";
import { teamFor } from "./team";
import type { Teammate } from "./team-rules";

/**
 * Everything a public portfolio page needs, loaded the same way for the at-a-glance page and
 * a single project. Only published, plan-visible exhbts are ever returned, and always their
 * published copy, never the working draft.
 */

/** `team`: the people on it besides the author, when it's a team project (decision 0013). */
export type PortfolioItem = { id: string; slug: string; doc: ExhbtDoc; publishedAt: string | null; team: Teammate[] };

export type LoadedPortfolio =
  | {
      status: "ok";
      /** The portfolio owner: every file shown on it must be theirs (lib/files.ts mayShowFile). */
      userId: string;
      profile: PortfolioProfile & { username: string };
      displayName: string;
      photoUrl: string | null;
      /** The projects on the home page, the featured one first, then in the person's order. */
      items: PortfolioItem[];
      /** The same projects as the home page's band and cards show them (title, one sentence, key figure). */
      projects: HomeProject[];
      /** The home page's sections, top to bottom (decision 0016). */
      sections: SectionKey[];
      /** Live at their own link but left off the glance page by the person (decision 0014). */
      hiddenItems: PortfolioItem[];
      featuredId: string | null;
      layout: PortfolioLayout;
      base: string;
      theme: PortfolioTheme;
    }
  | { status: "redirect"; to: string }
  /**
   * The name is taken but nothing is live yet (a draft-only paid account, or Free). Visitors get
   * not found; the owner gets a preview of how the page will look (decision 0016).
   */
  | { status: "empty"; userId: string; username: string; base: string }
  | { status: "missing" };

/**
 * Where links on a portfolio point. On alex.exhbt.co.uk the paths are "/" and "/<slug>";
 * in development and previews (one origin) they live under /p/alex.
 */
async function basePath(username: string): Promise<string> {
  const host = parseHost((await headers()).get("host"));
  return host.kind === "portfolio" ? "" : `/p/${username}`;
}

/** Where a renamed username's visitors go: the same path on the new name. */
async function redirectTarget(newUsername: string, rest: string): Promise<string> {
  const h = await headers();
  const host = parseHost(h.get("host"));
  if (host.kind !== "portfolio") return `/p/${newUsername}${rest}`;
  const raw = h.get("host") ?? "";
  // alex.localhost:3200 in tests; alex.exhbt.co.uk in production.
  const target = raw.endsWith(".localhost") || /\.localhost:\d+$/.test(raw) ? raw.replace(/^[^.]+/, newUsername) : portfolioHost(newUsername);
  const proto = raw.includes("localhost") ? "http" : "https";
  return `${proto}://${target}${rest || "/"}`;
}

export async function loadPortfolio(username: string, rest = ""): Promise<LoadedPortfolio> {
  const store = getStore();
  const found = await store.lookupUsername(username);
  if (!found) return { status: "missing" };
  if ("redirectTo" in found) return { status: "redirect", to: await redirectTarget(found.redirectTo, rest) };

  const plan = await store.planFor(found.userId);
  const reachable = visibleOnPortfolio(plan, await store.listExhbts(found.userId));
  // Free has no public page (decision 0006); nor does a paid account with nothing live yet.
  if (reachable.length === 0) return { status: "empty", userId: found.userId, username: found.username, base: await basePath(found.username) };

  const profile = await store.getPortfolioProfile(found.userId);
  const host = (await headers()).get("x-forwarded-host") ?? (await headers()).get("host");

  // The arrangement (decisions 0014 and 0016): hidden exhbts leave the page, the featured one is the
  // band, and the sections come in the person's order; experience and a quote only on a plan with extra tiles.
  const hidden = new Set(reachable.filter((e) => e.hiddenOnPortfolio).map((e) => e.id));
  const featuredId =
    profile.featuredExhbtId && reachable.some((e) => e.id === profile.featuredExhbtId) && !hidden.has(profile.featuredExhbtId) ? profile.featuredExhbtId : null;
  const extras = ENTITLEMENTS[plan].extraTiles;
  const shownList = reachable.filter((e) => !hidden.has(e.id));
  const listed = featuredId ? [shownList.find((e) => e.id === featuredId)!, ...shownList.filter((e) => e.id !== featuredId)] : shownList;
  const toFull = async (e: ExhbtRecord) => ({ ...toItem(e), team: await teamFor(e, host) });
  const base = await basePath(found.username);
  const projects = await Promise.all(
    shownList.map(async (e) => {
      const p = homeProject(e.id, e.published!, `${base}/${e.slug}`);
      return p.figure.kind === "image" ? { ...p, imageUrl: await signedFileUrl(p.figure.fileId, e.userId) } : p;
    }),
  );
  return {
    status: "ok",
    userId: found.userId,
    profile: { ...profile, username: found.username },
    displayName: profile.name?.trim() || found.username,
    photoUrl: await signedFileUrl(profile.photoFileId, found.userId),
    items: await Promise.all(listed.map(toFull)),
    hiddenItems: await Promise.all(reachable.filter((e) => hidden.has(e.id)).map(toFull)),
    projects,
    sections: sectionsOf(profile.layout).filter((k) => extras || !EXTRA_SECTIONS.includes(k)),
    featuredId,
    layout: profile.layout,
    base,
    // The chosen look if the plan still has it; the stored choice is never cleared here.
    theme: themeFor(profile, plan),
  };
}

const toItem = (e: ExhbtRecord): Omit<PortfolioItem, "team"> => ({ id: e.id, slug: e.slug!, doc: e.published!, publishedAt: e.publishedAt });

/**
 * Signed URLs for one exhbt's images and its evidence file (links pass through). `ownerId` is the exhbt's
 * owner: a file that isn't theirs gets no URL, so a doc can never show someone else's file.
 */
export async function mediaFor(doc: ExhbtDoc, ownerId: string): Promise<{ imageUrls: Record<string, string | null>; evidenceUrl: string | null }> {
  const imageUrls: Record<string, string | null> = {};
  for (const im of imagesOf(doc)) imageUrls[im.fileId] = await signedFileUrl(im.fileId, ownerId);
  const ev = doc.evidence;
  const evidenceUrl = !ev ? null : ev.kind === "link" ? ev.href : await signedFileUrl(ev.fileId, ownerId);
  return { imageUrls, evidenceUrl };
}

/** "12 Nov 2026", for the date beside the checks. */
export const checkedOnLabel = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : undefined;
