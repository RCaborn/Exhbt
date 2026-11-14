import "server-only";
import { headers } from "next/headers";
import type { ExhbtDoc } from "./exhbt/blocks";
import { signedFileUrl } from "./files";
import { parseHost, portfolioHost } from "./hosts";
import { themeFor, type PortfolioTheme } from "./portfolio-themes";
import { visibleOnPortfolio } from "./plan-rules";
import { getStore, type ExhbtRecord, type PortfolioProfile } from "./store";

/**
 * Everything a public portfolio page needs, loaded the same way for the at-a-glance page and
 * a single project. Only published, plan-visible exhbts are ever returned, and always their
 * published copy, never the working draft.
 */

export type PortfolioItem = { id: string; slug: string; doc: ExhbtDoc; publishedAt: string | null };

export type LoadedPortfolio =
  | { status: "ok"; profile: PortfolioProfile & { username: string }; displayName: string; photoUrl: string | null; items: PortfolioItem[]; base: string; theme: PortfolioTheme }
  | { status: "redirect"; to: string }
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
  const items = visibleOnPortfolio(plan, await store.listExhbts(found.userId));
  // Free has no public page (decision 0006); nor does a paid account with nothing live yet.
  if (items.length === 0) return { status: "missing" };

  const profile = await store.getPortfolioProfile(found.userId);
  return {
    status: "ok",
    profile: { ...profile, username: found.username },
    displayName: profile.name?.trim() || found.username,
    photoUrl: await signedFileUrl(profile.photoFileId),
    items: items.map(toItem),
    base: await basePath(found.username),
    // The chosen look if the plan still has it; the stored choice is never cleared here.
    theme: themeFor(profile, plan),
  };
}

const toItem = (e: ExhbtRecord): PortfolioItem => ({ id: e.id, slug: e.slug!, doc: e.published!, publishedAt: e.publishedAt });

/** Signed URLs for one exhbt's images and its evidence file (links pass through). */
export async function mediaFor(doc: ExhbtDoc): Promise<{ imageUrls: Record<string, string | null>; evidenceUrl: string | null }> {
  const imageUrls: Record<string, string | null> = {};
  for (const im of doc.images) imageUrls[im.fileId] = await signedFileUrl(im.fileId);
  const ev = doc.evidence;
  const evidenceUrl = !ev ? null : ev.kind === "link" ? ev.href : await signedFileUrl(ev.fileId);
  return { imageUrls, evidenceUrl };
}

/** "12 Nov 2026", for the date beside the checks. */
export const checkedOnLabel = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : undefined;
