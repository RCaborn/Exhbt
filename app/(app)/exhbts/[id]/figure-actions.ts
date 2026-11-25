"use server";

import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { loadAiVersion, loadDraftSource } from "@/lib/draft-tools";
import { emptyDoc, type ExhbtDoc } from "@/lib/exhbt/blocks";
import type { Chart } from "@/lib/exhbt/charts";
import { normaliseNumber, numbersInDoc, unverifiedNumbers } from "@/lib/exhbt/verify";
import { isPhase2Enabled } from "@/lib/site";
import { getStore } from "@/lib/store";

/*
 * The chart the draft drew, back on the exhbt (decisions 0025 and 0026, "The key visual"). When a
 * figure from the person's work took its place, the figure route kept the drafted graphs with the AI
 * version (ai-version.json), never in the doc. Putting one back goes through here, so its numbers are
 * checked against the source again and a parked graph can't escape the number check. Read-only: the
 * kept graphs stay where they are, so Undo, and pressing it again, are safe.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The drafted graph at `index`, with the numbers on it that are not in the person's source text. The owner only. */
export async function draftedGraph(id: string, index: number): Promise<{ ok: true; chart: Chart; flags: string[] } | { ok: false; error: string }> {
  if (!isPhase2Enabled()) notFound();
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/exhbts/${id}/edit`)}`);
  const gone = { ok: false as const, error: "The drafted chart isn't kept any more, so it can't be put back." };
  if (typeof id !== "string" || !UUID.test(id) || !Number.isInteger(index) || index < 0) return gone;
  const record = await getStore().getExhbt(id);
  if (!record || record.userId !== user.id) return { ok: false, error: "This exhbt isn't yours to edit." };

  const chart = (await loadAiVersion(user.id, id)).graphs?.[index];
  if (!chart) return gone;
  // The graph on its own, so only its numbers are looked at.
  const only: ExhbtDoc = { ...emptyDoc(), flow: [], sections: [{ id: "graph-1", kind: "graph", chart }] };
  const source = await loadDraftSource(user.id, id).catch(() => null);
  // With the source gone (expired, or deleted) nothing can be found in it: every number is flagged to check.
  const flags = source !== null ? unverifiedNumbers(only, source) : everyNumber(only);
  return { ok: true, chart, flags };
}

/** Every number in a doc, as written, once each by value. */
function everyNumber(doc: ExhbtDoc): string[] {
  const seen = new Set<string>();
  return numbersInDoc(doc).filter((n) => {
    const v = normaliseNumber(n);
    if (v === null || seen.has(v)) return false;
    seen.add(v);
    return true;
  });
}
