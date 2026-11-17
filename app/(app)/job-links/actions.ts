"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { matchExhbtsToJob } from "@/lib/ai/job-match";
import { getCurrentUser } from "@/lib/auth";
import { EXHBTS_PER_JOB_LINK } from "@/lib/entitlements";
import { pickableExhbts, toCandidate } from "@/lib/job-links";
import { fetchListing, urlProblem, type ListingResult } from "@/lib/jobs/fetch-listing";
import { MAX_LISTING_CHARS, listingTextProblem } from "@/lib/jobs/listing-text";
import { INTRO_MAX_CHARS } from "@/lib/jobs/rank";
import { canMakeJobLinks, getPlan, limitsFor } from "@/lib/plan";
import { isPhase2Enabled } from "@/lib/site";
import { jobLinkSlug, takenSlugs, type SlugStyle } from "@/lib/slugs";
import { getStore, type JobLink, type JobLinkPick } from "@/lib/store";

/**
 * Everything that changes a job link, from /job-links, /job-links/new and the edit page.
 * Every rule is checked here, on the server: the pages only show them.
 */

async function signedIn(next = "/job-links") {
  if (!isPhase2Enabled()) notFound();
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  return user;
}

/** Their link, or the list page when it isn't theirs (or is gone). */
async function ownLink(id: string): Promise<{ userId: string; link: JobLink }> {
  const user = await signedIn(`/job-links/${id}`);
  const link = await getStore().getJobLink(id);
  if (!link || link.userId !== user.id) redirect("/job-links");
  return { userId: user.id, link };
}

/** Changes need a plan with job links. Turning a link off and deleting it never do. */
async function requireJobLinks(userId: string, back: string) {
  if (!limitsFor(await getPlan(userId)).jobLinks) redirect(`${back}?error=plan`);
}

function done(id: string, flag?: string): never {
  revalidatePath("/job-links");
  revalidatePath(`/job-links/${id}`);
  redirect(`/job-links/${id}${flag ? `?${flag}` : ""}`);
}

/** "Use a link": reads the advert so the person can check the text before matching. */
export async function readListing(url: string): Promise<ListingResult> {
  const user = await signedIn("/job-links/new");
  if (!limitsFor(await getPlan(user.id)).jobLinks) return { ok: false, reason: "Job links come with Max." };
  const problem = urlProblem(String(url ?? ""));
  if (problem) return { ok: false, reason: problem };
  return fetchListing(String(url), user.id);
}

export type CreateJobLinkInput = {
  company: string;
  roleTitle: string;
  description: string;
  listingUrl?: string | null;
  slugStyle: SlugStyle;
};
export type CreateJobLinkResult = { ok: true; id: string } | { ok: false; error: string; upgrade?: boolean };

const clean = (s: unknown, max: number) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, max);

/** Matches the description against their live exhbts and saves the link, switched on. */
export async function createJobLink(input: CreateJobLinkInput): Promise<CreateJobLinkResult> {
  const user = await signedIn("/job-links/new");
  const store = getStore();
  const company = clean(input.company, 120);
  const roleTitle = clean(input.roleTitle, 120);
  const description = String(input.description ?? "").trim().slice(0, MAX_LISTING_CHARS);
  const slugStyle: SlugStyle = input.slugStyle === "clean" ? "clean" : "suffix";
  const listingUrl = input.listingUrl && !urlProblem(input.listingUrl) ? input.listingUrl.trim().slice(0, 2000) : null;

  if (!company) return { ok: false, error: "Add the company's name." };
  if (!roleTitle) return { ok: false, error: "Add the role title." };
  if (listingTextProblem(description)) {
    return { ok: false, error: "Paste the whole job description: what the role involves and what they're looking for." };
  }

  const [plan, active] = await Promise.all([getPlan(user.id), store.countActiveJobLinks(user.id)]);
  const verdict = canMakeJobLinks(plan, active);
  if (!verdict.ok) return { ok: false, error: verdict.reason, upgrade: Boolean(verdict.upgradeTo) };

  const exhbts = await pickableExhbts(user.id);
  if (exhbts.length === 0) return { ok: false, error: "Publish an exhbt first. A job link shows your live exhbts." };

  let match;
  try {
    match = await matchExhbtsToJob({ company, roleTitle, description, candidates: exhbts.map(toCandidate) });
  } catch (e) {
    console.error("job match failed", (e as Error).message);
    return { ok: false, error: "We couldn't pick your exhbts just now. Try again in a moment." };
  }
  await store.logAICall({
    userId: user.id,
    step: "link_ranking",
    model: match.model,
    inputTokens: match.inputTokens,
    outputTokens: match.outputTokens,
    costUsd: match.costUsd,
  });

  const slug = jobLinkSlug(company, slugStyle, await takenSlugs(user.id));
  const id = await store.createJobLink({
    userId: user.id,
    company,
    roleTitle,
    slug,
    slugStyle,
    intro: match.intro.slice(0, INTRO_MAX_CHARS),
    picks: match.picks,
    listingText: description,
    listingUrl,
  });
  await store.logEvent("job_link_created", user.id, { slugStyle, picks: match.picks.length, fromUrl: Boolean(listingUrl) });
  revalidatePath("/job-links");
  return { ok: true, id };
}

/** Moves a pick one place up (-1) or down (1). */
export async function moveJobLinkPick(id: string, exhbtId: string, by: -1 | 1) {
  const { userId, link } = await ownLink(id);
  await requireJobLinks(userId, `/job-links/${id}`);
  const picks = [...link.picks];
  const i = picks.findIndex((p) => p.exhbtId === exhbtId);
  const j = i + by;
  if (i >= 0 && j >= 0 && j < picks.length) {
    [picks[i], picks[j]] = [picks[j]!, picks[i]!];
    await getStore().updateJobLink(id, userId, { picks });
  }
  done(id);
}

export async function removeJobLinkPick(id: string, exhbtId: string) {
  const { userId, link } = await ownLink(id);
  await requireJobLinks(userId, `/job-links/${id}`);
  await getStore().updateJobLink(id, userId, { picks: link.picks.filter((p) => p.exhbtId !== exhbtId) });
  done(id);
}

/** Puts another live exhbt in a pick's place (from a form: `to`), or adds one when `from` is empty. */
export async function swapJobLinkPick(id: string, from: string | null, formData: FormData) {
  const { userId, link } = await ownLink(id);
  await requireJobLinks(userId, `/job-links/${id}`);
  const to = String(formData.get("to") ?? "");
  const live = new Set((await pickableExhbts(userId)).map((e) => e.id));
  if (!live.has(to) || link.picks.some((p) => p.exhbtId === to)) done(id);
  const added: JobLinkPick = { exhbtId: to, reason: "" };
  let picks: JobLinkPick[];
  if (from) picks = link.picks.map((p) => (p.exhbtId === from ? added : p));
  else if (link.picks.length < EXHBTS_PER_JOB_LINK) picks = [...link.picks, added];
  else picks = link.picks;
  await getStore().updateJobLink(id, userId, { picks });
  done(id);
}

export async function saveJobLinkIntro(id: string, formData: FormData) {
  const { userId } = await ownLink(id);
  await requireJobLinks(userId, `/job-links/${id}`);
  const intro = String(formData.get("intro") ?? "").replace(/\s+/g, " ").trim();
  if (intro.length > INTRO_MAX_CHARS) done(id, "error=intro");
  await getStore().updateJobLink(id, userId, { intro });
  done(id, "saved=intro");
}

/** A new address in the other style: clean (`lloyds`) or suffixed (`lloyds-x7k2`). The old one stops working. */
export async function setJobLinkSlugStyle(id: string, style: SlugStyle) {
  const { userId, link } = await ownLink(id);
  await requireJobLinks(userId, `/job-links/${id}`);
  const slugStyle: SlugStyle = style === "clean" ? "clean" : "suffix";
  if (slugStyle !== link.slugStyle) {
    const slug = jobLinkSlug(link.company, slugStyle, await takenSlugs(userId, { exceptJobLinkId: id }));
    await getStore().updateJobLink(id, userId, { slug, slugStyle });
  }
  done(id, "saved=address");
}

export async function setJobLinkStatus(id: string, status: "live" | "off") {
  const { userId, link } = await ownLink(id);
  const store = getStore();
  if (status === "live" && link.status !== "live") {
    const verdict = canMakeJobLinks(await getPlan(userId), await store.countActiveJobLinks(userId));
    if (!verdict.ok) done(id, verdict.upgradeTo ? "error=plan" : "error=limit");
  }
  await store.updateJobLink(id, userId, { status: status === "live" ? "live" : "off" });
  done(id);
}

export async function deleteJobLink(id: string) {
  const user = await signedIn("/job-links");
  await getStore().deleteJobLink(id, user.id);
  revalidatePath("/job-links");
  redirect("/job-links");
}
