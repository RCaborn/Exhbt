import AxeBuilder from "@axe-core/playwright";
import { devices, expect, test } from "@playwright/test";

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
const PIXEL_7 = (({ viewport, userAgent, deviceScaleFactor, isMobile, hasTouch }) => ({ viewport, userAgent, deviceScaleFactor, isMobile, hasTouch }))(devices["Pixel 7"]);

const noSideScroll = (page: import("@playwright/test").Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

test.describe("Landing: header and footer", () => {
  test("the header has the two buttons and no employers or universities links", async ({ page }) => {
    await page.goto("/");
    const header = page.getByRole("banner");
    await expect(header.getByRole("link", { name: "Build your exhbt" })).toHaveAttribute("href", "/exhbts/new");
    await expect(header.getByRole("link", { name: "Build your roadmap" })).toHaveAttribute("href", "/roadmap/new");
    await expect(header.getByRole("link", { name: "Log in" })).toBeVisible();
    await expect(header.getByRole("link", { name: "What is an exhbt?" })).toBeVisible();
    await expect(header.getByRole("link", { name: /For employers/ })).toHaveCount(0);
    await expect(header.getByRole("link", { name: /For universities/ })).toHaveCount(0);
  });

  test("the page you're on is marked in the nav", async ({ page }) => {
    await page.goto("/what-is-an-exhbt");
    await expect(page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "What is an exhbt?" })).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Pricing" })).not.toHaveAttribute("aria-current", "page");
  });

  test("the footer has universities and the employer guide, and no quick start", async ({ page }) => {
    await page.goto("/pricing");
    const footer = page.getByRole("contentinfo");
    await expect(footer.getByRole("link", { name: "For universities" })).toHaveAttribute("href", "/universities");
    await expect(footer.getByRole("link", { name: "How to read an exhbt" })).toHaveAttribute("href", "/how-to-read-an-exhbt");
    await expect(footer.getByRole("link", { name: /For employers|Quick start/ })).toHaveCount(0);
  });
});

test.describe("Landing: pages", () => {
  test("what is an exhbt renders, with its example and its address", async ({ page }) => {
    await page.goto("/what-is-an-exhbt");
    await expect(page.getByRole("heading", { level: 1, name: "What is an exhbt?" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "How you make one" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Your own address" })).toBeVisible();
    await expect(page.getByRole("article").first()).toBeVisible();
    await expect(page.getByRole("list", { name: "Methodology" }).first()).toBeVisible();
  });

  test("what is an exhbt passes axe", async ({ page }) => {
    await page.goto("/what-is-an-exhbt");
    const { violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze();
    expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(", ")}`)).toEqual([]);
  });

  test("home passes axe, and says what's coming soon", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("website of your own");
    await expect(page.getByText("Coming soon", { exact: true }).first()).toBeVisible();
    const { violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze();
    expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(", ")}`)).toEqual([]);
  });

  test("the sitemap lists the marketing pages", async ({ request }) => {
    const xml = await (await request.get("/sitemap.xml")).text();
    const text = await (await request.get("/sitemap.txt")).text();
    for (const path of ["/what-is-an-exhbt", "/pricing", "/universities", "/how-to-read-an-exhbt"]) {
      expect(xml).toContain(path);
      expect(text).toContain(`https://www.exhbt.co.uk${path}`);
    }
    expect(text.split("\n").filter(Boolean)).toEqual(
      [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]),
    );
  });
});

test.describe("Landing: phone", () => {
  test.use(PIXEL_7);

  test("no sideways scroll on home or what is an exhbt", async ({ page }) => {
    for (const path of ["/", "/what-is-an-exhbt", "/pricing"]) {
      await page.goto(path);
      expect(await noSideScroll(page), path).toBe(true);
    }
  });

  test("the menu has both buttons, and the roadmap one goes to the builder", async ({ page }) => {
    await page.goto("/");
    const header = page.getByRole("banner");
    await header.getByRole("button", { name: "Menu" }).click();
    const menu = header.getByRole("navigation", { name: "Main menu" });
    await expect(menu.getByRole("link", { name: "What is an exhbt?" })).toBeVisible();
    await expect(header.getByRole("link", { name: "Build your exhbt" })).toBeVisible();
    await expect(header.getByRole("link", { name: "Build your roadmap" })).toBeVisible();
    await expect(menu.getByRole("link", { name: /For employers|For universities/ })).toHaveCount(0);
    expect(await noSideScroll(page)).toBe(true);
  });
});
