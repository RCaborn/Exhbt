import type { Page } from "@playwright/test";
import { BASE_LOOKS, fullFixture, sparseFixture } from "./fixtures/portfolio-pages";
import { HOME, HOME_BOXES, HOME_EDIT_ONLY_IN_FLOW, READY, boxes, differences, expect, fresh, openEditor, settle, test, waitReady } from "./portfolio-editor";

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
