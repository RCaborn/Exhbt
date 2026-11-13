import "server-only";
import { headers } from "next/headers";
import { plain, type ExhbtDoc } from "./exhbt/blocks";
import { signedFileUrl } from "./files";
import { parseHost } from "./hosts";
import type { MatchCandidate } from "./jobs/rank";
import { limitsFor, visibleOnPortfolio } from "./plan-rules";
import { getStore, type ExhbtRecord, type JobLink } from "./store";

/**
 * Per-job links (docs/phase-2.md section 8, decision 0008): what the matcher may pick from,
 * and everything the public page needs. The public page is always noindex, counts views
 * without cookies, and shows only published copies of exhbts the person's plan still shows.
 */

/** A picked exhbt as the job page shows it: its live copy and its address on the portfolio. */
export type JobLinkItem = { id: string; slug: string; doc: ExhbtDoc; reason: string };

export type LoadedJobLink = {
  link: JobLink;
  username: string;
  displayName: string;
  photoUrl: string | null;
  items: JobLinkItem[];
  /** Where portfolio links point: "" on alex.exhbt.co.uk, "/p/alex" in development and previews. */
  base: string;
};

/** The person's exhbts a job link may show: live, and within what their plan shows. */
export async function pickableExhbts(userId: string): Promise<ExhbtRecord[]> {
  const store = getStore();
  const [plan, exhbts] = await Promise.all([store.planFor(userId), store.listExhbts(userId)]);
  return visibleOnPortfolio(plan, exhbts);
}

/** What the matcher sees of an exhbt: the published copy only. */
export function toCandidate(e: ExhbtRecord): MatchCandidate {
  const d = e.published ?? e.doc;
  return { id: e.id, title: d.title, context: d.context, skills: d.skills, findings: d.findings.map(plain).filter(Boolean) };
}

async function basePath(username: string): Promise<string> {
  return parseHost((await headers()).get("host")).kind === "portfolio" ? "" : `/p/${username}`;
}

async function assemble(link: JobLink, username: string): Promise<LoadedJobLink | null> {
  const store = getStore();
  const visible = new Map((await pickableExhbts(link.userId)).map((e) => [e.id, e]));
  const items = link.picks.flatMap((p) => {
    const e = visible.get(p.exhbtId);
    return e?.published && e.slug ? [{ id: e.id, slug: e.slug, doc: e.published, reason: p.reason }] : [];
  });
  if (items.length === 0) return null;
  const profile = await store.getPortfolioProfile(link.userId);
  return {
    link,
    username,
    displayName: profile.name?.trim() || username,
    photoUrl: await signedFileUrl(profile.photoFileId),
    items,
    base: await basePath(username),
  };
}

/**
 * The public job page at <username>/<slug>, or null when there is none to show: no such
 * person or link, the link is off, their plan no longer includes job links, or none of its
 * exhbts is still live. Counts the view (a number only: no cookie, nothing about the visitor).
 */
export async function loadJobLink(username: string, slug: string): Promise<LoadedJobLink | null> {
  const store = getStore();
  const found = await store.lookupUsername(username);
  if (!found || "redirectTo" in found) return null;
  const link = await store.getJobLinkBySlug(found.userId, slug);
  if (!link || link.status !== "live") return null;
  if (!limitsFor(await store.planFor(found.userId)).jobLinks) return null;
  const loaded = await assemble(link, found.username);
  if (loaded) await store.incrementJobLinkViews(link.id);
  return loaded;
}

/** The owner's preview of one of their links, on or off. No view is counted. */
export async function loadJobLinkPreview(id: string, userId: string): Promise<LoadedJobLink | null> {
  const store = getStore();
  const link = await store.getJobLink(id);
  if (!link || link.userId !== userId) return null;
  const { username } = await store.getPortfolioProfile(userId);
  if (!username) return null;
  return assemble(link, username);
}
