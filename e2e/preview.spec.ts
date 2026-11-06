import { expect, test } from "@playwright/test";

/** The site is a private preview unless built with EXHBT_PUBLIC=1 (see lib/site.ts). */
test.describe("private preview", () => {
  test.skip(process.env.EXHBT_PUBLIC === "1", "public build");

  test("pages are noindex and show the preview bar", async ({ page }) => {
    const res = await page.goto("/");
    expect(res?.headers()["x-robots-tag"]).toContain("noindex");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    await expect(page.getByRole("note")).toContainText("Private preview");
  });

  test("robots.txt disallows everything", async ({ request }) => {
    const body = await (await request.get("/robots.txt")).text();
    expect(body).toMatch(/Disallow: \/\s*$/m);
  });
});
