import fs from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { demoExhbts } from "../lib/exhbt";
import { ORDER_FIXTURES, SAMPLE_FIXTURES } from "./fixtures/order-docs";

/*
 * The parity gate (decision 0027): release 2 may not change any existing page. For each fixture,
 * the exhbt page is compared with a golden copy written before any product code changed:
 *  - the outerHTML of article[data-exhbt-page] at 1440 by 900, normalised in five ways and no
 *    others (file addresses to the file's id; file ids to their order of first appearance; ids
 *    React makes to their order of first appearance; the words of each class attribute sorted; the
 *    "Checked by exhbt" date to DATE), equal as strings;
 *  - the box of every element in the article, relative to the article, rounded to the half pixel,
 *    at 1440 by 900 and at 412 by 915, each within half a pixel.
 *
 * Every fixture is seeded through POST /dev/parity (file ids made from the slug and the section id,
 * a fixed publish date), so a second run, or a run on another day, draws the same page. The /demo
 * pages are compared as they are.
 *
 * GOLDEN=write writes the golden copies instead of comparing. PARITY_DOCS=<dir> also reads every
 * *.json doc in that directory and keeps their golden copies in <dir>/golden (the main session's
 * live-page comparison; those files never enter the repo). This file, /dev/parity and the fixtures
 * must run unchanged on main's live commit, so they import nothing the release adds.
 *
 * The agent who changes the renderer runs this and may not edit it or the golden copies.
 *
 * The box check is local only: on CI (the CI variable set) the boxes are not compared, because the golden
 * boxes were drawn in the sandbox's Chromium and CI's draws text a fraction differently, so on CI only the
 * normalised markup is compared. A CSS-only change that moves a box and changes no markup passes CI. Run this
 * spec locally, in the same Chromium, before merging anything that touches the page's CSS.
 */

const WRITE = process.env.GOLDEN === "write";
const GOLDEN = path.join(__dirname, "golden");
const USERNAME = "parity";

type Box = [tag: string, x: number, y: number, w: number, h: number];
type Boxes = { "1440": Box[]; "412": Box[] };
type Target = { name: string; dir: string; seed?: unknown; url?: string };

const targets: Target[] = [
  ...[...SAMPLE_FIXTURES, ...ORDER_FIXTURES].map((f) => ({ name: f.name, dir: GOLDEN, seed: f.doc })),
  ...demoExhbts.map((e) => ({ name: `demo-${e.slug}`, dir: GOLDEN, url: `/demo/${e.slug}` })),
];
if (process.env.PARITY_DOCS) {
  const dir = path.resolve(process.env.PARITY_DOCS);
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort()) {
    const base = file.slice(0, -".json".length).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    targets.push({ name: `live-${base}`.slice(0, 80).replace(/-+$/, ""), dir: path.join(dir, "golden"), seed: JSON.parse(fs.readFileSync(path.join(dir, file), "utf8")) });
  }
}

/** Fonts in, every picture loaded or failed, the page hydrated and idle. */
async function settle(page: Page) {
  await expect(page.locator("article[data-exhbt-page]")).toBeVisible();
  await page.waitForLoadState("networkidle");
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      [...document.images].map((img) =>
        img.complete ? null : new Promise((done) => (img.addEventListener("load", done, { once: true }), img.addEventListener("error", done, { once: true }))),
      ),
    );
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  });
}

const FILE_ADDRESS = /\/dev\/files\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Each distinct match of `re` in `s`, in order of first appearance, replaced by `name(n)`. */
function byOrder(s: string, re: RegExp, name: (n: number) => string): string {
  const seen: string[] = [];
  for (const m of s.matchAll(re)) if (!seen.includes(m[0])) seen.push(m[0]);
  return seen.reduce((out, v, i) => out.replace(new RegExp(escape(v), "g"), name(i + 1)), s);
}

/** The five normalisations of decision 0027, in order, and no others. */
function normalise(html: string): string {
  // 1. A file's address in src or href becomes the file's id.
  const ids: string[] = [];
  let out = html.replace(/(\s(?:src|href)=")([^"]*)"/g, (m, pre: string, value: string) => {
    const id = value.match(FILE_ADDRESS)?.[1];
    if (!id) return m;
    if (!ids.includes(id)) ids.push(id);
    return `${pre}${id}"`;
  });
  // 2. File ids become their order of first appearance in the page.
  const ordered = ids.map((id) => ({ id, at: out.indexOf(id) })).sort((a, b) => a.at - b.at);
  ordered.forEach(({ id }, i) => (out = out.replace(new RegExp(escape(id), "g"), `file-${i + 1}`)));
  // 3. Ids React makes (useId: «r1», :r1: or _r_1_, by version) become their order of first appearance.
  out = byOrder(out, /«[^»"\s]+»|(?<=["\s]):[rR][0-9a-zA-Z]*:(?=["\s])|(?<=["\s])_[rR]_[0-9a-zA-Z]+_(?=["\s])/g, (n) => `useid-${n}`);
  // 4. The words of each class attribute, sorted.
  out = out.replace(/(\sclass=")([^"]*)"/g, (_m, pre: string, value: string) => `${pre}${value.split(/\s+/).filter(Boolean).sort().join(" ")}"`);
  // 5. The date the checks ran becomes DATE.
  out = out.replace(/(Checked by exhbt, (?:<!-- -->)?)([^<]*)/g, "$1DATE");
  return out;
}

async function capture(page: Page, url: string): Promise<{ html: string; boxes: Boxes }> {
  const boxes = {} as Boxes;
  let html = "";
  for (const [w, h] of [
    [1440, 900],
    [412, 915],
  ] as const) {
    await page.setViewportSize({ width: w, height: h });
    await page.goto(url);
    await settle(page);
    const article = page.locator("article[data-exhbt-page]");
    if (w === 1440) html = normalise(await article.evaluate((el) => el.outerHTML));
    boxes[String(w) as "1440" | "412"] = await article.evaluate((root) => {
      const r0 = root.getBoundingClientRect();
      const half = (v: number) => Math.round(v * 2) / 2;
      return [root, ...root.querySelectorAll("*")].map((el): [string, number, number, number, number] => {
        const r = el.getBoundingClientRect();
        // An element that draws no box (display: none, say) has its rect at the viewport's origin, not in the layout, so
        // relative to the article it moves whenever anything above the article changes height (the site header did, by 8px,
        // in pull request 38). It is kept as a zero box at no position: its tag still counts, its place does not.
        if (r.width === 0 && r.height === 0) return [el.tagName.toLowerCase(), 0, 0, 0, 0];
        return [el.tagName.toLowerCase(), half(r.x - r0.x), half(r.y - r0.y), half(r.width), half(r.height)];
      });
    });
  }
  return { html, boxes };
}

/** One box per line, so a difference reads as a line in a diff. */
const boxesJson = (b: Boxes) => `{\n${(["1440", "412"] as const).map((w) => `  "${w}": [\n${b[w].map((x) => `    ${JSON.stringify(x)}`).join(",\n")}\n  ]`).join(",\n")}\n}\n`;

function compareBoxes(name: string, want: Boxes, got: Boxes) {
  for (const w of ["1440", "412"] as const) {
    expect(got[w].length, `${name} at ${w}: the number of elements`).toBe(want[w].length);
    const off: string[] = [];
    want[w].forEach((b, i) => {
      const g = got[w][i]!;
      if (g[0] !== b[0] || b.slice(1).some((v, k) => Math.abs((v as number) - (g[k + 1] as number)) > 0.5)) off.push(`#${i} ${JSON.stringify(b)} is now ${JSON.stringify(g)}`);
    });
    expect(off.slice(0, 12), `${name} at ${w}: ${off.length} boxes moved`).toEqual([]);
  }
}

test.describe("The parity gate", () => {
  for (const t of targets) {
    test(t.name, async ({ page, request }) => {
      test.setTimeout(180_000);
      let url = t.url!;
      if (t.seed !== undefined) {
        const res = await request.post("/dev/parity", { data: { username: USERNAME, slug: t.name, doc: t.seed } });
        expect(res.status(), await res.text()).toBe(200);
        url = ((await res.json()) as { url: string }).url;
      }
      const got = await capture(page, url);
      const htmlFile = path.join(t.dir, `${t.name}.html`);
      const boxesFile = path.join(t.dir, `${t.name}.boxes.json`);
      if (WRITE) {
        fs.mkdirSync(t.dir, { recursive: true });
        fs.writeFileSync(htmlFile, `${got.html}\n`);
        fs.writeFileSync(boxesFile, boxesJson(got.boxes));
        return;
      }
      expect(fs.existsSync(htmlFile) && fs.existsSync(boxesFile), `No golden copy for ${t.name}. Write them on the base commit with GOLDEN=write.`).toBe(true);
      expect(got.html, `${t.name}: the page's markup`).toBe(fs.readFileSync(htmlFile, "utf8").replace(/\n$/, ""));
      // The golden boxes were drawn in the sandbox's Chromium; CI's draws text a fraction differently, so there only the markup is compared.
      if (process.env.CI) {
        const why = "Boxes not compared on CI: the golden boxes are compared only in the environment that wrote them.";
        test.info().annotations.push({ type: "boxes", description: why });
        console.log(`${t.name}: ${why}`);
        return;
      }
      compareBoxes(t.name, JSON.parse(fs.readFileSync(boxesFile, "utf8")) as Boxes, got.boxes);
    });
  }
});
