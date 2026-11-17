import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { getCurrentUser } from "@/lib/auth";
import { loadDraftSource } from "@/lib/draft-tools";
import { FigureBoxSchema, formatLimits, normaliseDoc } from "@/lib/exhbt/blocks";
import { formatOf } from "@/lib/exhbt/formats";
import { withKeyFigure } from "@/lib/exhbt/sections";
import { normaliseNumber, numbersIn } from "@/lib/exhbt/verify";
import { clampBox, fitAlt, fitCaption } from "@/lib/figures/rules";
import { isPhase2Enabled } from "@/lib/site";
import { getStore } from "@/lib/store";

/**
 * Puts the figure picked from the person's upload on the exhbt just drafted (decision 0017): an
 * image section straight after What I found (withKeyFigure), marked as picked, so publishing
 * waits for the person to tick that they may share it. The draft page calls this after
 * /api/exhbts/draft and /api/exhbts/figure-pick, and after uploading the cropped picture, and
 * only then opens the editor, so the editor's first save already has the figure.
 * Body: { fileId, alt, caption, picked: { from, sourceFileId?, page?, media?, box? } } → 204.
 */

const Body = z.object({
  fileId: z.string().max(64),
  alt: z.string().max(2_000),
  caption: z.string().max(1_000).default(""),
  picked: z.object({
    from: z.string().max(200),
    sourceFileId: z.string().max(64).optional(),
    page: z.number().int().min(1).max(10_000).optional(),
    media: z.string().max(200).optional(),
    box: FigureBoxSchema.optional(),
  }),
});

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isPhase2Enabled()) return fail("Not found", 404);
  const user = await getCurrentUser();
  if (!user) return fail("Sign in first.", 401);
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("That request wasn't complete.", 400);
  const { fileId, alt, caption, picked } = parsed.data;

  const store = getStore();
  const { id } = await params;
  const [exhbt, file] = await Promise.all([store.getExhbt(id), store.getFile(fileId)]);
  if (!exhbt || exhbt.userId !== user.id) return fail("Exhbt not found.", 404);
  if (!file || file.userId !== user.id || file.kind !== "image") return fail("Picture not found.", 404);
  if (picked.sourceFileId) {
    const source = await store.getFile(picked.sourceFileId);
    if (!source || source.userId !== user.id) return fail("Source file not found.", 404);
  }

  const doc = normaliseDoc(exhbt.doc);
  // The caption is cut to the layout's cap; withKeyFigure puts the picture where the layout wants its key picture.
  const shown = fitCaption(caption, formatLimits(formatOf(doc)).images.captionWords);
  const next = withKeyFigure(doc, {
    fileId,
    alt: fitAlt(alt),
    caption: shown,
    picked: {
      from: picked.from.trim() || "your file",
      ...(picked.sourceFileId ? { sourceFileId: picked.sourceFileId } : {}),
      ...(picked.page ? { page: picked.page } : {}),
      ...(picked.media ? { media: picked.media } : {}),
      ...(picked.box ? { box: clampBox(picked.box) } : {}),
      // Never ticked for them: publishing waits until they say they may share it.
      shareOk: false,
    },
  });
  // Both image slots used: nothing to add. The page deletes the picture it uploaded.
  if (next === doc) return fail("There's no room for another image on this exhbt.", 409);

  // The caption is the AI's words on the page, so its numbers get the draft's check
  // (lib/exhbt/verify.ts): any not in the person's material is flagged in the editor to confirm.
  const source = await loadDraftSource(user.id, id).catch(() => null);
  const known = new Set(numbersIn(source ?? "").map(normaliseNumber));
  const flagged = new Set((next.unverified ?? []).map((n) => normaliseNumber(n) ?? n));
  const unverified = [...(next.unverified ?? [])];
  for (const n of numbersIn(shown)) {
    const v = normaliseNumber(n);
    if (v === null || known.has(v) || flagged.has(v)) continue;
    flagged.add(v);
    unverified.push(n);
  }
  if (!(await store.saveExhbtDraft(id, user.id, { ...next, unverified }))) return fail("Exhbt not found.", 404);
  await store.attachFiles(user.id, id, [fileId]);
  await store.logEvent("figure_added", user.id, { exhbtId: id, from: picked.page ? "pdf" : "office" });
  return new NextResponse(null, { status: 204 });
}
