import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { buildRoadmap, uniqueEmail, unlockProjects, waitForResult } from "./helpers";

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

test.describe("Accessibility (WCAG 2.1 AA, automated)", () => {
  for (const path of ["/", "/pricing", "/universities", "/how-to-read-an-exhbt", "/legal/privacy", "/login", "/roadmap/new", "/start", "/demo", "/demo/gp-reminders"]) {
    test(`no violations on ${path}`, async ({ page }) => {
      await page.goto(path);
      // The builder's buttons are inert (greyed) until the page is interactive; scan the ready page,
      // not that brief pre-hydration state.
      if (path === "/roadmap/new") await expect(page.locator("form[data-ready=true]")).toBeAttached();
      const { violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze();
      expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(", ")}`)).toEqual([]);
    });
  }

  test("no violations on each builder step and each roadmap view, before and after the gate", async ({ page }) => {
    await buildRoadmap(page);
    await waitForResult(page);
    const base = page.url().split("?")[0];
    const scan = async (label: string) => {
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      const { violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze();
      expect(violations.map((v) => `${label} ${v.id}`)).toEqual([]);
    };
    // Before the gate: the free views, and the gate itself on Projects.
    for (const view of ["overview", "gaps", "strengths", "projects", "next"]) {
      await page.goto(`${base}?view=${view}`);
      await scan(`locked ${view}`);
    }
    // After it: the plan editor, then the settled plan.
    await unlockProjects(page, { email: uniqueEmail("a11y") });
    await expect(page.getByRole("heading", { level: 1, name: "Projects that would prove them" })).toBeVisible();
    await scan("plan editor");
    await page.getByRole("button", { name: "Keep this plan" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Your plan" })).toBeVisible();
    await scan("settled plan");
    for (const step of [1, 2, 3]) {
      await page.goto(`/roadmap/new?step=${step}`);
      await expect(page.getByText(`Step ${step} of 3`)).toBeVisible();
      await expect(page.locator("form[data-ready=true]")).toBeAttached();
      const { violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze();
      expect(violations.map((v) => `step ${step} ${v.id}`)).toEqual([]);
    }
  });
});
