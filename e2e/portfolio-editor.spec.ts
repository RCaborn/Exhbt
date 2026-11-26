import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { BASE_LOOKS, fullFixture, sparseFixture } from "./fixtures/portfolio-pages";
import { canUseTheme } from "../lib/plan-rules";
import { themeById } from "../lib/portfolio-themes";
import { fillTitle } from "./editor";
import { HOME, HOME_BOXES, HOME_EDIT_ONLY_IN_FLOW, READY, boxes, call, differences, expect, focusedPath, fresh, lowContrast, openEditor, setKind, settle, test, waitReady } from "./portfolio-editor";

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

// The editing page is the visitor's page (decision 0031; brief J of docs/briefs/portfolio-first): in all eight
// looks, full and empty, at 1440 and 412, every landmark of the page is where /p/<name> has it, within half a
// pixel, once what decision 0031 lets the editing page add is allowed for by name (HOME_EDIT_ONLY_IN_FLOW in
// e2e/portfolio-editor.ts). F's, G's and I's cases (toolbars, the bar's sheets, locks, the phone) are added
// as their work lands.

/** Takes out of the editing page what it alone has in the flow ("remove"), and names the boxes that may differ ("box"). */
async function allowEditOnly(page: Page): Promise<string[]> {
  return page.evaluate(
    ([list, ready, marks]) => {
      const root = document.querySelector(`${ready} [data-portfolio-home]`)!;
      const own: string[] = [];
      // Everything each entry matches is found first, then taken out, so no entry hides another's.
      const gone: Element[] = [];
      for (const { selector, allow } of list as { selector: string; allow: string }[]) {
        const found = [...root.querySelectorAll(selector)];
        if (allow === "remove") gone.push(...found);
        else if (allow === "box")
          // A box that may differ: named as boxes() names it, by landmark and place.
          for (const [name, sel] of Object.entries(marks as Record<string, string>)) {
            const all = [...root.querySelectorAll(sel)];
            found.forEach((el) => {
              const i = all.indexOf(el);
              if (i >= 0) own.push(`${name}#${i + 1}`);
            });
          }
        // "width": inside the landmarks measured here, never one of them.
      }
      gone.forEach((el) => el.isConnected && el.remove());
      return own;
    },
    [HOME_EDIT_ONLY_IN_FLOW, READY, HOME_BOXES] as const,
  );
}

type Kind = "full" | "empty" | "no education line";
const CASES: { look: string; kind: Kind }[] = [
  ...BASE_LOOKS.flatMap((look) => [
    { look, kind: "full" as const },
    { look, kind: "empty" as const },
  ]),
  // Where the location and the year are shrink-0 block fields (d-findings.md, "Field sizes").
  { look: "ledger", kind: "no education line" },
  { look: "notebook", kind: "no education line" },
];

/** The full fixture without its education lines, the tools kept. */
function noEducation(look: string | null) {
  const base = fullFixture("x", look);
  const layout = base.layout as { tiles: Record<string, unknown> };
  return { ...base, layout: { ...layout, tiles: { ...layout.tiles, education: { lines: [], tools: "Excel, Python, SQL, Tableau" } } } };
}

for (const { look, kind } of CASES) {
  test(`${look}, ${kind}: the editing page is the visitor's page box for box at 1440 and 412, but for what 0031 lets it add`, async ({ page }) => {
    test.slow();
    const stored = look === "exhbt" ? null : look;
    const fixture = kind === "full" ? fullFixture("x", stored) : kind === "empty" ? sparseFixture("x", stored) : noEducation(stored);
    const f = fresh(fixture, `ed${look}${kind.slice(0, 5)}`);
    await openEditor(page, f);
    for (const width of [1440, 412]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/p/${f.username}`);
      await settle(page);
      const visiting = await boxes(page);
      expect(visiting.length, "the public page drew its landmarks").toBeGreaterThan(3);
      await page.goto("/portfolio");
      await waitReady(page);
      await settle(page);
      const own = await allowEditOnly(page);
      await settle(page);
      const editing = await boxes(page);
      const off = differences(visiting, editing).filter((d) => !own.some((k) => d.startsWith(`${k} `)));
      expect(off, `${look} ${kind} at ${width}`).toEqual([]);
      expect(await page.locator(`${READY} ${HOME}`).count()).toBe(1);
    }
  });
}

/** axe's WCAG 2.1 AA findings on the page as it is now, in words. */
async function axe(page: Page): Promise<string[]> {
  await settle(page);
  const { violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  return violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(", ")}`);
}

// F's parts in every look (brief F; decision 0031, "Sections and tiles"): a section's and a tile's toolbar
// shown, the Add a section menu and a tile's More menu open, and the empty page with the vision and the Add
// tile. G's bar, sheets and the Look menu are added when G's work lands.
for (const look of BASE_LOOKS) {
  test(`${look}: axe finds no WCAG 2.1 AA violation with the sections' and tiles' controls shown, their menus open, and on the empty page`, async ({ page }) => {
    test.slow();
    const stored = look === "exhbt" ? null : look;
    // A draft and a hidden exhbt, so the owner-only tile and the hidden row are on the page too.
    const base = fullFixture("x", stored, "premium");
    const f = fresh({ ...base, exhbts: base.exhbts.map((e) => ({ ...e, draft: e.key === "poster", hidden: e.key === "rota" })) }, `axe${look}`);
    await openEditor(page, f);

    await page.locator(`${READY} [data-section-frame="about"]`).hover();
    expect(await axe(page), `${look}: a section's toolbar`).toEqual([]);
    const card = page.locator(`${READY} [data-section="work"] [data-tile-frame]`).first();
    await card.hover();
    expect(await axe(page), `${look}: a tile's toolbar`).toEqual([]);

    await card.locator(":scope > [data-pe-tools]").getByRole("button", { name: /^More for / }).click();
    await expect(page.getByRole("menu")).toBeVisible();
    expect(await axe(page), `${look}: a tile's More menu`).toEqual([]);
    await page.keyboard.press("Escape");

  });

  test(`${look}: axe finds no WCAG 2.1 AA violation on the empty page, with the vision, the Add tile and the Add a section menu`, async ({ page }) => {
    test.slow();
    const stored = look === "exhbt" ? null : look;
    // The vision band with the look's own Add an exhbt, and the Add tile. Its sections are the default few,
    // so Add a section has some to offer (on the full page it reads "Every section…").
    await openEditor(page, fresh({ ...sparseFixture("x", stored), exhbts: [] }, `axe0${look}`));
    await page.locator(`${READY} [data-path="arrangement.sections"]`).getByRole("button", { name: "Add a section" }).click({ timeout: 10_000 });
    await expect(page.getByRole("menu")).toBeVisible();
    expect(await axe(page), `${look}: Add a section`).toEqual([]);
    await page.keyboard.press("Escape");
    expect(await axe(page), `${look}: the empty page`).toEqual([]);
  });
}

// G's bar and sheets in every look (brief G; decision 0031, "The bar"). G's own spec runs axe with each part open
// in the Exhbt look; here the same parts in all eight, since every sheet sits over the person's own page.
const PARTS: [name: string, sel: string][] = [
  ["look", "[data-look-menu]"],
  ["address", '[data-sheet="address"] [data-address]'],
  ["photo", "[data-photo-sheet]"],
  ["job-links", "[data-job-links-menu]"],
  ["team", "[data-team-sheet]"],
  ["links", "[data-links-panel]"],
];

for (const look of BASE_LOOKS) {
  test(`${look}: axe finds no WCAG 2.1 AA violation in the bar, nor with each of its menus and sheets open`, async ({ page }) => {
    test.slow();
    const stored = look === "exhbt" ? null : look;
    const plan = canUseTheme("premium", themeById(look)!).ok ? "premium" : "max";
    await openEditor(page, fresh(fullFixture("x", stored, plan), `axeg${look}`));
    expect(await axe(page), `${look}: the bar`).toEqual([]);
    for (const [name, sel] of PARTS) {
      await call(page, "open", name);
      await expect(page.locator(sel)).toBeVisible();
      if (name === "links" || name === "look") {
        // In the top layer: axe (4.14) measures its contrast against whatever is under it in the markup (the
        // site's footer, or a dark look's page: Night and Studio for the Look menu), so contrast is measured on
        // its own surface instead, to the same 4.5:1, as G's spec does for Your links.
        const { violations } = await new AxeBuilder({ page }).withTags(WCAG).disableRules(["color-contrast"]).analyze();
        expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(", ")}`), `${look}: ${name}`).toEqual([]);
        expect(await lowContrast(page, sel), `${look}: ${name}, contrast on its own surface`).toEqual([]);
      } else expect(await axe(page), `${look}: ${name}`).toEqual([]);
      await call(page, "close");
      await expect(page.locator(sel)).toBeHidden();
    }
  });
}

test("a new person's first journey: the strip, then the vision's Add an exhbt, a blank exhbt with a title, and back by Your portfolio to its Draft tile", async ({ page }) => {
  test.slow();
  await page.setViewportSize({ width: 1440, height: 900 });
  await setKind(page, "page");
  const email = `pe-journey-${Math.random().toString(36).slice(2, 8)}@example.com`;
  // Premium, where a draft is the owner's own tile, marked Draft; signed in with no next of their own.
  await page.goto(`/auth/dev?email=${encodeURIComponent(email)}&next=${encodeURIComponent(`/dev/plan?plan=premium&next=${encodeURIComponent("/portfolio")}`)}`);
  await waitReady(page);

  // The strip, on its first step, with the cursor in the name.
  const strip = page.locator('[data-first-run="wide"]');
  await expect(strip).toHaveAttribute("data-step", "page");
  await strip.getByRole("button", { name: /^Your name/ }).click();
  await expect.poll(() => focusedPath(page)).toBe("profile.name");
  await page.keyboard.type("Sam Taylor");
  await strip.getByRole("button", { name: /^One line about you/ }).click();
  await expect.poll(() => focusedPath(page)).toBe("profile.headline");
  await page.keyboard.type("Data analyst in training");
  await strip.getByRole("button", { name: /^Pick a look/ }).click();
  // Looking through the looks and keeping the one shown is the choice (as G's spec has it).
  await expect(page.locator("[data-look-menu]")).toBeVisible();
  await page.keyboard.press("Escape");
  // The photo is optional and skipped: with the name, the headline and the look done, the strip moves to its
  // second step by itself.
  await expect(strip).toHaveAttribute("data-step", "exhbt");

  // The vision band's own button, the chooser, a blank page in the first layout.
  await page.locator(`${READY} [data-owner="vision"]`).click();
  await expect(page).toHaveURL(/\/exhbts\/new$/);
  await page.getByRole("link", { name: "Choose a layout" }).click();
  await page.getByRole("button", { name: /^Use the .* layout$/ }).first().click();
  await expect(page).toHaveURL(/\/exhbts\/[^/]+\/edit/);
  await fillTitle(page, "Timing the lunch queue");
  // Back at once, by the editor's own link: the title is saved before the page leaves.
  await page.locator("header[data-topbar]").getByRole("link", { name: "Your portfolio" }).click();
  await waitReady(page);
  const tile = page.locator(`${READY} [data-owner="owner-only"][data-why="draft"]`);
  await expect(tile).toHaveCount(1);
  await expect(tile).toContainText("Timing the lunch queue");
  await expect(tile).toContainText("Draft");
  // What was typed in the strip's first step is the page's.
  await expect(page.locator(`${READY} ${HOME} h1`).getByRole("textbox", { name: "Your name" })).toHaveValue("Sam Taylor");
});
