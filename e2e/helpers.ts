import { expect, type Page } from "@playwright/test";

export const SAMPLE_CV =
  "Amara Okafor. BSc Data Science, University of Example, 2026. Final-year project on appointment reminders " +
  "using Python and pandas, with a logistic regression across 14,000 records. Part-time retail supervisor, 2023-2025.";

export const uniqueEmail = (tag = "test") => `${tag}+${Date.now()}${Math.floor(Math.random() * 1e4)}@example.com`;

/** Waits until the builder is interactive (it sets data-ready after hydration). */
export async function waitForBuilder(page: Page) {
  await expect(page.locator("form[data-ready=true]")).toBeAttached();
}

/** Walks the four-step builder (job, CV, situation with education & skills, email). Leaves the page on the result URL. */
export async function buildRoadmap(page: Page, opts: { role?: string; email: string; optIn?: boolean; withCv?: boolean }) {
  await page.goto(`/roadmap/new?role=${encodeURIComponent(opts.role ?? "Junior data analyst")}`);
  await waitForBuilder(page);
  await expect(page.getByText("Step 2 of 4")).toBeVisible();
  if (opts.withCv) {
    await page.getByText("Paste", { exact: true }).click();
    await page.locator("#cvPaste").fill(SAMPLE_CV);
    await page.getByRole("button", { name: /Continue/ }).click();
  } else {
    await page.getByRole("button", { name: "Skip for now" }).click();
  }
  await expect(page.getByText("Step 3 of 4")).toBeVisible();
  await page.getByLabel("Recently graduated").check();
  await page.locator("#education").fill("BSc Data Science, University of Example, 2026. Expected 2:1.");
  await page.getByRole("button", { name: /Continue/ }).click();
  await expect(page.getByText("Step 4 of 4")).toBeVisible();
  await page.locator("#email").fill(opts.email);
  if (opts.optIn) await page.locator("input[name=marketingOptIn]").check();
  await page.getByRole("button", { name: /Build my roadmap/ }).click();
}

/** Waits for generation to finish and the overview to show. */
export async function waitForResult(page: Page) {
  await page.waitForURL(/\/roadmap\/[0-9a-f-]{36}/);
  await expect(page.getByRole("heading", { level: 1, name: /Your roadmap to/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /gaps? to close/ })).toBeVisible();
}
