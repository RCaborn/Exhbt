import { expect, test } from "@playwright/test";
import { ENTITLEMENTS, PLAN_NAMES } from "../lib/entitlements";
import { portfolioHost } from "../lib/hosts";
import { buildRoadmap, SAMPLE_CV, uniqueEmail, waitForBuilder, waitForResult } from "./helpers";

test.describe("Phase 1: from the home page to a roadmap", () => {
  test("home job field pre-fills the builder and starts at the situation step", async ({ page }) => {
    await page.goto("/");
    await page.locator("#start-hero").fill("Junior data analyst");
    await page.locator("form:has(#start-hero) button[type=submit]").click();
    await page.waitForURL(/\/roadmap\/new\?role=/);
    await expect(page.getByText("Step 2 of 4")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Where are you now?" })).toBeVisible();
  });

  test("/start is just the search bar, and carries ad tracking into the builder", async ({ page }) => {
    await page.goto("/start?utm_source=test", { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { level: 1, name: "What job do you want?" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Main" })).toHaveCount(0);
    await page.locator("#start-direct").fill("Junior data analyst");
    await page.locator("form:has(#start-direct) button[type=submit]").click();
    await expect(page).toHaveURL(/\/roadmap\/new\?.*utm_source=test/);
    await expect(page.getByText("Step 2 of 4")).toBeVisible();
  });

  test("home: search-first hero, example exhbt further down, no removed sections", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("No card")).toHaveCount(0);
    await expect(page.getByText(/A CV says .analytical.\. An exhbt/)).toHaveCount(0);
    await expect(page.getByText("The same layout, every time")).toHaveCount(0);
    // A portfolio of example tiles sits below the hero; each tile has its methodology strip.
    const tiles = page.locator("#example-portfolio > li");
    await expect(tiles).toHaveCount(4);
    const heroBottom = (await page.locator("form:has(#start-hero)").boundingBox())!;
    expect((await tiles.first().boundingBox())!.y).toBeGreaterThan(heroBottom.y + heroBottom.height);
    await expect(tiles.first().getByRole("list", { name: "Methodology" })).toBeVisible();
  });

  test("demo portfolio: header, tiles, and a tile opens the full exhbt with its flow diagram", async ({ page }) => {
    await page.goto("/demo");
    await expect(page.getByRole("heading", { level: 1, name: "Amara Okafor" })).toBeVisible();
    await expect(page.getByText(portfolioHost("amara"))).toBeVisible();
    await page.getByRole("link", { name: /Forecasting A&E waiting times/ }).click();
    await expect(page).toHaveURL(/\/demo\/ae-forecast$/);
    await expect(page.getByRole("heading", { level: 1, name: /Forecasting A&E/ })).toBeVisible();
    await expect(page.getByRole("list", { name: "Methodology" }).getByRole("listitem")).toHaveCount(5);
  });

  test("brand: logo in the header, catalogue numbers, seal links to the checks, sign-off", async ({ page }) => {
    await page.goto("/demo");
    await expect(page.getByRole("banner").getByRole("link", { name: "Exhbt home" })).toBeVisible();
    await expect(page.locator("[data-catalogue]")).toHaveText(["EX·01", "EX·02", "EX·03", "EX·04"]);
    const signOff = page.getByRole("complementary", { name: "Made with exhbt" });
    await expect(signOff.getByRole("link", { name: /Build your own roadmap/ })).toHaveAttribute("href", "/start");

    // The full exhbt keeps its number, and its seal explains itself on the employer guide.
    await page.goto("/demo/ae-forecast");
    await expect(page.locator("article [data-catalogue]")).toHaveText("EX·02");
    await expect(page.getByRole("link", { name: /Amara Okafor’s portfolio/ })).toHaveAttribute("href", "/demo");
    await page.getByRole("link", { name: /Checked by exhbt/ }).click();
    await expect(page).toHaveURL(/\/how-to-read-an-exhbt#checks$/);
    await expect(page.locator("#checks")).toBeInViewport();
  });

  test("footer links to the quick-start page", async ({ page }) => {
    await page.goto("/pricing");
    await expect(page.getByRole("contentinfo").getByRole("link", { name: "Quick start" })).toHaveAttribute("href", "/start");
  });

  test("builder validates each step and keeps answers on Back", async ({ page }) => {
    await page.goto("/roadmap/new");
    await waitForBuilder(page);
    await page.getByRole("button", { name: /Continue/ }).click();
    await expect(page.getByText("Describe the job you want.")).toBeVisible();

    await page.locator("#role").fill("UX researcher in a health tech company");
    await page.getByRole("button", { name: /Continue/ }).click();
    await expect(page.getByText("Step 2 of 4")).toBeVisible();
    await page.getByRole("button", { name: /Continue/ }).click();
    await expect(page.getByText("Choose the option closest to where you are now.")).toBeVisible();

    await page.getByLabel("At university").check();
    await page.getByRole("button", { name: /Continue/ }).click();
    await expect(page.getByText("Step 3 of 4")).toBeVisible();
    await page.getByRole("button", { name: /Continue/ }).click();
    await expect(page.getByText("Tell us a little about your education or skills")).toBeVisible();

    // The CV is optional and lives behind a toggle; pasted text counts.
    await page.getByRole("button", { name: /Add your CV/ }).click();
    await page.getByText("Paste the text").click();
    await page.locator("#cvPaste").fill(SAMPLE_CV);
    await page.getByRole("button", { name: /Continue/ }).click();
    await expect(page.getByText("Step 4 of 4")).toBeVisible();

    await page.getByRole("button", { name: /Back/ }).click();
    await expect(page.getByText("Step 3 of 4")).toBeVisible();
    await expect(page.locator("#cvPaste")).toHaveValue(SAMPLE_CV);
    await page.getByRole("button", { name: /Back/ }).click();
    await expect(page.getByText("Step 2 of 4")).toBeVisible();
    await expect(page.getByLabel("At university")).toBeChecked();
    await page.getByRole("button", { name: /Back/ }).click();
    await expect(page.getByText("Step 1 of 4")).toBeVisible();
    await expect(page.locator("#role")).toHaveValue("UX researcher in a health tech company");

    // Forward again to the email step and check its validation.
    for (const n of [2, 3, 4]) {
      await page.getByRole("button", { name: /Continue/ }).click();
      await expect(page.getByText(`Step ${n} of 4`)).toBeVisible();
    }
    await page.locator("#email").fill("not-an-email");
    await page.getByRole("button", { name: /Build my roadmap/ }).click();
    await expect(page.getByText("Enter a valid email address.")).toBeVisible();
  });

  test("the jobs dataset shapes the gaps (seed data in development)", async ({ page }) => {
    await buildRoadmap(page, { email: uniqueEmail("jobs"), role: "Junior data analyst in the NHS" });
    await waitForResult(page);
    await page.goto(`${page.url().split("?")[0]}?view=gaps`);
    await expect(page.getByText("SQL", { exact: true })).toBeVisible();
  });

  test("pricing shows Free, Plus and Pro, each paid tier with its own waitlist", async ({ page }) => {
    await page.goto("/pricing", { waitUntil: "networkidle" });
    for (const tier of [PLAN_NAMES.free, PLAN_NAMES.plus, PLAN_NAMES.premium]) {
      await expect(page.getByRole("heading", { level: 2, name: tier, exact: true })).toBeVisible();
    }
    await page.locator("#waitlist-pricing-plus").fill(`wait+${Date.now()}@example.com`);
    await page.locator("section#plus").getByRole("button", { name: "Join the waitlist" }).click();
    await expect(page.locator("section#plus").getByText("You’re on the list.")).toBeVisible();
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
    // Titled with the matched job from the jobs data (seed in development).
    await expect(frame.getByText(/^Your roadmap to /).first()).toBeVisible();
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

  test("free plan: a roadmap past the monthly limit is refused", async ({ page }) => {
    const email = uniqueEmail("limit");
    const limit = ENTITLEMENTS.free.roadmapsPer30Days;
    for (let i = 0; i < limit; i++) {
      await buildRoadmap(page, { email, role: `Role ${i}` });
      await page.waitForURL(/\/roadmap\/[0-9a-f-]{36}/);
    }
    await buildRoadmap(page, { email, role: "One more" });
    const noun = limit === 1 ? "roadmap" : "roadmaps";
    await expect(page.getByText(`You've used this month's ${limit} free ${noun}.`)).toBeVisible();
  });

  test("unsubscribe rejects a tampered token", async ({ page }) => {
    await page.goto("/api/email/unsubscribe?token=abc.def");
    await expect(page.getByRole("heading", { name: "That link didn't work" })).toBeVisible();
  });
});
