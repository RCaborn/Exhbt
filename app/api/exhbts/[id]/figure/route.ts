import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { getCurrentUser } from "@/lib/auth";
import { loadAiVersion, loadDraftSource, saveAiVersion } from "@/lib/draft-tools";
import { FIGURE_KINDS, FigureBoxSchema, formatLimits, normaliseDoc, type Section } from "@/lib/exhbt/blocks";
import { formatOf } from "@/lib/exhbt/formats";
import { withWorkVisual } from "@/lib/exhbt/sections";
import { normaliseNumber, numbersIn } from "@/lib/exhbt/verify";
import { clampBox, fitAlt, fitCaption } from "@/lib/figures/rules";
import { isPhase2Enabled } from "@/lib/site";
import { getStore } from "@/lib/store";

/**
 * Puts the visual picked from the person's upload on the exhbt just drafted (decisions 0017 and
 * 0025): an image section where the layout wants its key figure, marked as picked, so publishing
 * waits for the person to tick that they may share it. The draft page calls this after
 * /api/exhbts/draft and /api/exhbts/figure-pick, and after uploading the cropped picture, and
 * only then opens the editor, so the editor's first save already has the figure.
 *
 * This is where the work's own graph takes the place of the one the draft drew (withWorkVisual):
 * the draft and the pick run side by side, so neither knows the other's answer until here. A
 * picked graph, chart or results table removes the drafted graph sections; another visual keeps
 * them while the layout has room. A layout that takes nothing from the work gets nothing.
 *
 * Body: { fileId, alt, caption, kind?, replaces?, picked: { from, sourceFileId?, page?, media?, box? } } → 204.
 * `kind` is "graph", "table" or "other". Without one it is "other": nothing is removed.
 *
 * Safe to call at any time (release 2 review, figure-1):
 *  - Drafted graphs are removed only while the exhbt is still the fresh draft: nothing is picked yet
 *    and every graph on it is one the draft drew (the AI version keeps them, `drafted`). On an edited
 *    exhbt the figure is placed beside what is there and nothing is removed.
 *  - An exhbt never ends with two picked figures. When one is there already the answer is 409, unless
 *    the request says `replaces: true`, which takes the old picked figure off and puts the new one on.
 *  - The same picture sent twice is left alone (204).
 */

const Body = z.object({
  fileId: z.string().max(64),
  alt: z.string().max(2_000),
  caption: z.string().max(1_000).default(""),
  kind: z.enum(FIGURE_KINDS).default("other"),
  /** True when the new figure takes the place of the one already picked from the work. */
  replaces: z.boolean().default(false),
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
  const { fileId, alt, caption, kind, picked, replaces } = parsed.data;

  const store = getStore();
  const { id } = await params;
  const [exhbt, file] = await Promise.all([store.getExhbt(id), store.getFile(fileId)]);
  if (!exhbt || exhbt.userId !== user.id) return fail("Exhbt not found.", 404);
  if (!file || file.userId !== user.id || file.kind !== "image") return fail("Picture not found.", 404);
  if (picked.sourceFileId) {
    const source = await store.getFile(picked.sourceFileId);
    if (!source || source.userId !== user.id) return fail("Source file not found.", 404);
  }

  let doc = normaliseDoc(exhbt.doc);
  const isPicked = (s: Section) => s.kind === "image" && !!s.picked;
  // Sent twice: it is on the exhbt already, and nothing changes.
  if (doc.sections.some((s) => s.kind === "image" && s.fileId === fileId)) return new NextResponse(null, { status: 204 });
  if (doc.sections.some(isPicked)) {
    if (!replaces) return fail("This exhbt already has a figure from your work.", 409);
    doc = { ...doc, sections: doc.sections.filter((s) => !isPicked(s)) };
  }
  // Fresh draft: no figure picked yet (just made sure) and every graph is one the draft drew. Otherwise any graph may be the person's.
  const ai = await loadAiVersion(user.id, id).catch(() => null);
  const drewIt = (c: unknown) => (ai?.drafted ?? []).some((d) => JSON.stringify(d) === JSON.stringify(c));
  const fresh = !replaces && doc.sections.every((s) => s.kind !== "graph" || drewIt(s.chart));
  // The caption is cut to the layout's cap; withWorkVisual applies the rule and puts the picture where the layout wants it.
  const shown = fitCaption(caption, formatLimits(formatOf(doc)).images.captionWords);
  const result = withWorkVisual(doc, {
    fileId,
    kind,
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
  }, { keepGraphs: !fresh });
  if (result.why === "already") return new NextResponse(null, { status: 204 });
  // The layout takes nothing from the work, or its images are full. The page deletes the picture it uploaded.
  if (result.why === "not-wanted") return fail("This layout doesn't take a figure from your files.", 409);
  if (!result.placed) return fail("There's no room for another image on this exhbt.", 409);
  const next = result.doc;

  // The caption is the AI's words on the page, so its numbers get the draft's check
  // (lib/exhbt/verify.ts): any not in the person's material is flagged in the editor to confirm.
  const source = await loadDraftSource(user.id, id).catch(() => null);
  const known = new Set(numbersIn(source ?? "").map(normaliseNumber));
  const flagged = new Set((next.unverified ?? []).map((n) => normaliseNumber(n) ?? n));
  const unverified = [...(next.unverified ?? [])];
  // The alt text too: the model writes numbers into it that it read off the picture (decision 0025).
  for (const n of [...numbersIn(shown), ...numbersIn(fitAlt(alt))]) {
    const v = normaliseNumber(n);
    if (v === null || known.has(v) || flagged.has(v)) continue;
    flagged.add(v);
    unverified.push(n);
  }
  if (!(await store.saveExhbtDraft(id, user.id, { ...next, unverified }))) return fail("Exhbt not found.", 404);
  // The graphs the figure took the place of are kept with the AI version, beside what is there, so the
  // editor can offer them back (decision 0026). Nothing reads them yet. A failure here loses nothing on the page.
  if (result.removed.length) {
    try {
      const latest = await loadAiVersion(user.id, id);
      await saveAiVersion(user.id, id, { ...latest, graphs: [...(latest.graphs ?? []), ...result.removed.map((s) => s.chart)] });
    } catch (e) {
      console.error("ai version graphs save failed", (e as Error).message);
    }
  }
  await store.attachFiles(user.id, id, [fileId]);
  await store.logEvent("figure_added", user.id, { exhbtId: id, from: picked.page ? "pdf" : "office", kind, graphsRemoved: result.removed.length });
  return new NextResponse(null, { status: 204 });
}
