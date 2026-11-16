import { NextResponse } from "next/server";
import { pickFigure, type PageImage } from "@/lib/ai/figure-pick";
import { mediaTypeOf } from "@/lib/ai/transcribe";
import { getCurrentUser } from "@/lib/auth";
import { DRAFT_WINDOW_HOURS } from "@/lib/drafting";
import { FIGURE } from "@/lib/figures/rules";
import { getPlan, limitsFor } from "@/lib/plan";
import { isPhase2Enabled } from "@/lib/site";
import { getStore } from "@/lib/store";

/**
 * Picks the figure for an exhbt being drafted (decision 0017). The draft page sends it, beside
 * /api/exhbts/draft, small JPEGs of the pages of the person's PDF that draw something besides
 * text, as multipart form data: a `label` ("report.pdf, page 3") and an `image` for each. The
 * images go to the model and are dropped here; only the pick comes back:
 * { pick: { image, box, alt, caption } | null }, `image` counting from 1 in the order sent.
 *
 * Part of the draft, so it uses none of the person's drafts or rewrites. One pick per draft: a
 * person can ask for as many as their plan has drafts in the window, plus a couple for drafts
 * that fail and are tried again.
 */

/** Picks allowed in the drafts window beyond the plan's drafts, for drafts that failed and were tried again. */
const SPARE_PICKS = 2;

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

export async function POST(req: Request) {
  if (!isPhase2Enabled()) return fail("Not found", 404);
  const user = await getCurrentUser();
  if (!user) return fail("Sign in first.", 401);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return fail("That request wasn't complete.", 400);
  }
  const labels = form.getAll("label").map((l) => String(l).slice(0, 120));
  const files = form.getAll("image").filter((f): f is File => f instanceof File);
  if (!files.length || files.length > FIGURE.maxImages || labels.length !== files.length) return fail("Send between 1 and 30 page images.", 400);
  if (files.some((f) => f.size === 0 || f.size > FIGURE.maxImageBytes)) return fail("A page image is empty or too big.", 413);

  const images: PageImage[] = [];
  for (const [i, f] of files.entries()) {
    const data = new Uint8Array(await f.arrayBuffer());
    const mediaType = mediaTypeOf(data);
    if (mediaType !== "image/jpeg" && mediaType !== "image/png") return fail("Page images must be JPEG or PNG.", 415);
    images.push({ label: labels[i]!, data, mediaType });
  }

  const store = getStore();
  const e = limitsFor(await getPlan(user.id));
  if (!e.drafting) return fail("AI drafting isn't part of your plan.", 403);
  const used = await store.countRecentEventsForUser("figure_picked", user.id, DRAFT_WINDOW_HOURS);
  if (used >= e.draftsPer30Days + SPARE_PICKS) return fail("No more figure picks until a draft frees up.", 429);
  // Counted before the call, so failed attempts count too.
  await store.logEvent("figure_picked", user.id, { pages: images.length });

  let result;
  try {
    result = await pickFigure(images);
  } catch (err) {
    console.error("figure pick failed", (err as Error).message);
    return fail("We couldn't pick a figure just now.", 502);
  }
  // Its own step, so picking figures is costed apart from drafting. ai_call_logs only accepts
  // 'figure_pick' once supabase/migrations/20261124000000_figure_pick.sql is applied; until then
  // the log fails and is reported, and the person still gets their figure.
  try {
    await store.logAICall({
      userId: user.id,
      step: "figure_pick",
      model: result.model,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      costUsd: result.costUsd,
    });
  } catch (err) {
    console.error("figure pick log failed", (err as Error).message);
  }
  return NextResponse.json({ pick: result.pick });
}
