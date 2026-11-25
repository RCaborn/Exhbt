import { expect, test, type Page } from "@playwright/test";

/** Runs in both the desktop and mobile projects (see playwright.config.ts). */
test("home: the exhbt button is fully visible without scrolling", async ({ page }) => {
  await page.goto("/");
  const form = page.getByRole("button", { name: "Build your exhbt" });
  await expect(form).toBeVisible();
  const box = (await form.boundingBox())!;
  const viewport = page.viewportSize()!;
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
});

const PAGES = ["/", "/what-is-an-exhbt", "/pricing", "/universities", "/how-to-read-an-exhbt", "/roadmap/new", "/demo", "/demo/gp-reminders"];

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

// The gallery and research layouts (decision 0024) on a phone: everything stacks, nothing scrolls sideways.
test.describe("exhbt layouts on a phone", () => {
  const stamp = () => Date.now().toString(36).slice(-5) + Math.floor(Math.random() * 1000);
  const noSideScroll = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

  async function seeded(page: Page) {
    const username = `rs${stamp()}`;
    const res = await page.request.get(`/dev/portfolio?username=${username}&plan=max&with=formats`, { maxRedirects: 0 });
    expect(res.status(), await res.text()).toBe(307);
    return username;
  }

  test("neither page scrolls sideways, at the project's viewport and at 375px", async ({ page }) => {
    const u = await seeded(page);
    for (const slug of ["freshers-campaign", "walk-and-recall"]) {
      await page.goto(`/p/${u}/${slug}`);
      expect(await noSideScroll(page), slug).toBe(true);
    }
    await page.setViewportSize({ width: 375, height: 812 });
    for (const slug of ["freshers-campaign", "walk-and-recall"]) {
      await page.goto(`/p/${u}/${slug}`);
      expect(await noSideScroll(page), `${slug} at 375`).toBe(true);
    }
  });

  test("the gallery's lead image starts inside the first screen", async ({ page }) => {
    const u = await seeded(page);
    await page.goto(`/p/${u}/freshers-campaign`);
    const top = (await page.locator("[data-part=lead]").boundingBox())!.y;
    expect(top).toBeLessThan(page.viewportSize()!.height);
  });

  test("the enlarged picture fits the phone and has a Close control of at least 44px", async ({ page }) => {
    const u = await seeded(page);
    await page.goto(`/p/${u}/freshers-campaign`);
    await page.locator(".xp-tile button").first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    expect(await noSideScroll(page)).toBe(true);
    expect(await dialog.evaluate((d) => d.scrollWidth <= d.clientWidth)).toBe(true);
    const close = (await dialog.getByRole("button", { name: "Close" }).boundingBox())!;
    expect(close.height).toBeGreaterThanOrEqual(44);
    expect(close.width).toBeGreaterThanOrEqual(44);
  });
});
