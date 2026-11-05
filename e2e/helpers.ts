import { expect, type Page } from "@playwright/test";

export const SAMPLE_CV =
  "Amara Okafor. BSc Data Science, University of Example, 2026. Final-year project on appointment reminders " +
  "using Python and pandas, with a logistic regression across 14,000 records. Part-time retail supervisor, 2023-2025.";

export const uniqueEmail = (tag = "test") => `${tag}+${Date.now()}${Math.floor(Math.random() * 1e4)}@example.com`;

/** Waits until the builder is interactive (it sets data-ready after hydration). */
export async function waitForBuilder(page: Page) {
  await expect(page.locator("form[data-ready=true]")).toBeAttached();
}

/** Walks the four-step builder with pasted CV text. Leaves the page on the result URL. */
export async function buildRoadmap(page: Page, opts: { role?: string; email: string; optIn?: boolean }) {
  await page.goto(`/roadmap/new?role=${encodeURIComponent(opts.role ?? "Junior data analyst")}`);
  await waitForBuilder(page);
  await expect(page.getByText("Step 2 of 4")).toBeVisible();
  await page.getByText("Paste the text").click();
  await page.locator("#cvPaste").fill(SAMPLE_CV);
  await page.getByRole("button", { name: /Continue/ }).click();
  await expect(page.getByText("Step 3 of 4")).toBeVisible();
  await page.getByRole("button", { name: /^Next/ }).click();
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
