import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { draftExhbt, materialText, MAX_MATERIAL_CHARS } from "@/lib/ai/exhbt-draft";
import { isAdmin } from "@/lib/admin";
import { getCurrentUser } from "@/lib/auth";
import { editorKind } from "@/lib/editor-kind-server";
import { saveAiVersion, saveDraftSource } from "@/lib/draft-tools";
import { draftVerdict } from "@/lib/drafting";
import { aiVersionOf } from "@/lib/exhbt/draft-blocks";
import { safeHref } from "@/lib/exhbt/blocks";
import { formatOf } from "@/lib/exhbt/formats";
import { misquoted, normaliseNumber, unverifiedNumbers } from "@/lib/exhbt/verify";
import { isPhase2Enabled } from "@/lib/site";
import { getStore } from "@/lib/store";
import { recordAIFailure, tooManyFailures, TOO_MANY_FAILURES } from "@/lib/ai-failures";
import { canDraftInto } from "@/lib/team";

/**
 * Drafts an exhbt from the person's material and saves it as a new draft exhbt
 * (docs/phase-2.md section 6). Signed in, Phase 2 on. Order: plan checks (drafts left, room for
 * another exhbt), the AI draft, the number check, then save and attach the uploaded files.
 * Body: { text, notes?, link?, fileIds?, signals? } → { id, unverified, format, formatReason }. `signals` are counts from the
 * upload (picture files, PDF pages, pages with pictures), so the AI can choose a layout; never the pages.
 * `formatReason` is why that layout: one of a fixed set of signals, said once in the editor (lib/exhbt/drafted.ts).
 * Which layouts it may choose follows the person's editor (lib/editor-kind-server.ts): seven in the new one, three in the classic one.
 */

const Body = z.object({
  text: z.string().max(MAX_MATERIAL_CHARS * 2).default(""),
  notes: z.string().max(5_000).optional(),
  link: z.string().max(500).optional(),
  fileIds: z.array(z.string().max(64)).max(20).optional(),
  /** Draft into this exhbt instead of a new one: a teammate's own, still empty, exhbt (decision 0013). */
  into: z.string().max(64).optional(),
  signals: z.object({ imageFiles: z.number().int().min(0).max(50), pdfPages: z.number().int().min(0).max(5000), pdfPicturePages: z.number().int().min(0).max(5000) }).optional(),
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
  const { into } = parsed.data;
  const target = into ? await store.getExhbt(into) : null;
  if (into && !canDraftInto(target, user.id)) return fail("That exhbt can't be drafted into. Open it and edit it instead.", 409);
  const verdict = await draftVerdict(user.id, undefined, into);
  if (!verdict.ok) return fail(verdict.reason, verdict.status, { upgradeTo: verdict.upgradeTo ?? null });

  if (await tooManyFailures("exhbt_draft", { userId: user.id })) return fail(TOO_MANY_FAILURES, 429);
  // The draft chooses among the layouts this person's editor offers, decided as the edit page decides it: all seven
  // in the new editor, the three of decision 0024 in the classic one, which can't edit what the other four add.
  const layouts = (await editorKind(await isAdmin(user))) === "page" ? "seven" : "three";
  let result;
  try {
    result = await draftExhbt({ text, notes, link, signals: parsed.data.signals, layouts });
  } catch (e) {
    // Recorded with its reason and tokens; it doesn't use up a draft.
    await recordAIFailure("exhbt_draft", { userId: user.id }, e);
    return fail("We couldn't draft your exhbt just now. Your files are saved and it didn't use up a draft: try again in a moment.", 502);
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
  const fromText = unverifiedNumbers(result.doc, source);
  const badQuotes = misquoted(result.numbers, source);
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
  const id = target ? target.id : await store.createExhbt(user.id, doc);
  if (target) await store.saveExhbtDraft(id, user.id, doc);
  await store.logEvent("exhbt_drafted", user.id, { exhbtId: id, model: result.model, unverified: unverified.length, files: fileIds.length });

  // The draft limit race: two requests can both pass the check above while the AI works. Now
  // this draft is saved and counted, check again and, if it went over (drafts or exhbts), take
  // it back. Fail closed: when two race at the limit, both are refused and the person tries
  // again. Files are attached only after this, so a refusal leaves their uploads for the retry.
  const after = await draftVerdict(user.id, id, into);
  if (!after.ok) {
    // Drafting into an existing exhbt puts back what it held; a new one is taken back.
    if (target) await store.saveExhbtDraft(id, user.id, target.doc);
    else await store.deleteExhbt(id, user.id);
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

  return NextResponse.json({ id, unverified, format: formatOf(doc), formatReason: result.formatReason });
}
