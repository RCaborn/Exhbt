import { expect, test } from "@playwright/test";

/** Runs in both the desktop and mobile projects (see playwright.config.ts). */
test("home: the start form is fully visible without scrolling", async ({ page }) => {
  await page.goto("/");
  const form = page.locator("form:has(#start-hero)");
  await expect(form).toBeVisible();
  const box = (await form.boundingBox())!;
  const viewport = page.viewportSize()!;
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
});

const PAGES = ["/", "/pricing", "/universities", "/how-to-read-an-exhbt", "/roadmap/new", "/demo", "/demo/gp-reminders"];

test("no page scrolls sideways", async ({ page }) => {
  for (const path of PAGES) {
    await page.goto(path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(overflow, path).toBe(false);
  }
});

test("no page scrolls sideways on a 375px phone", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  for (const path of PAGES) {
    await page.goto(path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(overflow, path).toBe(false);
  }
});
