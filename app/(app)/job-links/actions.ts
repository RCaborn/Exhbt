"use server";

import { redirect } from "next/navigation";
import { matchJob } from "@/lib/ai/job-match";
import { getCurrentUser } from "@/lib/auth";
import { EXHBTS_PER_JOB_LINK } from "@/lib/entitlements";
import { slugify } from "@/lib/exhbt/slug";
import { clampIntro, COMPANY_MAX, DESCRIPTION_MAX, jobLinkSlug, randomSuffixes } from "@/lib/job-links";
import { canMakeJobLinks, getPlan, visibleOnPortfolio } from "@/lib/plan";
import { isPhase2Enabled } from "@/lib/site";
import { getStore, type JobLink } from "@/lib/store";

export type JobLinkFormState = { error?: string };

async function ownerLink(id: string): Promise<{ userId: string; link: JobLink } | null> {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/job-links");
  const link = await getStore().getJobLink(id);
  if (!link || link.userId !== user.id) return null;
  return { userId: user.id, link };
}

async function takenSlugs(userId: string, exceptId?: string): Promise<string[]> {
  const store = getStore();
  const [exhbts, links] = await Promise.all([store.listExhbts(userId), store.listJobLinks(userId)]);
  return [
    ...exhbts.flatMap((e) => (e.slug ? [e.slug] : [])),
    ...links.filter((l) => l.id !== exceptId).map((l) => l.slug),
  ];
}

export async function createJobLink(_prev: JobLinkFormState | undefined, formData: FormData): Promise<JobLinkFormState> {
  if (!isPhase2Enabled()) return { error: "Job links aren't available." };
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/job-links/new");

  const store = getStore();
  const plan = await getPlan(user.id);
  const live = (await store.listJobLinks(user.id)).filter((l) => l.status === "live").length;
  const allowed = canMakeJobLinks(plan, live);
  if (!allowed.ok) return { error: allowed.reason };

  const profile = await store.getPortfolioProfile(user.id);
  if (!profile.username) return { error: "Choose a username before you make a job link." };

  const company = String(formData.get("company") ?? "").trim();
  const role = String(formData.get("role") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const style = formData.get("slugStyle") === "clean" ? "clean" : "suffix";
  const stem = String(formData.get("slug") ?? "").trim();

  if (!company || company.length > COMPANY_MAX) return { error: "Enter the company name." };
  if (!role || role.length > COMPANY_MAX) return { error: "Enter the role." };
  if (!description) return { error: "Paste the job description." };
  if (description.length > DESCRIPTION_MAX) return { error: "That description is too long to store. Paste the part that describes the role." };

  const published = visibleOnPortfolio(plan, await store.listExhbts(user.id));
  if (published.length === 0) return { error: "Publish an exhbt before you make a job link." };

  const slug = jobLinkSlug(stem || company, style, await takenSlugs(user.id), randomSuffixes());
  let matched;
  try {
    matched = await matchJob({
      company,
      role,
      description,
      exhbts: published.map((e) => ({ id: e.id, doc: e.published! })),
    });
  } catch {
    return { error: "The match couldn't run. Nothing was saved. Try again." };
  }

  const intro = clampIntro(matched.intro);
  const id = crypto.randomUUID();
  try {
    await store.createJobLink({
      id,
      userId: user.id,
      company,
      roleTitle: role,
      slug,
      slugStyle: style,
      intro: intro.ok ? intro.intro : "",
      description,
      picks: matched.picks.slice(0, EXHBTS_PER_JOB_LINK),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (/duplicate|unique/i.test(message)) return { error: "That address is already used. Try again." };
    throw err;
  }
  if (matched.model) {
    await store.logAICall({
      userId: user.id,
      step: "link_ranking",
      model: matched.model,
      inputTokens: matched.inputTokens,
      outputTokens: matched.outputTokens,
      costUsd: matched.costUsd,
    });
  }
  await store.logEvent("job_link_created", user.id, { ranked: matched.ranked });
  redirect(`/job-links/${id}`);
}

export async function saveIntro(_prev: JobLinkFormState | undefined, formData: FormData): Promise<JobLinkFormState> {
  const owned = await ownerLink(String(formData.get("id") ?? ""));
  if (!owned) return { error: "That job link isn't on your account." };
  const intro = clampIntro(String(formData.get("intro") ?? ""));
  if (!intro.ok) return intro;
  await getStore().updateJobLink(owned.link.id, owned.userId, { intro: intro.intro });
  return {};
}

export async function saveSlug(_prev: JobLinkFormState | undefined, formData: FormData): Promise<JobLinkFormState> {
  const owned = await ownerLink(String(formData.get("id") ?? ""));
  if (!owned) return { error: "That job link isn't on your account." };
  const style = formData.get("slugStyle") === "clean" ? "clean" : "suffix";
  const slug = slugify(String(formData.get("slug") ?? ""));
  if (slug === "exhbt") return { error: "Use letters or numbers in the address." };
  const taken = new Set(await takenSlugs(owned.userId, owned.link.id));
  if (taken.has(slug)) return { error: "That address is already used on your portfolio." };
  await getStore().updateJobLink(owned.link.id, owned.userId, { slug, slugStyle: style });
  return {};
}

export async function movePick(formData: FormData) {
  const owned = await ownerLink(String(formData.get("id") ?? ""));
  if (!owned) return;
  const exhbtId = String(formData.get("exhbtId") ?? "");
  const dir = formData.get("dir") === "down" ? 1 : -1;
  const picks = owned.link.picks.map((p) => ({ ...p }));
  const i = picks.findIndex((p) => p.exhbtId === exhbtId);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= picks.length) return;
  const [row] = picks.splice(i, 1);
  picks.splice(j, 0, row!);
  await getStore().updateJobLink(owned.link.id, owned.userId, { picks });
}

export async function setJobLinkStatus(formData: FormData) {
  const owned = await ownerLink(String(formData.get("id") ?? ""));
  if (!owned) return;
  const status = formData.get("status") === "off" ? "off" : "live";
  if (status === "live" && owned.link.status !== "live") {
    const plan = await getPlan(owned.userId);
    const live = (await getStore().listJobLinks(owned.userId)).filter((l) => l.status === "live").length;
    const allowed = canMakeJobLinks(plan, live);
    if (!allowed.ok) redirect(`/job-links/${owned.link.id}?notice=${encodeURIComponent(allowed.reason)}`);
  }
  await getStore().updateJobLink(owned.link.id, owned.userId, { status });
  redirect(`/job-links/${owned.link.id}`);
}

export async function deleteJobLink(id: string) {
  const owned = await ownerLink(id);
  if (!owned) redirect("/job-links");
  await getStore().deleteJobLink(owned.link.id, owned.userId);
  redirect("/job-links");
}
