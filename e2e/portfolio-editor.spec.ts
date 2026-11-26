import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { BASE_LOOKS, fullFixture, sparseFixture } from "./fixtures/portfolio-pages";
import { HOME, HOME_BOXES, HOME_EDIT_ONLY_IN_FLOW, READY, boxes, differences, expect, fresh, openEditor, settle, test, waitReady } from "./portfolio-editor";

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
    // FAULT (F, components/portfolio-editor/tiles/LineTools.tsx), reported 26 Nov: with no line of education,
    // About's <dl> holds the lines' toolbar as a <div data-pe-lines> with no <dt> or <dd> in it, which axe's
    // definition-list rule refuses ("definition-list" on the <dl class="@3xl:mt-2">), in all eight looks. This
    // test turns green when it is fixed; then take this line out.
    test.fail();
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
