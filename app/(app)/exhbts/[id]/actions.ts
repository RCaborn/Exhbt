"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { unverifiedOf } from "@/components/editor/model";
import { getCurrentUser } from "@/lib/auth";
import { emptyDoc, ExhbtDocSchema, validateForPublish, type ExhbtDoc } from "@/lib/exhbt/blocks";
import { slugify, uniqueSlug } from "@/lib/exhbt/slug";
import { canCreateExhbt, canPublish, getPlan } from "@/lib/plan";
import { isPhase2Enabled } from "@/lib/site";
import { getStore } from "@/lib/store";

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
  await getStore().deleteExhbt(id, user.id);
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
  const slug = me.slug ?? uniqueSlug(slugify(doc.title), all.filter((e) => e.id !== id && e.slug).map((e) => e.slug!));
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
