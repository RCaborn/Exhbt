import { NextResponse } from "next/server";
import { pickFigure, type PageImage } from "@/lib/ai/figure-pick";
import { mediaTypeOf } from "@/lib/ai/transcribe";
import { getCurrentUser } from "@/lib/auth";
import { DRAFT_WINDOW_HOURS } from "@/lib/drafting";
import { imageSize } from "@/lib/figures/image-size";
import { FIGURE } from "@/lib/figures/rules";
import { getPlan, limitsFor } from "@/lib/plan";
import { isPhase2Enabled } from "@/lib/site";
import { getStore } from "@/lib/store";

/**
 * Picks the figure for an exhbt being drafted (decisions 0017 and 0025). The draft page sends it,
 * beside /api/exhbts/draft, small JPEGs of the pages of the person's PDF that draw something
 * besides text, as multipart form data: a `label` ("report.pdf, page 3") and an `image` for each.
 * The images go to the model and are dropped here; only the pick comes back:
 * { pick: { image, kind, box, alt, caption } | null }, `image` counting from 1 in the order sent,
 * `kind` "graph", "table" or "other", `box` in fractions of the image.
 *
 * Part of the draft, so it uses none of the person's drafts or rewrites. One pick per draft: a
 * person can ask for as many as their plan has drafts in the window, plus a couple for drafts
 * that fail and are tried again. A pick is counted only when the AI call succeeded.
 *
 * Outside production the answer also carries `debug`: the model that answered, its token counts
 * and its answer before the checks, which the figure eval reads (evals/figure-pick/README.md).
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
  if (files.reduce((n, f) => n + f.size, 0) > FIGURE.maxTotalBytes) return fail("The page images are too big together.", 413);

  const images: PageImage[] = [];
  for (const [i, f] of files.entries()) {
    const data = new Uint8Array(await f.arrayBuffer());
    const mediaType = mediaTypeOf(data);
    if (mediaType !== "image/jpeg" && mediaType !== "image/png") return fail("Page images must be JPEG or PNG.", 415);
    // The model gives its box in pixels of the image, so the size is read here, from the file itself.
    const size = imageSize(data);
    if (!size) return fail("A page image couldn't be read.", 415);
    images.push({ label: labels[i]!, data, mediaType, ...size });
  }

  const store = getStore();
  const e = limitsFor(await getPlan(user.id));
  if (!e.drafting) return fail("AI drafting isn't part of your plan.", 403);
  const used = await store.countRecentEventsForUser("figure_picked", user.id, DRAFT_WINDOW_HOURS);
  if (used >= e.draftsPer30Days + SPARE_PICKS) return fail("No more figure picks until a draft frees up.", 429);

  let result;
  try {
    result = await pickFigure(images);
  } catch (err) {
    console.error("figure pick failed", (err as Error).message);
    // Outside production the reason is on the answer too, so the eval can say why a real call failed (never shown to people).
    return fail(process.env.NODE_ENV === "production" ? "We couldn't pick a figure just now." : `We couldn't pick a figure just now. (${(err as Error).message.slice(0, 300)})`, 502);
  }
  // Counted once the AI answered, so a pick that failed doesn't spend the person's allowance.
  await store.logEvent("figure_picked", user.id, { pages: images.length });
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
  const debug =
    process.env.NODE_ENV === "production"
      ? {}
      : {
          debug: {
            model: result.model,
            inputTokens: result.inputTokens,
            outputTokens: result.outputTokens,
            costUsd: result.costUsd,
            raw: result.raw,
            sizes: images.map((im) => ({ width: im.width, height: im.height })),
            // What the model was told each image was: "File 1, page 3", never the file's name.
            labels: images.map((im) => im.label),
          },
        };
  return NextResponse.json({ pick: result.pick, ...debug });
}
