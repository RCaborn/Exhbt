/**
 * How the figure eval marks an answer (evals/figure-pick/README.md). Pure: no browser, no API, so
 * `npm run eval:figures -- --self-test` can check the marking itself.
 *
 * A case passes when:
 *  - there is no figure in the report, and the pick says so (or no page was worth sending); or
 *  - the pick is on the right page, is the right kind, and the picture the app cuts (the pick's
 *    box with the app's own margin) holds at least 95% of the figure's true box and is no more
 *    than twice the size the app would cut from a perfect answer.
 * A request that failed is an error, never a pass and never "no figure".
 */
import type { FigureBox, FigureKind } from "../../lib/exhbt/blocks";
import { boxFromPixels, clampBox, pixelsFromBox, withMargin } from "../../lib/figures/rules";

/** The least of the true box the cut must hold, and the most the cut may be, against a perfect cut. */
export const CONTAIN_MIN = 0.95;
export const AREA_MAX = 2;

export type Expected = { page: number; kind: FigureKind; box: FigureBox };
export type EvalCase = {
  id: string;
  file: string;
  /** What the report is, and what the case is there to catch. */
  what: string;
  pages: number;
  /** The figure the pick should choose, with its true box in fractions of its page. Null when the report has none. */
  expect: Expected | null;
};

export type Answer =
  | { status: "picked"; page: number; kind: FigureKind; box: FigureBox }
  | { status: "none" }
  /** No page was worth sending, so nothing was asked. */
  | { status: "skipped" }
  | { status: "failed"; error: string };

export type Verdict = {
  result: "pass" | "fail" | "error";
  why: string[];
  /** The box the app cuts for this answer. */
  cut?: FigureBox;
  /** How much of the true box the cut holds, 0 to 1. */
  contains?: number;
  /** The cut's area over the area of a perfect cut (the true box with the app's margin). */
  areaRatio?: number;
};

const area = (b: FigureBox) => Math.max(0, b.w) * Math.max(0, b.h);
function overlap(a: FigureBox, b: FigureBox): number {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}
const round = (n: number) => Math.round(n * 1000) / 1000;

export function grade(c: EvalCase, a: Answer): Verdict {
  if (a.status === "failed") return { result: "error", why: [`the pick didn't run: ${a.error}`] };
  if (!c.expect) {
    if (a.status === "picked") return { result: "fail", why: [`picked a ${a.kind} on page ${a.page}; the report has no figure`] };
    return { result: "pass", why: [a.status === "skipped" ? "no page was worth sending, so the model wasn't asked" : "no figure, as expected"] };
  }
  if (a.status === "skipped") return { result: "fail", why: [`no page was sent; expected the ${c.expect.kind} on page ${c.expect.page}`] };
  if (a.status === "none") return { result: "fail", why: [`no figure; expected the ${c.expect.kind} on page ${c.expect.page}`] };

  // What the draft page cuts: the box with the app's margin (app/(app)/exhbts/new/figure.ts).
  const cut = withMargin(clampBox(a.box));
  const why: string[] = [];
  if (a.page !== c.expect.page) return { result: "fail", why: [`page ${a.page}; expected page ${c.expect.page}`], cut };
  if (a.kind !== c.expect.kind) why.push(`kind "${a.kind}"; expected "${c.expect.kind}"`);
  const contains = overlap(cut, c.expect.box) / area(c.expect.box);
  const areaRatio = area(cut) / area(withMargin(c.expect.box));
  if (contains < CONTAIN_MIN) why.push(`the cut holds ${Math.round(contains * 100)}% of the figure; at least ${CONTAIN_MIN * 100}% is needed`);
  if (areaRatio > AREA_MAX) why.push(`the cut is ${areaRatio.toFixed(2)} times a perfect cut; at most ${AREA_MAX} is allowed`);
  return { result: why.length ? "fail" : "pass", why: why.length ? why : ["right page, right kind, the whole figure and little else"], cut, contains: round(contains), areaRatio: round(areaRatio) };
}

/**
 * The marking, marked: for every case, a perfect answer must pass, and each kind of wrong answer
 * must not. Returns what went wrong; empty when the marking behaves.
 */
export function selfTest(cases: EvalCase[]): string[] {
  const problems: string[] = [];
  const want = (id: string, name: string, got: Verdict, result: Verdict["result"]) => {
    if (got.result !== result) problems.push(`${id}: ${name} marked ${got.result}, should be ${result} (${got.why.join("; ")})`);
  };
  const whole: FigureBox = { x: 0, y: 0, w: 1, h: 1 };
  // A box as the route would answer with it: given in pixels of an image, then through the server's own check.
  const image = { width: 1000, height: 1000 };
  const served = (b: FigureBox) => boxFromPixels(pixelsFromBox(b, image), image);
  for (const c of cases) {
    want(c.id, "a request that failed", grade(c, { status: "failed", error: "HTTP 502" }), "error");
    if (!c.expect) {
      want(c.id, "no figure", grade(c, { status: "none" }), "pass");
      want(c.id, "nothing sent", grade(c, { status: "skipped" }), "pass");
      want(c.id, "a pick", grade(c, { status: "picked", page: 1, kind: "other", box: whole }), "fail");
      continue;
    }
    const { page, kind } = c.expect;
    const box = served(c.expect.box);
    want(c.id, "the true box", grade(c, { status: "picked", page, kind, box }), "pass");
    want(c.id, "no figure", grade(c, { status: "none" }), "fail");
    want(c.id, "nothing sent", grade(c, { status: "skipped" }), "fail");
    want(c.id, "the wrong page", grade(c, { status: "picked", page: page === 1 ? 2 : page - 1, kind, box }), "fail");
    want(c.id, "the wrong kind", grade(c, { status: "picked", page, kind: kind === "other" ? "graph" : "other", box }), "fail");
    // Half the figure, cut down the middle: part of it is lost.
    want(c.id, "half the figure", grade(c, { status: "picked", page, kind, box: served({ ...c.expect.box, w: c.expect.box.w / 2 }) }), "fail");
    // The whole page: the figure with all the text round it. Only a figure that fills most of its page gets away with it.
    if (area(withMargin(c.expect.box)) < 1 / AREA_MAX) want(c.id, "the whole page", grade(c, { status: "picked", page, kind, box: whole }), "fail");
  }
  return problems;
}
