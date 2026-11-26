import fs from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { ALL_THEMES, PORTFOLIO_THEMES } from "../lib/portfolio-themes";
import { BASE_LOOKS, BUILDER_LOOK_CARDS, LOOK_IDS, PORTFOLIO_PAGES, type PortfolioFixture } from "./fixtures/portfolio-pages";

/*
 * The portfolio parity gate (decision 0031, "Visitors' pages stay as they are"; brief A of
 * docs/briefs/portfolio-first): no release of the portfolio-first build may change a page visitors
 * see. Each target is compared with a golden copy in e2e/golden/portfolio/, written on main's code
 * (b7a3bee; phase-2-pf0 at 9ddeb28 is that and the plan's documents) before anyone touched PortfolioHome.tsx:
 *  - the outerHTML of the target's root ([data-portfolio-home] unless the target says otherwise) at
 *    1440 by 900, normalised in the five ways of e2e/layout-parity.spec.ts and no others (file
 *    addresses to the file's id; file ids to their order of first appearance; ids React makes to
 *    their order of first appearance; the words of each class attribute sorted; the "Checked by exhbt"
 *    date to DATE), equal as strings;
 *  - the box of every element in the root, relative to the root, rounded to the half pixel, at 1440
 *    by 900 and at 412 by 915, each within half a pixel.
 *
 * One change to the exhbt gate's method, in the box check only: an element that draws no box (a
 * <style>, anything under display: none) is recorded as its tag alone. The exhbt gate records it at
 * minus the root's offset in the window, so a change above the root (a site header, the owner's note,
 * the demo's bar) moves it; here those boxes depend on nothing outside the root. Every element that
 * draws a box is checked exactly as before.
 *
 * The targets: every portfolio in e2e/fixtures/portfolio-pages.ts, each seeded through
 * POST /dev/portfolio-parity with fixed ids and a fixed publish date, so a second run, or a run on
 * another day, draws the same page; and, as they are, /demo, /what-is-an-exhbt, the home page's look
 * pictures (one target per look) and the step builder's look cards (/portfolio?step=look, signed in).
 *
 * GOLDEN=write writes the golden copies instead of comparing; with -g <name> it writes that target's
 * alone. This file, /dev/portfolio-parity and the fixtures must run unchanged on main's commit, so they
 * import nothing the portfolio-first releases add.
 *
 * Whoever changes PortfolioHome.tsx (or anything it draws) runs this and may not edit it, the fixtures or
 * the golden copies. The one exception is the clean-up (brief L): it deletes the builder-look-cards target
 * with the step builder and writes owner-preview again after rewording the owner's note.
 *
 * The box check is local only, as in the exhbt gate: on CI (the CI variable set) only the markup is
 * compared, because the golden boxes were drawn in the agents' sandbox and CI's Chromium draws text a
 * fraction differently. The golden copies were written with Playwright 1.63's headless Chromium
 * (/opt/pw-browsers/chromium_headless_shell-1243, PW_CHROMIUM_PATH unset). A CSS-only change that moves
 * a box and changes no markup passes CI: run this spec in the sandbox before merging anything that
 * touches the portfolio's CSS.
 */

const WRITE = process.env.GOLDEN === "write";
const GOLDEN = path.join(__dirname, "golden", "portfolio");
const HOME = "[data-portfolio-home]";

/** An element's tag and, when it draws a box, the box: x, y, width and height relative to the root. */
type Box = [tag: string, x?: number, y?: number, w?: number, h?: number];
type Boxes = { "1440": Box[]; "412": Box[] };
type Target = {
  name: string;
  /** What is compared. */
  root: string;
  seed?: PortfolioFixture;
  /** Signed in as this person first. */
  signIn?: string;
  /** Opens the page at the window's current size, ready to settle. */
  open: (page: Page, baseURL: string) => Promise<void>;
};

/** The test server's address on a name.localhost host (Chromium resolves *.localhost to loopback). */
const on = (baseURL: string, name: string) => baseURL.replace("//localhost", `//${name}.localhost`);

const targets: Target[] = [
  ...PORTFOLIO_PAGES.map(({ name, fixture, view, root }): Target => {
    const u = fixture.username;
    const open =
      view === "public" || view === "owner"
        ? (page: Page) => page.goto(`/p/${u}`).then(() => undefined)
        : (page: Page, baseURL: string) => page.goto(`${on(baseURL, u)}/${"job" in view ? view.job : view.exhbt}`).then(() => undefined);
    return { name, root: root ?? HOME, seed: fixture, signIn: view === "owner" ? u : undefined, open };
  }),
  { name: "demo", root: HOME, open: (page) => page.goto("/demo").then(() => undefined) },
  { name: "what-is-an-exhbt", root: HOME, open: (page) => page.goto("/what-is-an-exhbt").then(() => undefined) },
  // The home page's look pictures: one page restyled by a radio group of looks above it.
  ...BASE_LOOKS.map(
    (look): Target => ({
      name: `home-look-${look}`,
      root: HOME,
      open: async (page) => {
        await page.goto("/");
        const radio = page.locator(`input[name=home-look][value="${look}"]`);
        // Pressed until the page takes it: a press before hydration does nothing.
        await expect(async () => {
          await page.locator("label", { has: radio }).click();
          await expect(page.locator(HOME)).toHaveAttribute("data-theme", look, { timeout: 2_000 });
        }).toPass({ timeout: 60_000 });
        // The pointer off the page, so nothing is drawn hovered.
        await page.mouse.move(0, 0);
      },
    }),
  ),
  // The step builder's look cards: each look drawn as the top of the person's page, scaled to its card.
  {
    name: "builder-look-cards",
    root: "[role=radiogroup][aria-labelledby=step-heading]",
    seed: BUILDER_LOOK_CARDS,
    signIn: BUILDER_LOOK_CARDS.username,
    open: async (page) => {
      await page.goto("/portfolio?step=look");
      await expect(page.locator("[data-ready=true] [data-testid=preview]")).toBeAttached();
      // Each picture draws only once it has measured its card.
      await expect(page.locator(`[data-look-card] ${HOME}`)).toHaveCount(BASE_LOOKS.length);
    },
  },
];

/** Fonts in, every picture loaded or failed, the page hydrated and idle; then every picture in the root must have loaded. */
async function settle(page: Page, root: string) {
  await expect(page.locator(root)).toHaveCount(1);
  await expect(page.locator(root)).toBeVisible();
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
  const broken = await page.locator(root).evaluate((el) => [...el.querySelectorAll("img")].filter((img) => !img.naturalWidth).map((img) => img.getAttribute("src")));
  expect(broken, "pictures that did not load").toEqual([]);
}

const FILE_ADDRESS = /\/dev\/files\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Each distinct match of `re` in `s`, in order of first appearance, replaced by `name(n)`. */
function byOrder(s: string, re: RegExp, name: (n: number) => string): string {
  const seen: string[] = [];
  for (const m of s.matchAll(re)) if (!seen.includes(m[0])) seen.push(m[0]);
  return seen.reduce((out, v, i) => out.replace(new RegExp(escape(v), "g"), name(i + 1)), s);
}

/** The five normalisations of e2e/layout-parity.spec.ts (decision 0027), in order, and no others. */
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

async function capture(page: Page, t: Target, baseURL: string): Promise<{ html: string; boxes: Boxes }> {
  const boxes = {} as Boxes;
  let html = "";
  for (const [w, h] of [
    [1440, 900],
    [412, 915],
  ] as const) {
    await page.setViewportSize({ width: w, height: h });
    await t.open(page, baseURL);
    await settle(page, t.root);
    const root = page.locator(t.root);
    if (w === 1440) html = normalise(await root.evaluate((el) => el.outerHTML));
    boxes[String(w) as "1440" | "412"] = await root.evaluate((el) => {
      const r0 = el.getBoundingClientRect();
      const half = (v: number) => Math.round(v * 2) / 2;
      return [el, ...el.querySelectorAll("*")].map((x): [string, number?, number?, number?, number?] => {
        const tag = x.tagName.toLowerCase();
        // Draws no box (display: none, or inside it): its tag alone, so nothing outside the root moves it.
        if (x.getClientRects().length === 0) return [tag];
        const r = x.getBoundingClientRect();
        return [tag, half(r.x - r0.x), half(r.y - r0.y), half(r.width), half(r.height)];
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
      if (g[0] !== b[0] || g.length !== b.length || b.slice(1).some((v, k) => Math.abs((v as number) - (g[k + 1] as number)) > 0.5)) off.push(`#${i} ${JSON.stringify(b)} is now ${JSON.stringify(g)}`);
    });
    expect(off.slice(0, 12), `${name} at ${w}: ${off.length} boxes moved`).toEqual([]);
  }
}

test.describe("The portfolio parity gate", () => {
  test("the fixtures cover every look and colourway", () => {
    expect([...LOOK_IDS]).toEqual(ALL_THEMES.map((t) => t.id));
    expect([...BASE_LOOKS]).toEqual(PORTFOLIO_THEMES.map((t) => t.id));
  });

  for (const t of targets) {
    test(t.name, async ({ page, request, baseURL }) => {
      test.setTimeout(180_000);
      // The dev server now and then answers 500 while it compiles (a manifest read half written): the seed is tried again.
      for (let tries = 1; t.seed; tries++) {
        const res = await request.post("/dev/portfolio-parity", { data: t.seed });
        if (res.status() >= 500 && tries < 3) continue;
        expect(res.status(), await res.text()).toBe(200);
        break;
      }
      if (t.signIn) await page.goto(`/auth/dev?email=${encodeURIComponent(`${t.signIn}@example.com`)}&next=${encodeURIComponent(`/p/${t.signIn}`)}`);
      const got = await capture(page, t, baseURL!);
      const htmlFile = path.join(GOLDEN, `${t.name}.html`);
      const boxesFile = path.join(GOLDEN, `${t.name}.boxes.json`);
      if (WRITE) {
        fs.mkdirSync(GOLDEN, { recursive: true });
        fs.writeFileSync(htmlFile, `${got.html}\n`);
        fs.writeFileSync(boxesFile, boxesJson(got.boxes));
        return;
      }
      expect(fs.existsSync(htmlFile) && fs.existsSync(boxesFile), `No golden copy for ${t.name}. Only brief A writes them, on the base commit, with GOLDEN=write.`).toBe(true);
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
