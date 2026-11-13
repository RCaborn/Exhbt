"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { unverifiedOf } from "@/components/editor/model";
import { canView } from "@/lib/access";
import { getCurrentUser } from "@/lib/auth";
import { emptyDoc, ExhbtDocSchema, LIMITS, text, validateForPublish, type ExhbtDoc } from "@/lib/exhbt/blocks";
import { slugify, uniqueSlug } from "@/lib/exhbt/slug";
import { canCreateExhbt, canPublish, getPlan } from "@/lib/plan";
import { takenSlugs } from "@/lib/slugs";
import { isPhase2Enabled } from "@/lib/site";
import { getStore } from "@/lib/store";
import { deleteExhbtWithFiles } from "@/lib/uploads";

/**
 * Everything that changes an exhbt from the list (/exhbts) and the editor (/exhbts/[id]/edit).
 * Every rule is checked here, on the server: the page only shows them.
 */

async function signedIn() {
  if (!isPhase2Enabled()) notFound();
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/exhbts");
  return user;
}

/** The doc as sent by the page, checked for shape. Keeps the list of numbers still to check. */
function readDoc(raw: unknown): ExhbtDoc | null {
  if (JSON.stringify(raw ?? null).length > 60_000) return null;
  const parsed = ExhbtDocSchema.safeParse(raw);
  if (!parsed.success) return null;
  const unverified = (raw as { unverified?: unknown }).unverified;
  return Array.isArray(unverified) && unverified.every((u) => typeof u === "string")
    ? ({ ...parsed.data, unverified: unverified.slice(0, 50) } as ExhbtDoc)
    : parsed.data;
}

/** "Start from scratch" on the list: an empty exhbt, if the plan has room. */
export async function createFromScratch() {
  const user = await signedIn();
  const store = getStore();
  const verdict = canCreateExhbt(await getPlan(user.id), await store.listExhbts(user.id));
  if (!verdict.ok) redirect("/exhbts?full=1");
  const id = await store.createExhbt(user.id, emptyDoc());
  // Two quick clicks can both pass the check above; look again now this one exists (as drafting does).
  const after = canCreateExhbt(await getPlan(user.id), (await store.listExhbts(user.id)).filter((e) => e.id !== id));
  if (!after.ok) {
    await store.deleteExhbt(id, user.id);
    redirect("/exhbts?full=1");
  }
  redirect(`/exhbts/${id}/edit`);
}

/** Skill boxes from a roadmap idea's gaps: a few words each, no repeats, no more than the limit. */
function skillsFromGaps(gaps: string[]): string[] {
  const out: string[] = [];
  for (const g of gaps) {
    const s = g.trim().split(/\s+/).slice(0, LIMITS.skills.wordsEach).join(" ").slice(0, LIMITS.skills.charsEach).trim();
    if (s && !out.some((k) => k.toLowerCase() === s.toLowerCase())) out.push(s);
    if (out.length >= LIMITS.skills.max) break;
  }
  return out;
}

/**
 * "Build this as an exhbt" on a roadmap's Projects view: an exhbt prefilled from the idea
 * (title, the brief as the question, the gaps as skills, three empty process boxes), if the
 * plan has room. Reads the idea from the store, never from the page.
 */
export async function createFromIdea(roadmapId: string, ideaId: string) {
  if (!isPhase2Enabled()) notFound();
  const back = `/roadmap/${roadmapId}?view=projects`;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(back)}`);
  const store = getStore();
  const record = await store.getRoadmap(roadmapId);
  if (!record || !(await canView(record, user))) notFound();
  const idea = (await store.listProjectIdeas(roadmapId)).find((i) => i.id === ideaId);
  if (!idea) redirect(back);
  // Refused: the Projects page shows the reason and a link to billing.
  if (!canCreateExhbt(await getPlan(user.id), await store.listExhbts(user.id)).ok) redirect(back);
  const doc: ExhbtDoc = {
    ...emptyDoc(),
    title: idea.title.slice(0, LIMITS.titleChars),
    context: "Project from my Exhbt roadmap",
    skills: skillsFromGaps(idea.closesGaps),
    gap: text(idea.brief),
  };
  const id = await store.createExhbt(user.id, doc);
  redirect(`/exhbts/${id}/edit`);
}

/** Moves an exhbt one place up (-1) or down (1) in the portfolio order. */
export async function moveExhbt(id: string, by: -1 | 1) {
  const user = await signedIn();
  const store = getStore();
  const ids = (await store.listExhbts(user.id)).map((e) => e.id);
  const i = ids.indexOf(id);
  const j = i + by;
  if (i < 0 || j < 0 || j >= ids.length) return;
  [ids[i], ids[j]] = [ids[j]!, ids[i]!];
  await store.reorderExhbts(user.id, ids);
  revalidatePath("/exhbts");
}

export async function deleteExhbt(id: string) {
  const user = await signedIn();
  // Its files too, records and stored objects (lib/uploads.ts).
  await deleteExhbtWithFiles(user.id, id);
  revalidatePath("/exhbts");
  redirect("/exhbts");
}

export type SaveResult = { ok: true; savedAt: string } | { ok: false; error: string };

/** Autosave. Never blocked by the limits: drafts can run over. */
export async function saveDraft(id: string, raw: unknown): Promise<SaveResult> {
  const user = await signedIn();
  const doc = readDoc(raw);
  if (!doc) return { ok: false, error: "This couldn't be saved. Reload the page and try again." };
  const ok = await getStore().saveExhbtDraft(id, user.id, doc);
  return ok ? { ok: true, savedAt: new Date().toISOString() } : { ok: false, error: "This exhbt isn't yours to edit." };
}

export type PublishResult = { ok: true; slug: string } | { ok: false; reasons: string[] };

/**
 * Saves the latest edits, then puts them live if everything passes: the limits, the plan,
 * the person's confirmation, no numbers left to check, and a username to publish under.
 */
export async function publishExhbt(id: string, raw: unknown, confirmed: boolean): Promise<PublishResult> {
  const user = await signedIn();
  const store = getStore();
  const doc = readDoc(raw);
  if (!doc) return { ok: false, reasons: ["This couldn't be saved. Reload the page and try again."] };
  if (!(await store.saveExhbtDraft(id, user.id, doc))) return { ok: false, reasons: ["This exhbt isn't yours to publish."] };

  const [plan, all, profile] = await Promise.all([getPlan(user.id), store.listExhbts(user.id), store.getPortfolioProfile(user.id)]);
  const reasons: string[] = [];
  const issues = validateForPublish(doc);
  if (issues.length) reasons.push(issues.length === 1 ? `Fix one thing first: ${issues[0]!.message}` : `Fix ${issues.length} things first; each is shown beside its part.`);
  const verdict = canPublish(plan, all, id);
  if (!verdict.ok) reasons.push(verdict.reason);
  const left = unverifiedOf(doc).length;
  if (left) reasons.push(`Check ${left === 1 ? "the flagged number" : `the ${left} flagged numbers`} at the top, or take them out.`);
  if (!confirmed) reasons.push("Tick the box to confirm this is your work and the numbers are true.");
  if (!profile.username) reasons.push("Choose your username first, at Account, Portfolio.");
  if (reasons.length) return { ok: false, reasons };

  const me = all.find((e) => e.id === id)!;
  // One slug space per person: a new exhbt slug also misses their job links (lib/slugs.ts).
  const slug = me.slug ?? uniqueSlug(slugify(doc.title), await takenSlugs(user.id, { exceptExhbtId: id }));
  if (!(await store.publishExhbt(id, user.id, slug))) return { ok: false, reasons: ["This exhbt isn't yours to publish."] };
  revalidatePath("/exhbts");
  revalidatePath(`/exhbts/${id}/edit`);
  revalidatePath(`/p/${profile.username}`, "layout");
  return { ok: true, slug };
}

export async function unpublishExhbt(id: string) {
  const user = await signedIn();
  const store = getStore();
  await store.unpublishExhbt(id, user.id);
  const { username } = await store.getPortfolioProfile(user.id);
  revalidatePath("/exhbts");
  if (username) revalidatePath(`/p/${username}`, "layout");
  redirect(`/exhbts/${id}/edit`);
}
