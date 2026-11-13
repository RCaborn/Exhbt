import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { draftExhbt, materialText, MAX_MATERIAL_CHARS } from "@/lib/ai/exhbt-draft";
import { getCurrentUser } from "@/lib/auth";
import { saveAiVersion, saveDraftSource } from "@/lib/draft-tools";
import { draftVerdict } from "@/lib/drafting";
import { aiVersionOf } from "@/lib/exhbt/draft-blocks";
import { safeHref } from "@/lib/exhbt/blocks";
import { normaliseNumber, unverifiedNumbers } from "@/lib/exhbt/verify";
import { isPhase2Enabled } from "@/lib/site";
import { getStore } from "@/lib/store";

/**
 * Drafts an exhbt from the person's material and saves it as a new draft exhbt
 * (docs/phase-2.md section 6). Signed in, Phase 2 on. Order: plan checks (drafts left, room for
 * another exhbt), the AI draft, the number check, then save and attach the uploaded files.
 * Body: { text, notes?, link?, fileIds? } → { id, unverified }.
 */

const Body = z.object({
  text: z.string().max(MAX_MATERIAL_CHARS * 2).default(""),
  notes: z.string().max(5_000).optional(),
  link: z.string().max(500).optional(),
  fileIds: z.array(z.string().max(64)).max(20).optional(),
});

/** Too little to draft from: the AI would have nothing true to say. */
const MIN_WORDS = 20;

const fail = (error: string, status: number, extra: Record<string, unknown> = {}) => NextResponse.json({ error, ...extra }, { status });

export async function POST(req: Request) {
  if (!isPhase2Enabled()) return fail("Not found", 404);
  const user = await getCurrentUser();
  if (!user) return fail("Sign in to draft an exhbt.", 401);

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("That request wasn't complete. Try again.", 400);
  const { text, notes, fileIds = [] } = parsed.data;
  const link = parsed.data.link?.trim() ? (safeHref(parsed.data.link.trim()) ?? undefined) : undefined;
  if (parsed.data.link?.trim() && !link) return fail("Use a full https:// link, or leave the link out.", 400);

  const source = materialText({ text, notes, link });
  if (source.split(/\s+/).filter(Boolean).length < MIN_WORDS) {
    return fail("Add a file or a few sentences of notes first, so there's something to draft from.", 400);
  }

  const store = getStore();
  const verdict = await draftVerdict(user.id);
  if (!verdict.ok) return fail(verdict.reason, verdict.status, { upgradeTo: verdict.upgradeTo ?? null });

  let result;
  try {
    result = await draftExhbt({ text, notes, link });
  } catch (e) {
    console.error("exhbt draft failed", (e as Error).message);
    return fail("We couldn't draft your exhbt just now. Your files are saved: try again in a moment.", 502);
  }
  await store.logAICall({
    userId: user.id,
    step: "exhbt_draft",
    model: result.model,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
    costUsd: result.costUsd,
  });

  // Flag numbers missing from the material, and any the model listed with a quote that isn't there.
  const squash = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();
  const flat = squash(source);
  const fromText = unverifiedNumbers(result.doc, source);
  const badQuotes = result.numbers.filter((n) => n.sourceQuote.trim() && !flat.includes(squash(n.sourceQuote))).map((n) => n.value.trim());
  const seen = new Set<string>();
  const unverified = [...fromText, ...badQuotes].filter((v) => {
    const key = normaliseNumber(v) ?? v;
    if (!v || seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const doc = {
    ...result.doc,
    ...(link ? { evidence: { kind: "link" as const, href: link, label: "See the work" } } : {}),
    unverified,
  };
  const id = await store.createExhbt(user.id, doc);
  await store.logEvent("exhbt_drafted", user.id, { exhbtId: id, model: result.model, unverified: unverified.length, files: fileIds.length });

  // The draft limit race: two requests can both pass the check above while the AI works. Now
  // this draft is saved and counted, check again and, if it went over (drafts or exhbts), take
  // it back. Fail closed: when two race at the limit, both are refused and the person tries
  // again. Files are attached only after this, so a refusal leaves their uploads for the retry.
  const after = await draftVerdict(user.id, id);
  if (!after.ok) {
    await store.deleteExhbt(id, user.id);
    return fail(after.reason, after.status, { upgradeTo: after.upgradeTo ?? null });
  }
  if (fileIds.length) await store.attachFiles(user.id, id, fileIds);

  // Keep the source text and the AI's version with the exhbt, for "Rewrite" and "Back to the AI version".
  // Only now, after the limit re-check, so a refused draft leaves nothing behind. The draft is
  // already saved, so a failure here costs only those two helpers.
  try {
    await saveDraftSource(user.id, id, source);
    await saveAiVersion(user.id, id, aiVersionOf(result.doc, source, badQuotes));
  } catch (e) {
    console.error("draft source save failed", (e as Error).message);
  }

  return NextResponse.json({ id, unverified });
}
