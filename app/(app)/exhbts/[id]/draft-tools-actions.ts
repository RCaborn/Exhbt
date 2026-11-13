"use server";

import { notFound, redirect } from "next/navigation";
import { MAX_NOTE_CHARS, rewriteBlock as aiRewrite } from "@/lib/ai/exhbt-rewrite";
import { getCurrentUser } from "@/lib/auth";
import { loadAiVersion, loadDraftSource, saveAiVersion } from "@/lib/draft-tools";
import { ExhbtDocSchema } from "@/lib/exhbt/blocks";
import { blockValue, flagsForBlock, isDraftBlock, replaceBlock, type BlockValue } from "@/lib/exhbt/draft-blocks";
import { rewriteAllowance } from "@/lib/rewriting";
import { isPhase2Enabled } from "@/lib/site";
import { getStore } from "@/lib/store";

/** "Rewrite this block" (docs/phase-2.md section 6). Every rule is checked here; the card only shows it. */

export type RewriteResult =
  | { ok: true; value: BlockValue; flags: string[]; left: number }
  | { ok: false; error: string; atLimit?: boolean; left?: number };

const squash = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();

export async function rewriteBlockAction(id: string, block: string, note: string, rawDoc: unknown): Promise<RewriteResult> {
  if (!isPhase2Enabled()) notFound();
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/exhbts/${id}/edit`)}`);
  if (!isDraftBlock(block)) return { ok: false, error: "That part can't be rewritten." };
  const store = getStore();
  const record = await store.getExhbt(id);
  if (!record || record.userId !== user.id) return { ok: false, error: "This exhbt isn't yours to edit." };
  if (JSON.stringify(rawDoc ?? null).length > 60_000) return { ok: false, error: "This couldn't be read. Reload the page and try again." };
  const parsed = ExhbtDocSchema.safeParse(rawDoc);
  if (!parsed.success) return { ok: false, error: "This couldn't be read. Reload the page and try again." };
  const doc = parsed.data;

  const allowance = await rewriteAllowance(user.id, id);
  if (allowance.left === 0) return { ok: false, error: allowance.reason!, atLimit: true, left: 0 };

  const source = await loadDraftSource(user.id, id);
  if (!source) return { ok: false, error: "There are no files to rewrite from. This exhbt wasn't drafted from your files, or they have expired." };

  let result;
  try {
    result = await aiRewrite({ block, source, doc, note: note.slice(0, MAX_NOTE_CHARS), attempt: allowance.used + 1 });
  } catch (e) {
    console.error("exhbt rewrite failed", (e as Error).message);
    return { ok: false, error: "We couldn't rewrite that just now. Nothing was changed and it didn't use up a rewrite. Try again in a moment.", left: allowance.left };
  }
  await store.logAICall({
    userId: user.id,
    step: "exhbt_rewrite",
    model: result.model,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
    costUsd: result.costUsd,
  });
  await store.logEvent("exhbt_rewritten", user.id, { exhbtId: id, block, model: result.model });

  // Numbers the material doesn't contain, including any whose quoted source isn't really there.
  const flat = squash(source);
  const badQuotes = result.numbers.filter((n) => n.sourceQuote.trim() && !flat.includes(squash(n.sourceQuote))).map((n) => n.value.trim());
  const next = replaceBlock(doc, block, result.value as never, []);
  const flags = flagsForBlock(next, block, source, badQuotes);

  // The latest AI version of this block, for "Back to the AI version".
  const ai = await loadAiVersion(user.id, id);
  (ai.blocks as Record<string, unknown>)[block] = blockValue(next, block);
  ai.unverified[block] = flags;
  await saveAiVersion(user.id, id, ai).catch((e) => console.error("ai version save failed", (e as Error).message));

  return { ok: true, value: result.value, flags, left: allowance.left - 1 };
}
