import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { buildRoadmap, uniqueEmail, waitForResult } from "./helpers";

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

test.describe("Accessibility (WCAG 2.1 AA, automated)", () => {
  for (const path of ["/", "/pricing", "/universities", "/how-to-read-an-exhbt", "/legal/privacy", "/login", "/roadmap/new"]) {
    test(`no violations on ${path}`, async ({ page }) => {
      await page.goto(path);
      const { violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze();
      expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(", ")}`)).toEqual([]);
    });
  }

  test("no violations on each builder step and each roadmap view", async ({ page }) => {
    await buildRoadmap(page, { email: uniqueEmail("a11y") });
    await waitForResult(page);
    const base = page.url().split("?")[0];
    for (const view of ["overview", "gaps", "projects", "strengths", "next"]) {
      await page.goto(`${base}?view=${view}`);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      const { violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze();
      expect(violations.map((v) => `${view} ${v.id}`)).toEqual([]);
    }
    for (const step of [1, 2, 3, 4]) {
      await page.goto(`/roadmap/new?step=${step}`);
      await expect(page.getByText(`Step ${step} of 4`)).toBeVisible();
      const { violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze();
      expect(violations.map((v) => `step ${step} ${v.id}`)).toEqual([]);
    }
  });
});
