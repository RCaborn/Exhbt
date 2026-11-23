import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import type { EvalPick, Outline } from "../../app/dev/figure-eval/FigureEval";
import { AI_MODEL } from "../../lib/ai/model";
import type { FigureBox } from "../../lib/exhbt/blocks";
import { grade, gradeOffice, type Answer, type EvalCase, type OfficeAnswer, type OfficeCase, type Verdict } from "./grade";

/**
 * The figure eval, run in a real browser against the app in development
 * (evals/figure-pick/README.md). Started by scripts/eval-figures.ts, which sets:
 *
 *   FIGURE_EVAL_MODE     real    one call to the real model per report, marked by grade.ts
 *                        mock    the same path with the app's stand-in: checks the plumbing only
 *                        truth   no calls: draws each report's true box, to check the answer key
 *                        redraw  no calls: redraws the cuts in a results file (FIGURE_EVAL_LINES)
 *   FIGURE_EVAL_RUN_DIR  where results.jsonl and the pictures go
 *   FIGURE_EVAL_ONLY     case ids or their number prefixes, comma-separated (optional)
 *
 * Every step is the app's own: /dev/figure-eval calls the draft page's page drawing, its choice
 * of which pages to send, /api/exhbts/figure-pick and the cut.
 */

const ROOT = process.cwd();
const FIXTURES = join(ROOT, "evals/figure-pick/fixtures");
const MODE = (process.env.FIGURE_EVAL_MODE ?? "mock") as "real" | "mock" | "truth" | "redraw";
const RUN_DIR = process.env.FIGURE_EVAL_RUN_DIR ?? join(ROOT, "evals/figure-pick/runs/manual");
const ONLY = (process.env.FIGURE_EVAL_ONLY ?? "").split(",").map((s) => s.trim()).filter(Boolean);

const all = JSON.parse(readFileSync(join(FIXTURES, "cases.json"), "utf8")) as EvalCase[];
const cases = ONLY.length ? all.filter((c) => ONLY.some((o) => c.id === o || c.id.startsWith(`${o}-`))) : all;
const pdfOf = (c: { file: string }) => readFileSync(join(FIXTURES, c.file)).toString("base64");
// The Word, PowerPoint and picture cases (fixtures/cases-office.json, build-office.mjs).
const allOffice = JSON.parse(readFileSync(join(FIXTURES, "cases-office.json"), "utf8")) as OfficeCase[];
const officeCases = ONLY.length ? allOffice.filter((c) => ONLY.some((o) => c.id === o || c.id.startsWith(`${o}-`))) : allOffice;
const MIME: Record<string, string> = { docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg" };
const filesOf = (c: OfficeCase) => c.files.map((name) => ({ name, type: MIME[name.split(".").pop()!.toLowerCase()] ?? "application/octet-stream", base64: readFileSync(join(FIXTURES, name)).toString("base64") }));

mkdirSync(RUN_DIR, { recursive: true });
const record = (file: string, line: unknown) => appendFileSync(join(RUN_DIR, file), `${JSON.stringify(line)}\n`);
function savePicture(name: string, dataUrl: string): string {
  const [head, b64] = dataUrl.split(",");
  const file = `${name}.${head?.includes("image/jpeg") ? "jpg" : "png"}`;
  writeFileSync(join(RUN_DIR, file), Buffer.from(b64 ?? "", "base64"));
  return file;
}

async function open(page: Page, signIn: string | null) {
  // Signed in as a new person for each report, so the pick's allowance for one person never runs out part-way.
  await page.goto(signIn ? `/auth/dev?email=${encodeURIComponent(signIn)}&next=/dev/figure-eval` : "/dev/figure-eval");
  await expect(page.locator("[data-ready=true]")).toBeAttached();
}
const draw = (page: Page, c: { file: string }, pageNo: number, box: FigureBox | null, outlines: Outline[] = []) =>
  page.evaluate(([b64, name, n, b, o]) => window.figureEval!.draw(b64, name, n, b, o), [pdfOf(c), c.file, pageNo, box, outlines] as const);

type Debug = { model?: string; inputTokens?: number; outputTokens?: number; costUsd?: number; raw?: { box?: unknown } | null; sizes?: { width: number; height: number }[] };

if (MODE === "real" || MODE === "mock") {
  const stamp = Date.now().toString(36);
  for (const c of cases) {
    test(`${c.id}: ${c.what}`, async ({ page }) => {
      await open(page, `figure-eval-${c.id}-${stamp}@example.com`);
      const run: EvalPick = await page.evaluate(([b64, name]) => window.figureEval!.pick(b64, name), [pdfOf(c), c.file] as const);
      const debug = (run.debug ?? {}) as Debug;

      const answer: Answer =
        run.status === "picked" && run.pick && run.page
          ? { status: "picked", page: run.page, kind: run.pick.kind, box: run.pick.box }
          : run.status === "failed" || run.status === "picked"
            ? { status: "failed", error: `${run.http === null ? "no response" : `HTTP ${run.http}`}: ${run.error ?? "the answer was incomplete"}` }
            : { status: run.status };
      let verdict: Verdict = grade(c, answer);
      // The model that answered must be the one asked for. The stand-in must never be marked as the model, nor the model as the stand-in.
      const asked = run.status === "picked" || run.status === "none";
      const wanted = MODE === "real" ? AI_MODEL : "mock";
      if (asked && !(debug.model ?? "").startsWith(wanted)) verdict = { ...verdict, result: "error", why: [`answered by "${debug.model ?? "unknown"}"; this run is for "${wanted}"`] };

      // The picture the draft page would upload, and the page it came from with the true box (jade) and the cut (red) drawn on it.
      const pictures: string[] = [];
      if (run.crop) pictures.push(savePicture(`${c.id}-cut`, run.crop));
      if (run.status === "picked" && run.page && run.cut) {
        const outlines: Outline[] = [{ box: run.cut, token: "error" }];
        if (c.expect && c.expect.page === run.page) outlines.unshift({ box: c.expect.box, token: "jade" });
        pictures.push(savePicture(`${c.id}-page-${run.page}`, await draw(page, c, run.page, null, outlines)));
      }

      const image = run.sent.find((s) => s.page === run.page)?.image;
      record("results.jsonl", {
        eval: "figure-pick",
        case: c.id,
        file: c.file,
        mode: MODE,
        model: debug.model ?? null,
        result: verdict.result,
        why: verdict.why,
        expected: c.expect,
        pages: run.pageCount,
        sent: run.sent.map((s) => s.page),
        http: run.http,
        status: run.status,
        page: run.page ?? null,
        kind: run.pick?.kind ?? null,
        box: run.pick?.box ?? null,
        rawBox: debug.raw?.box ?? null,
        imageSize: (image && debug.sizes?.[image - 1]) || null,
        cut: run.cut ?? null,
        contains: verdict.contains ?? null,
        areaRatio: verdict.areaRatio ?? null,
        alt: run.pick?.alt ?? null,
        caption: run.pick?.caption ?? null,
        error: run.error ?? null,
        tokensIn: debug.inputTokens ?? null,
        tokensOut: debug.outputTokens ?? null,
        costUsd: debug.costUsd ?? null,
        ms: run.ms,
        pictures,
      });

      // A real run fails on anything but a pass. The stand-in doesn't look at the pages, so only a broken path fails it.
      if (MODE === "real") expect(verdict.result, verdict.why.join("; ")).toBe("pass");
      else expect(verdict.result, verdict.why.join("; ")).not.toBe("error");
    });
  }
}

if (MODE === "real" || MODE === "mock") {
  const stamp = Date.now().toString(36);
  for (const c of officeCases) {
    test(`${c.id}: ${c.what}`, async ({ page }) => {
      await open(page, `figure-eval-${c.id}-${stamp}@example.com`);
      const run = await page.evaluate((files) => window.figureEval!.pickFiles(files), filesOf(c));
      const debug = (run.debug ?? {}) as Debug;
      const answer: OfficeAnswer =
        run.status === "picked" && run.pick && run.picture
          ? { status: "picked", picture: run.picture, kind: run.pick.kind, box: run.pick.box }
          : run.status === "failed" || run.status === "picked"
            ? { status: "failed", error: `${run.http === null ? "no response" : `HTTP ${run.http}`}: ${run.error ?? "the answer was incomplete"}` }
            : { status: run.status };
      let verdict: Verdict = gradeOffice(c, answer, run.nativeChart);
      const asked = run.status === "picked" || run.status === "none";
      const wanted = MODE === "real" ? AI_MODEL : "mock";
      if (asked && !(debug.model ?? "").startsWith(wanted)) verdict = { ...verdict, result: "error", why: [`answered by "${debug.model ?? "unknown"}"; this run is for "${wanted}"`] };
      const pictures: string[] = [];
      if (run.crop) pictures.push(savePicture(`${c.id}-cut`, run.crop));
      record("results.jsonl", {
        eval: "figure-pick",
        case: c.id,
        files: c.files,
        mode: MODE,
        model: debug.model ?? null,
        result: verdict.result,
        why: verdict.why,
        expected: c.expect,
        sent: run.sent.map((s) => `${s.label} = ${s.picture}`),
        http: run.http,
        status: run.status,
        picture: run.picture ?? null,
        kind: run.pick?.kind ?? null,
        box: run.pick?.box ?? null,
        rawBox: debug.raw?.box ?? null,
        cut: run.cut ?? null,
        contains: verdict.contains ?? null,
        areaRatio: verdict.areaRatio ?? null,
        nativeChart: run.nativeChart,
        alt: run.pick?.alt ?? null,
        caption: run.pick?.caption ?? null,
        error: run.error ?? null,
        tokensIn: debug.inputTokens ?? null,
        tokensOut: debug.outputTokens ?? null,
        costUsd: debug.costUsd ?? null,
        ms: run.ms,
        pictures,
      });
      if (MODE === "real") expect(verdict.result, verdict.why.join("; ")).toBe("pass");
      else expect(verdict.result, verdict.why.join("; ")).not.toBe("error");
    });
  }
}

if (MODE === "truth") {
  for (const c of cases) {
    test(`${c.id}: the answer key`, async ({ page }) => {
      await open(page, null);
      const drawn = await page.evaluate(([b64, name]) => window.figureEval!.pages(b64, name), [pdfOf(c), c.file] as const);
      expect(drawn, "the PDF's pages couldn't be drawn").not.toBeNull();
      expect(drawn!.pageCount).toBe(c.pages);
      const pictures: string[] = [];
      if (c.expect) {
        pictures.push(savePicture(`${c.id}-truth-page-${c.expect.page}`, await draw(page, c, c.expect.page, null, [{ box: c.expect.box, token: "jade" }])));
        pictures.push(savePicture(`${c.id}-truth-box`, await draw(page, c, c.expect.page, c.expect.box)));
        // The figure's page must be one that is sent, or the case can't be passed.
        expect(drawn!.pages.find((p) => p.page === c.expect!.page)?.sent, `page ${c.expect.page} would not be sent`).toBe(true);
      }
      record("truth.jsonl", { eval: "figure-pick-truth", case: c.id, expected: c.expect, pages: drawn!.pages.map((p) => ({ page: p.page, shapes: p.shapes, pictures: p.pictures, bytes: p.bytes, sent: p.sent })), pictures });
    });
  }
}

if (MODE === "redraw") {
  type Line = { case: string; file: string; page: number | null; cut: FigureBox | null; expected: { page: number; box: FigureBox } | null };
  const lines = JSON.parse(readFileSync(process.env.FIGURE_EVAL_LINES ?? "", "utf8")) as Line[];
  test("redraw the cuts from a results file", async ({ page }) => {
    await open(page, null);
    for (const line of lines) {
      const known = all.find((c) => c.id === line.case);
      if (!known || !line.page || !line.cut) continue;
      savePicture(`${line.case}-cut`, await draw(page, known, line.page, line.cut));
      const outlines: Outline[] = [{ box: line.cut, token: "error" }];
      if (line.expected && line.expected.page === line.page) outlines.unshift({ box: line.expected.box, token: "jade" });
      savePicture(`${line.case}-page-${line.page}`, await draw(page, known, line.page, null, outlines));
      record("redrawn.jsonl", { case: line.case, page: line.page, cut: line.cut });
    }
  });
}
