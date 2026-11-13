import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { buildRoadmap, uniqueEmail, waitForResult } from "./helpers";

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
const EDUCATION = "BSc Data Science, University of Example, 2026. Expected 2:1.";

// My roadmaps, a new roadmap for a different job in one step, and saved ideas (decision 0010).

async function signIn(page: Page, plan: "free" | "premium") {
  const email = uniqueEmail("saved");
  await page.goto(`/auth/dev?email=${encodeURIComponent(email)}&next=/exhbts`);
  await expect(page.getByRole("heading", { level: 1, name: "Your exhbts" })).toBeVisible();
  await page.goto(`/dev/plan?plan=${plan}&next=/roadmap/new`);
  await expect(page.locator("form[data-ready=true]")).toBeAttached();
  return email;
}

/** Builds a roadmap while signed in and leaves the page on its Projects view. */
async function roadmapWithIdeas(page: Page, role: string) {
  await buildRoadmap(page, { role });
  await waitForResult(page);
  const roadmapUrl = page.url().split("?")[0];
  await page.goto(`${roadmapUrl}?view=projects`);
  await expect(page.getByRole("heading", { level: 1, name: "Projects that would prove them" })).toBeVisible();
  return roadmapUrl;
}

const ideaTitles = (page: Page) => page.getByRole("list", { name: "Project ideas" }).getByRole("heading", { level: 2 });

test.describe("My roadmaps", () => {
  test("lists every roadmap, newest first, and each one opens", async ({ page }) => {
    await signIn(page, "premium");
    const a = await roadmapWithIdeas(page, "Junior data analyst");
    const b = await roadmapWithIdeas(page, "Product analyst");

    await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Roadmaps" }).click();
    await expect(page).toHaveURL(/\/roadmap$/);
    await expect(page.getByRole("heading", { level: 1, name: "Your roadmaps" })).toBeVisible();
    const items = page.getByRole("list", { name: "Your roadmaps" }).getByRole("listitem");
    await expect(items).toHaveCount(2);
    await expect(items.nth(0)).toContainText("Product analyst");
    await expect(items.nth(1)).toContainText("Junior data analyst");
    await expect(items.nth(0)).toContainText("Project ideas unlocked");

    await items.nth(1).getByRole("link", { name: "Junior data analyst" }).click();
    await expect(page).toHaveURL(a);
    await expect(page.getByRole("heading", { level: 1, name: /Your roadmap to/ })).toBeVisible();
    await page.goto("/roadmap");
    await items.nth(0).getByRole("link", { name: "Product analyst" }).click();
    await expect(page).toHaveURL(b);
  });

  test("a new roadmap for a different job asks only for the job and reuses the details", async ({ page }) => {
    await signIn(page, "premium");
    await roadmapWithIdeas(page, "Junior data analyst");
    await page.goto("/roadmap");

    const section = page.getByRole("region", { name: "New roadmap for a different job" });
    await expect(section.getByText(EDUCATION)).toBeVisible();
    await expect(section.getByRole("link", { name: "Edit details" })).toHaveAttribute("href", /\/roadmap\/new\?from=/);
    await expect(section.getByRole("textbox")).toHaveCount(1);
    await expect(page.locator("form[data-ready=true]")).toBeAttached();
    await section.getByLabel("The new job you want").fill("Operations manager");
    await section.getByRole("button", { name: "Build this roadmap" }).click();
    await waitForResult(page);
    await expect(page.getByRole("heading", { level: 1, name: /Operations manager/ })).toBeVisible();

    // The new roadmap is now the newest, and carries the same education.
    await page.goto("/roadmap");
    const items = page.getByRole("list", { name: "Your roadmaps" }).getByRole("listitem");
    await expect(items).toHaveCount(2);
    await expect(items.nth(0)).toContainText("Operations manager");
    await expect(page.getByRole("region", { name: "New roadmap for a different job" }).getByText(EDUCATION)).toBeVisible();

    // "Edit details" opens the full builder with the details filled in and the job left to type.
    await page.getByRole("link", { name: "Edit details" }).click();
    await expect(page.locator("form[data-ready=true]")).toBeAttached();
    await expect(page.getByLabel("The job you want")).toHaveValue("");
  });

  test("on Free, a second roadmap is refused with the upgrade prompt", async ({ page }) => {
    await signIn(page, "free");
    await roadmapWithIdeas(page, "Junior data analyst");
    await page.goto("/roadmap");
    await expect(page.locator("form[data-ready=true]")).toBeAttached();
    await page.getByLabel("The new job you want").fill("Operations manager");
    await page.getByRole("button", { name: "Build this roadmap" }).click();
    const prompt = page.getByTestId("upgrade-prompt");
    await expect(prompt).toContainText("You've used this month's");
    await expect(prompt.getByRole("link", { name: /Upgrade to Premium/ })).toBeVisible();
    await expect(page.getByRole("list", { name: "Your roadmaps" }).getByRole("listitem")).toHaveCount(1);
  });

  test("has no accessibility violations", async ({ page }) => {
    await signIn(page, "premium");
    await roadmapWithIdeas(page, "Junior data analyst");
    await page.goto("/roadmap");
    await expect(page.getByRole("heading", { level: 1, name: "Your roadmaps" })).toBeVisible();
    const results = await new AxeBuilder({ page }).withTags(WCAG).analyze();
    expect(results.violations).toEqual([]);
  });
});

test.describe("saved ideas", () => {
  test("Premium saves ideas from two roadmaps, filters by job, builds one and removes one", async ({ page }) => {
    await signIn(page, "premium");
    const a = await roadmapWithIdeas(page, "Junior data analyst");
    await page.getByRole("button", { name: /^Save idea:/ }).first().click();
    await expect(page.getByRole("button", { name: /^Saved:/ })).toHaveCount(1);
    const titleA = (await ideaTitles(page).first().textContent())!.trim();

    const b = await roadmapWithIdeas(page, "Product analyst");
    expect(b).not.toBe(a);
    // A star belongs to its own roadmap: nothing is marked saved here yet.
    await expect(page.getByRole("button", { name: /^Saved:/ })).toHaveCount(0);
    await page.getByRole("button", { name: /^Save idea:/ }).nth(1).click();
    await expect(page.getByRole("button", { name: /^Saved:/ })).toHaveCount(1);
    const titleB = (await ideaTitles(page).nth(1).textContent())!.trim();

    await page.getByRole("link", { name: "Saved ideas" }).click();
    await expect(page).toHaveURL(/\/roadmap\/saved$/);
    await expect(page.getByRole("heading", { level: 1, name: "Saved ideas" })).toBeVisible();
    const saved = page.getByRole("list", { name: "Saved ideas" }).getByRole("listitem");
    await expect(saved).toHaveCount(2);
    await expect(saved.filter({ hasText: "Product analyst" })).toHaveCount(1);
    await expect(saved.filter({ hasText: "Junior data analyst" })).toHaveCount(1);

    const results = await new AxeBuilder({ page }).withTags(WCAG).analyze();
    expect(results.violations).toEqual([]);

    // Filter by job.
    const filter = page.getByRole("navigation", { name: "Filter by job" });
    await filter.getByRole("link", { name: "Junior data analyst" }).click();
    await expect(saved).toHaveCount(1);
    await expect(saved.first()).toContainText("Junior data analyst");
    await filter.getByRole("link", { name: "All jobs" }).click();
    await expect(saved).toHaveCount(2);

    // Build the product analyst one as an exhbt: the editor opens prefilled.
    await saved.filter({ hasText: "Product analyst" }).getByRole("button", { name: "Build this as an exhbt" }).click();
    await page.waitForURL(/\/exhbts\/[0-9a-f-]{36}\/edit$/);
    await expect(page.locator("[data-ready=true]")).toBeAttached();
    await expect(page.locator("#title")).toHaveValue(titleB);

    // Remove the other one.
    await page.goto("/roadmap/saved");
    await saved.filter({ hasText: "Junior data analyst" }).getByRole("button", { name: /^Remove:/ }).click();
    await expect(saved).toHaveCount(1);
    await expect(saved.first()).toContainText("Product analyst");
    expect(titleA.length).toBeGreaterThan(0);

    // On its roadmap the star is off again.
    await page.goto(`${a}?view=projects`);
    await expect(page.getByRole("button", { name: /^Saved:/ })).toHaveCount(0);
  });

  test("a swap in the roadmap leaves the saved copy as it was", async ({ page }) => {
    await signIn(page, "premium");
    const a = await roadmapWithIdeas(page, "Junior data analyst");
    const original = (await ideaTitles(page).first().textContent())!.trim();
    await page.getByRole("button", { name: /^Save idea:/ }).first().click();
    await expect(page.getByRole("button", { name: /^Saved:/ })).toHaveCount(1);

    await page.getByRole("button", { name: `Swap: ${original}` }).click();
    await expect(page.getByRole("list", { name: "Project ideas" }).getByRole("heading", { level: 2, name: original })).toHaveCount(0);
    // The swapped-in idea isn't saved; the star for it is off.
    await expect(page.getByRole("button", { name: /^Saved:/ })).toHaveCount(0);

    await page.goto("/roadmap/saved");
    const saved = page.getByRole("list", { name: "Saved ideas" }).getByRole("listitem");
    await expect(saved).toHaveCount(1);
    await expect(saved.first().getByRole("heading", { level: 2, name: original })).toBeVisible();
    await expect(saved.first().getByRole("link", { name: "Junior data analyst" })).toHaveAttribute("href", new RegExp(a.split("/").pop()!));
  });

  test("Free sees a locked star that shows the upgrade offer", async ({ page }) => {
    await signIn(page, "free");
    await roadmapWithIdeas(page, "Junior data analyst");
    const locked = page.getByRole("button", { name: /^Save idea: .*\(locked\)$/ });
    await expect(locked.first()).toBeVisible();
    await expect(page.getByTestId("upgrade-prompt")).toHaveCount(0);
    await locked.first().click();
    const prompt = page.getByTestId("upgrade-prompt");
    await expect(prompt).toContainText("Premium");
    await expect(prompt.getByRole("link", { name: /Upgrade to Premium/ })).toBeVisible();

    await page.goto("/roadmap/saved");
    await expect(page.getByTestId("upgrade-prompt")).toContainText("Premium");
  });
});
