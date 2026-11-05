import { expect, test } from "@playwright/test";
import { buildRoadmap, SAMPLE_CV, uniqueEmail, waitForBuilder, waitForResult } from "./helpers";

test.describe("Phase 1: from the home page to a roadmap", () => {
  test("home role field pre-fills the builder and starts at the CV step", async ({ page }) => {
    await page.goto("/");
    await page.locator("#start-hero").fill("Junior data analyst");
    await page.locator("form:has(#start-hero) button[type=submit]").click();
    await page.waitForURL(/\/roadmap\/new\?role=/);
    await expect(page.getByText("Step 2 of 4")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Add your CV" })).toBeVisible();
  });

  test("builder validates each step and keeps answers on Back", async ({ page }) => {
    await page.goto("/roadmap/new");
    await waitForBuilder(page);
    await page.getByRole("button", { name: /Continue/ }).click();
    await expect(page.getByText("Enter the role you're aiming for.")).toBeVisible();

    await page.locator("#role").fill("UX researcher");
    await page.getByRole("button", { name: /Continue/ }).click();
    await expect(page.getByText("Step 2 of 4")).toBeVisible();
    await page.getByRole("button", { name: /Continue/ }).click();
    await expect(page.getByText("Add your CV to continue.")).toBeVisible();

    await page.getByText("Paste the text").click();
    await page.locator("#cvPaste").fill(SAMPLE_CV);
    await page.getByRole("button", { name: /Continue/ }).click();
    await expect(page.getByText("Step 3 of 4")).toBeVisible();

    await page.getByRole("button", { name: /Back/ }).click();
    await expect(page.getByText("Step 2 of 4")).toBeVisible();
    await expect(page.locator("#cvPaste")).toHaveValue(SAMPLE_CV);
    await page.getByRole("button", { name: /Back/ }).click();
    await expect(page.getByText("Step 1 of 4")).toBeVisible();
    await expect(page.locator("#role")).toHaveValue("UX researcher");

    // Skip ahead to the email step and check its validation.
    await page.getByRole("button", { name: /Continue/ }).click();
    await expect(page.getByText("Step 2 of 4")).toBeVisible();
    await page.getByRole("button", { name: /Continue/ }).click();
    await expect(page.getByText("Step 3 of 4")).toBeVisible();
    await page.getByRole("button", { name: /^Next/ }).click();
    await expect(page.getByText("Step 4 of 4")).toBeVisible();
    await page.locator("#email").fill("not-an-email");
    await page.getByRole("button", { name: /Build my roadmap/ }).click();
    await expect(page.getByText("Enter a valid email address.")).toBeVisible();
  });

  test("roadmap appears straight away, clicks through, and a copy is emailed", async ({ page, browser }) => {
    const email = uniqueEmail("flow");
    await buildRoadmap(page, { email, optIn: true });

    // The building screen shows first, then the result.
    await waitForResult(page);
    const resultUrl = page.url().split("?")[0];

    // Click through every view with the Next button.
    for (const heading of ["Gaps to close", "Projects that would prove them", "Already in your CV", "What next"]) {
      await page.locator("a.btn-primary").last().click();
      await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
      await expect(page.getByRole("heading", { level: 1, name: heading })).toBeInViewport();
    }
    await expect(page.getByText(`We’ve emailed a copy to ${email}`)).toBeVisible();

    // The email is in the dev outbox, with a sign-in link back to this roadmap.
    await page.goto("/dev/emails");
    const entry = page.getByRole("link", { name: new RegExp(`to ${email.replace("+", "\\+")}`) });
    await expect(entry).toBeVisible();
    await entry.click();
    const frame = page.frameLocator("iframe");
    await expect(frame.getByText("Your roadmap to Junior data analyst")).toBeVisible();
    const signIn = await frame.getByRole("link", { name: "See your full roadmap" }).getAttribute("href");
    expect(signIn).toContain("/auth/dev?email=");

    // A different browser can't see it; it is sent to log in instead.
    const other = await browser.newContext();
    const otherPage = await other.newPage();
    await otherPage.goto(resultUrl);
    await expect(otherPage).toHaveURL(/\/login\?next=/);

    // Following the email link in that browser signs in and opens the roadmap.
    await otherPage.goto(signIn!);
    await expect(otherPage.getByRole("heading", { level: 1, name: /Your roadmap to/ })).toBeVisible();
    await other.close();
  });

  test("the roadmap email is sent once, however many times the page loads", async ({ page }) => {
    const email = uniqueEmail("once");
    await buildRoadmap(page, { email });
    await waitForResult(page);
    await page.reload();
    await page.reload();
    await page.goto("/dev/emails");
    await expect(page.getByRole("link", { name: new RegExp(`to ${email.replace("+", "\\+")}`) })).toHaveCount(1);
  });

  test("rate limit: a fourth roadmap for the same email on one day is refused", async ({ page }) => {
    const email = uniqueEmail("limit");
    for (let i = 0; i < 3; i++) {
      await buildRoadmap(page, { email, role: `Role ${i}` });
      await page.waitForURL(/\/roadmap\/[0-9a-f-]{36}/);
    }
    await buildRoadmap(page, { email, role: "Role 4" });
    await expect(page.getByText("You've made the most roadmaps we allow in a day.")).toBeVisible();
  });

  test("unsubscribe rejects a tampered token", async ({ page }) => {
    await page.goto("/api/email/unsubscribe?token=abc.def");
    await expect(page.getByRole("heading", { name: "That link didn't work" })).toBeVisible();
  });
});
