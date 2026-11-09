import { expect, test, type Locator } from "@playwright/test";
import { ENTITLEMENTS, PLAN_NAMES } from "../lib/entitlements";
import { portfolioHost } from "../lib/hosts";
import { buildRoadmap, CV_WITH_CONTACT, SAMPLE_CV, uniqueEmail, unlockProjects, waitForBuilder, waitForResult } from "./helpers";

test.describe("Phase 1: from the home page to a roadmap", () => {
  test("home job field pre-fills the builder and starts at the CV step", async ({ page }) => {
    await page.goto("/");
    await page.locator("#start-hero").fill("Junior data analyst");
    await page.locator("form:has(#start-hero) button[type=submit]").click();
    await page.waitForURL(/\/roadmap\/new\?role=/);
    await expect(page.getByText("Step 2 of 3")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Add your CV" })).toBeVisible();
  });

  test("/start is just the search bar, and carries ad tracking into the builder", async ({ page }) => {
    await page.goto("/start?utm_source=test", { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { level: 1, name: "What job do you want?" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Main" })).toHaveCount(0);
    await page.locator("#start-direct").fill("Junior data analyst");
    await page.locator("form:has(#start-direct) button[type=submit]").click();
    await expect(page).toHaveURL(/\/roadmap\/new\?.*utm_source=test/);
    await expect(page.getByText("Step 2 of 3")).toBeVisible();
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

  test("home: an example skills chart, labelled as fictional, with its data in a table", async ({ page }) => {
    await page.goto("/");
    const section = page.locator("section[aria-labelledby=gaps-example]");
    await expect(section.getByRole("heading", { level: 2 })).toBeVisible();
    await expect(section.getByText("Example: Amara is fictional.").first()).toBeVisible();
    const now = section.getByRole("table", { name: /Amara now/ });
    await expect(now.getByRole("row", { name: /Dashboards 0 of 4 3 of 4/ })).toBeAttached();
    const after = section.getByRole("table", { name: /After the two suggested projects/ });
    await expect(after.getByRole("row", { name: /Dashboards 0 of 4 3 of 4/ })).toBeAttached();
    // Excel isn't covered by a project, so it stays where it is.
    await expect(after.getByRole("row", { name: /Excel 2 of 4 2 of 4/ })).toBeAttached();

    // The good and the bad, in words: biggest shortfalls first, then what already meets the job.
    expect(await listItems(section.getByRole("list", { name: "Level up next" }).first())).toEqual(["Dashboards", "SQL", "Excel"]);
    expect(await listItems(section.getByRole("list", { name: "In the bag" }).first())).toEqual(["Python", "Statistics"]);
    // After the projects, only Excel is still short.
    expect(await listItems(section.getByRole("list", { name: "Level up next" }).nth(1))).toEqual(["Excel"]);
    // No numbers on the charts.
    await expect(section.getByText(/\b(now|job|you) \d\b|\d → \d/)).toHaveCount(0);
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
    await expect(page.getByText("Step 2 of 3")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Add your CV" })).toBeVisible();

    // The CV step can be skipped; then step 3 needs a situation and some education or skills.
    await page.getByRole("button", { name: "Skip for now" }).click();
    await expect(page.getByText("Step 3 of 3")).toBeVisible();
    await page.getByRole("button", { name: /See my roadmap/ }).click();
    await expect(page.getByText("Choose the option closest to where you are now.")).toBeVisible();
    await expect(page.getByText("Add your education or skills, or go back and add your CV.")).toBeVisible();
    // No email in the builder: it's asked for at the project ideas.
    await expect(page.locator("input[type=email]")).toHaveCount(0);

    // Go back and add the CV instead: pasted text counts, and step 3 then only needs the situation.
    await page.getByRole("button", { name: /Back/ }).click();
    await expect(page.getByText("Step 2 of 3")).toBeVisible();
    await page.getByText("Paste", { exact: true }).click();
    await page.locator("#cvPaste").fill(SAMPLE_CV);
    await expect(page.getByRole("button", { name: "Skip for now" })).toHaveCount(0);
    await page.getByRole("button", { name: /Continue/ }).click();
    await expect(page.getByText("Step 3 of 3")).toBeVisible();
    await expect(page.getByText("Got your CV. Add anything it misses.")).toBeVisible();
    await page.getByLabel("At university").check();

    await page.getByRole("button", { name: /Back/ }).click();
    await expect(page.getByText("Step 2 of 3")).toBeVisible();
    await expect(page.locator("#cvPaste")).toHaveValue(SAMPLE_CV);
    await page.getByRole("button", { name: /Back/ }).click();
    await expect(page.getByText("Step 1 of 3")).toBeVisible();
    await expect(page.locator("#role")).toHaveValue("UX researcher in a health tech company");

    // Forward again: answers are still there.
    for (const n of [2, 3]) {
      await page.getByRole("button", { name: /Continue/ }).click();
      await expect(page.getByText(`Step ${n} of 3`)).toBeVisible();
    }
    await expect(page.getByLabel("At university")).toBeChecked();
  });

  test("the jobs dataset shapes the gaps (seed data in development)", async ({ page }) => {
    await buildRoadmap(page, { role: "Junior data analyst in the NHS" });
    await waitForResult(page);
    await page.goto(`${page.url().split("?")[0]}?view=gaps`);
    await expect(page.getByRole("list", { name: "Gaps to close" }).getByText("SQL", { exact: true })).toBeVisible();
  });

  test("the skills radar shows the gaps, then where the projects would take you", async ({ page }) => {
    await buildRoadmap(page, { role: "Junior data analyst", withCv: true });
    await waitForResult(page);
    const base = page.url().split("?")[0];

    // Development placeholder roadmap: SQL shows some evidence (1), Excel none, needed level 3.
    await page.goto(`${base}?view=gaps`);
    const now = page.getByRole("table", { name: "You now, against what the job asks for" });
    await expect(now.getByRole("row", { name: "SQL 1 of 4 3 of 4" })).toBeAttached();
    await expect(now.getByRole("row", { name: "Excel 0 of 4 3 of 4" })).toBeAttached();
    await expect(page.getByText(/Skills picked by AI/).first()).toBeVisible();
    // Biggest shortfalls first (Excel and Data visualisation at 0, SQL at 1), then the skills already at the level.
    expect(await listItems(page.getByRole("list", { name: "Level up next" }))).toEqual(["Excel", "Data visualisation", "SQL"]);
    expect(await listItems(page.getByRole("list", { name: "In the bag" }))).toEqual([
      "Python or R",
      "Statistics",
      "Dashboards (Power BI or Tableau)",
    ]);
    // No numbers on the chart: the levels live in the hidden table only.
    await expect(page.locator("figure").getByText(/\b(now|job|you) \d\b|\d → \d/)).toHaveCount(0);

    // The placeholder projects close SQL and Excel, so both rise to 3; Data visualisation stays at 0.
    await unlockProjects(page, { email: uniqueEmail("radar") });
    await expect(page.getByRole("heading", { level: 2, name: "When you’ve finished these projects" })).toBeVisible();
    const after = page.getByRole("table", { name: "You now, against where the projects would take you" });
    await expect(after.getByRole("row", { name: "SQL 1 of 4 3 of 4" })).toBeAttached();
    await expect(after.getByRole("row", { name: "Excel 0 of 4 3 of 4" })).toBeAttached();
    await expect(after.getByRole("row", { name: "Data visualisation 0 of 4 0 of 4" })).toBeAttached();
    // Judged on the after levels: SQL and Excel join the bag; Data visualisation is still short.
    expect(await listItems(page.getByRole("list", { name: "Level up next" }))).toEqual(["Data visualisation"]);
    expect(await listItems(page.getByRole("list", { name: "In the bag" }))).toEqual(["SQL", "Excel", "Python or R"]);

    // Neither chart widens the page on a small phone.
    await page.setViewportSize({ width: 375, height: 812 });
    for (const view of ["gaps", "projects"]) {
      await page.goto(`${base}?view=${view}`);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      expect(overflow, view).toBe(false);
    }
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

  test("roadmap appears straight away, clicks through to the gate, and a copy is emailed", async ({ page, browser }) => {
    const email = uniqueEmail("flow");
    await buildRoadmap(page);

    // The building screen shows first, then the result, with no email asked for yet.
    await waitForResult(page);
    const resultUrl = page.url().split("?")[0];

    // Click through the free views with the Next button, up to the project-ideas gate.
    for (const heading of ["Gaps to close", "Already in your CV", "Your project ideas are ready"]) {
      await page.locator("a.next-view").click();
      await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
      await expect(page.getByRole("heading", { level: 1, name: heading })).toBeInViewport();
    }
    // The gate is the way on: no Next button past it.
    await expect(page.locator("a.next-view")).toHaveCount(0);

    await unlockProjects(page, { email, name: "Amara Okafor", optIn: true });
    await expect(page.getByRole("heading", { level: 1, name: "Projects that would prove them" })).toBeVisible();
    await page.locator("a.next-view").click();
    await expect(page.getByRole("heading", { level: 1, name: "What next" })).toBeVisible();
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

    // Following the email link in that browser signs in and opens the roadmap, ideas included.
    await otherPage.goto(signIn!);
    await expect(otherPage.getByRole("heading", { level: 1, name: /Your roadmap to/ })).toBeVisible();
    await otherPage.goto(`${resultUrl}?view=projects`);
    await expect(otherPage.getByRole("heading", { level: 1, name: "Projects that would prove them" })).toBeVisible();
    await other.close();
  });

  test("the roadmap email is sent once, however many times the page loads", async ({ page }) => {
    const email = uniqueEmail("once");
    await buildRoadmap(page);
    await waitForResult(page);
    await unlockProjects(page, { email });
    await expect(page.getByRole("heading", { level: 1, name: "Projects that would prove them" })).toBeVisible();
    await page.reload();
    await page.reload();
    await page.goto("/dev/emails");
    await expect(page.getByRole("link", { name: new RegExp(`to ${email.replace("+", "\\+")}`) })).toHaveCount(1);
  });

  test("free plan: past the monthly limit, the gate refuses the ideas", async ({ page }) => {
    const email = uniqueEmail("limit");
    const limit = ENTITLEMENTS.free.roadmapsPer30Days;
    for (let i = 0; i < limit; i++) {
      await buildRoadmap(page, { role: `Role ${i}` });
      await waitForResult(page);
      await unlockProjects(page, { email });
      await expect(page.getByRole("heading", { level: 1, name: "Projects that would prove them" })).toBeVisible();
    }
    await buildRoadmap(page, { role: "One more" });
    await waitForResult(page);
    await unlockProjects(page, { email });
    const noun = limit === 1 ? "roadmap" : "roadmaps";
    await expect(page.getByText(`You've used this month's ${limit} free ${noun}.`)).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: "Your project ideas are ready" })).toBeVisible();
  });

  test("the gate prefills name, email and LinkedIn from the CV, and keeps what's typed on an error", async ({ page }) => {
    await buildRoadmap(page, { cv: CV_WITH_CONTACT });
    await waitForResult(page);
    await page.goto(`${page.url().split("?")[0]}?view=projects`);
    await expect(page.getByText("From your CV. Change anything that’s wrong.")).toBeVisible();
    await expect(page.getByLabel("Name")).toHaveValue("Amara Okafor");
    await expect(page.getByLabel("Email", { exact: true })).toHaveValue("amara.okafor@example.com");
    await expect(page.getByLabel(/LinkedIn/)).toHaveValue("https://www.linkedin.com/in/amara-okafor");

    await page.getByLabel("Name").fill("");
    await page.getByLabel(/LinkedIn/).fill("not a profile");
    await page.getByRole("button", { name: "Show my projects" }).click();
    await expect(page.getByText("Enter your name.")).toBeVisible();
    await expect(page.getByText(/Use your LinkedIn profile address/)).toBeVisible();
    await expect(page.getByLabel(/LinkedIn/)).toHaveValue("not a profile");

    await page.getByLabel("Name").fill("Amara Okafor");
    await page.getByLabel("Email", { exact: true }).fill(uniqueEmail("gate"));
    await page.getByLabel(/LinkedIn/).fill("linkedin.com/in/amara-okafor");
    await page.getByRole("button", { name: "Show my projects" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Projects that would prove them" })).toBeVisible();
  });

  test("the plan: swap ideas one at a time, steered by a note, until it's your plan", async ({ page }) => {
    await buildRoadmap(page, { withCv: true });
    await waitForResult(page);
    await unlockProjects(page, { email: uniqueEmail("plan") });
    const ideas = page.getByRole("list", { name: "Project ideas" });
    await expect(ideas.getByRole("listitem")).toHaveCount(3);
    const status = page.locator("#swap-status");
    const limit = ENTITLEMENTS.free.projectSwapsPerRoadmap;
    await expect(status).toHaveText(`${limit} swaps left`);

    // Swap the second idea with a note: only that one changes, and the note clears.
    await page.getByLabel(/Make some tweaks/).fill("use more real data");
    await page.getByRole("button", { name: "Swap: Placeholder project 2" }).click();
    await expect(ideas.getByRole("listitem").nth(1)).toContainText("Swapped idea 1: use more real data");
    await expect(ideas.getByRole("listitem").nth(0)).toContainText("Placeholder project 1");
    await expect(ideas.getByRole("listitem").nth(2)).toContainText("Placeholder project 3");
    await expect(status).toHaveText(`${limit - 1} swaps left`);
    await expect(page.getByLabel(/Make some tweaks/)).toHaveValue("");

    // Swaps without a note; the last one settles the plan.
    const order = ["Placeholder project 1", "Placeholder project 3"];
    for (let round = 2; round <= limit; round++) {
      await page.getByRole("button", { name: `Swap: ${order[round - 2]}` }).click();
      if (round < limit) await expect(ideas.getByText(`Swapped idea ${round}`, { exact: true })).toBeVisible();
    }
    await expect(page.getByRole("heading", { level: 1, name: "Your plan" })).toBeVisible();
    const plan = page.getByRole("list", { name: "Your plan" });
    await expect(plan.getByRole("listitem")).toHaveCount(3);
    await expect(plan.getByText(`Swapped idea ${limit}`, { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Swap/ })).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 2, name: "When you’ve finished your plan" })).toBeVisible();
  });

  test("the plan: keeping it early ends the swaps", async ({ page }) => {
    await buildRoadmap(page);
    await waitForResult(page);
    await unlockProjects(page, { email: uniqueEmail("keep") });
    await page.getByRole("button", { name: "Keep this plan" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Your plan" })).toBeVisible();
    await expect(page.getByRole("list", { name: "Your plan" }).getByRole("listitem")).toHaveCount(3);
    await expect(page.getByRole("button", { name: /^Swap/ })).toHaveCount(0);
  });

  test("unsubscribe rejects a tampered token", async ({ page }) => {
    await page.goto("/api/email/unsubscribe?token=abc.def");
    await expect(page.getByRole("heading", { name: "That link didn't work" })).toBeVisible();
  });
});

/** The text of each item in a list, in order, once the list is on screen. */
async function listItems(list: Locator): Promise<string[]> {
  await expect(list).toBeVisible();
  return (await list.getByRole("listitem").allTextContents()).map((t) => t.trim());
}
