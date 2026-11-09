import { expect, type Page } from "@playwright/test";

export const SAMPLE_CV =
  "Amara Okafor. BSc Data Science, University of Example, 2026. Final-year project on appointment reminders " +
  "using Python and pandas, with a logistic regression across 14,000 records. Part-time retail supervisor, 2023-2025.";

export const uniqueEmail = (tag = "test") => `${tag}+${Date.now()}${Math.floor(Math.random() * 1e4)}@example.com`;

/** Waits until the builder is interactive (it sets data-ready after hydration). */
export async function waitForBuilder(page: Page) {
  await expect(page.locator("form[data-ready=true]")).toBeAttached();
}

/** A CV whose top has the details the project-ideas gate can prefill. */
export const CV_WITH_CONTACT =
  "Amara Okafor\namara.okafor@example.com | linkedin.com/in/amara-okafor\n" +
  "BSc Data Science, University of Example, 2026. Final-year project on appointment reminders using Python and pandas.";

/** Walks the three-step builder (job, CV, where you are now). Leaves the page on the result URL. */
export async function buildRoadmap(page: Page, opts: { role?: string; withCv?: boolean; cv?: string } = {}) {
  await page.goto(`/roadmap/new?role=${encodeURIComponent(opts.role ?? "Junior data analyst")}`);
  await waitForBuilder(page);
  await expect(page.getByText("Step 2 of 3")).toBeVisible();
  if (opts.withCv || opts.cv) {
    await page.getByText("Paste", { exact: true }).click();
    await page.locator("#cvPaste").fill(opts.cv ?? SAMPLE_CV);
    await page.getByRole("button", { name: /Continue/ }).click();
  } else {
    await page.getByRole("button", { name: "Skip for now" }).click();
  }
  await expect(page.getByText("Step 3 of 3")).toBeVisible();
  await page.getByLabel("Recently graduated").check();
  await page.locator("#education").fill("BSc Data Science, University of Example, 2026. Expected 2:1.");
  await page.getByRole("button", { name: /See my roadmap/ }).click();
}

/** Opens the Projects view, fills in the details gate and submits it. */
export async function unlockProjects(page: Page, opts: { email: string; name?: string; linkedin?: string; optIn?: boolean }) {
  await page.goto(`${page.url().split("?")[0]}?view=projects`);
  await expect(page.getByRole("heading", { level: 1, name: "Your project ideas are ready" })).toBeVisible();
  await page.getByLabel("Name").fill(opts.name ?? "Test Person");
  await page.getByLabel("Email", { exact: true }).fill(opts.email);
  if (opts.linkedin) await page.getByLabel(/LinkedIn/).fill(opts.linkedin);
  if (opts.optIn) await page.locator("input[name=marketingOptIn]").check();
  await page.getByRole("button", { name: "Show my projects" }).click();
}

/** Waits for generation to finish and the overview to show. */
export async function waitForResult(page: Page) {
  await page.waitForURL(/\/roadmap\/[0-9a-f-]{36}/);
  await expect(page.getByRole("heading", { level: 1, name: /Your roadmap to/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /gaps? to close/ })).toBeVisible();
}
