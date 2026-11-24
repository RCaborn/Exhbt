import { expect, test, type Locator } from "@playwright/test";
import { ENTITLEMENTS, PLAN_NAMES } from "../lib/entitlements";
import { portfolioHost } from "../lib/hosts";
import { buildRoadmap, CV_WITH_CONTACT, SAMPLE_CV, uniqueEmail, unlockProjects, waitForBuilder, waitForResult } from "./helpers";

test.describe("Phase 1: from the home page to a roadmap", () => {
  test("the home hero goes to building an exhbt", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Build your exhbt" }).click();
    await page.waitForURL(/\/login\?next=/);
    await expect(page.getByRole("heading", { level: 1, name: "Log in" })).toBeVisible();
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

  test("home: search-first hero, one real exhbt further down, no tiles", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("No card")).toHaveCount(0);
    await expect(page.getByText(/A CV says .analytical.\. An exhbt/)).toHaveCount(0);
    await expect(page.getByText("The same layout, every time")).toHaveCount(0);
    // One example exhbt below the hero, drawn by the real exhbt page in a frame at its address; the
    // old tile grid, its catalogue numbers and the editor excerpt are gone (Rory, 16 Nov 2026).
    const example = page.locator("section[aria-labelledby=one-exhbt]");
    await expect(example.getByRole("heading", { level: 2, name: "One project, one page" })).toBeVisible();
    const heroBottom = (await page.getByRole("button", { name: "Build your exhbt" }).boundingBox())!;
    expect((await example.boundingBox())!.y).toBeGreaterThan(heroBottom.y + heroBottom.height);
    await expect(example.locator("[data-exhbt-page]")).toHaveCount(1);
    await expect(example.getByText(`${portfolioHost("amara")}/gp-reminders`)).toBeVisible();
    await expect(page.locator("#example-portfolio, [data-catalogue]")).toHaveCount(0);
    await expect(page.getByText(/EX·\d/)).toHaveCount(0);
    await expect(example.getByRole("link", { name: "Open this exhbt" })).toHaveAttribute("href", "/demo/gp-reminders");
  });

  test("home: an example skills chart, labelled as fictional, with its data in a table", async ({ page }) => {
    await page.goto("/");
    const section = page.locator("section[aria-labelledby=gaps-example]");
    await expect(section.getByRole("heading", { level: 2 })).toBeVisible();
    await expect(section.getByText("Example: Amara is fictional.")).toBeVisible();
    // One radar, not two. Its table holds Now, After the projects and what the job asks for.
    await expect(section.getByRole("table")).toHaveCount(1);
    const table = section.getByRole("table", { name: /Amara/ });
    await expect(table.getByRole("row", { name: "Skill Now After the projects What the job asks for" })).toBeAttached();
    await expect(table.getByRole("row", { name: "Dashboards 0 of 4 2 of 4 2 of 4" })).toBeAttached();
    // Statistics isn't covered by a project, so it stays where it is.
    await expect(table.getByRole("row", { name: "Statistics 2 of 4 2 of 4 3 of 4" })).toBeAttached();

    // Now: everything short of the job is listed, biggest shortfall first, then what already meets it.
    expect(await listItems(section.getByRole("list", { name: "Level up next" }))).toEqual(["SQL", "Dashboards", "Data visualisation", "Statistics"]);
    expect(await listItems(section.getByRole("list", { name: "In the bag" }))).toEqual(["Python", "Excel"]);
    // After the projects, only Statistics is still short.
    await section.getByRole("button", { name: "After the projects" }).click();
    expect(await listItems(section.getByRole("list", { name: "Level up next" }))).toEqual(["Statistics"]);
    expect(await listItems(section.getByRole("list", { name: "In the bag" }))).toEqual(["Python", "SQL", "Data visualisation", "Excel", "Dashboards"]);
    // No numbers on the chart.
    await expect(section.getByText(/\b(now|job|you) \d\b|\d → \d/)).toHaveCount(0);
  });

  test("demo portfolio: the real portfolio home, and a card opens the full exhbt with its flowchart", async ({ page }) => {
    await page.goto("/demo");
    await expect(page.getByText("Example portfolio.")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: "Amara Okafor" })).toBeVisible();
    await expect(page.locator("[data-portfolio-home]")).toHaveCount(1);
    await expect(page.getByText(portfolioHost("amara"), { exact: true })).toBeVisible();
    await page.getByRole("link", { name: /Can open NHS data forecast A&E/ }).click();
    await expect(page).toHaveURL(/\/demo\/ae-forecast$/);
    await expect(page.getByText("Example exhbt.")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: /Can open NHS data forecast A&E/ })).toBeVisible();
    await expect(page.getByRole("list", { name: "Methodology" }).getByRole("listitem")).toHaveCount(5);
  });

  test("brand: logo in the header, no catalogue numbers on the new pages, checks link to the guide", async ({ page }) => {
    await page.goto("/demo");
    await expect(page.getByRole("banner").getByRole("link", { name: "Exhbt home" })).toBeVisible();
    // The portfolio home and the exhbt page carry no catalogue numbers (decisions 0016 and 0022).
    await expect(page.locator("[data-catalogue]")).toHaveCount(0);
    // The demo sits inside the marketing layout, so it has the site footer and no second sign-off.
    await expect(page.getByRole("complementary", { name: "Made with exhbt" })).toHaveCount(0);

    // The full exhbt leads back to the portfolio, and its check explains itself on the employer guide.
    await page.goto("/demo/ae-forecast");
    await expect(page.locator("article [data-catalogue]")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "All of Amara's work" }).first()).toHaveAttribute("href", "/demo");
    await page.getByRole("link", { name: /Checked by exhbt/ }).click();
    await expect(page).toHaveURL(/\/how-to-read-an-exhbt#checks$/);
    await expect(page.locator("#checks")).toBeInViewport();
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

  test("the skills radar is one chart: now against the job, with a switch to after the projects once they're shown", async ({ page }) => {
    await buildRoadmap(page, { role: "Junior data analyst", withCv: true });
    await waitForResult(page);
    const base = page.url().split("?")[0];
    const radar = () => page.locator("figure");

    // Before the details gate there is no plan to look at, so no switch: Now only.
    // Development placeholder roadmap: the job asks 4, 3, 3, 2, 2, 1. SQL shows some evidence (1), Excel and Data visualisation none.
    await page.goto(`${base}?view=gaps`);
    await expect(radar().getByRole("table")).toHaveCount(1);
    await expect(page.getByRole("button", { name: "After the projects" })).toHaveCount(0);
    const table = page.getByRole("table", { name: "You, against what the job asks for" });
    await expect(table.getByRole("row", { name: "Skill Now What the job asks for" })).toBeAttached();
    await expect(table.getByRole("row", { name: "SQL 1 of 4 4 of 4" })).toBeAttached();
    await expect(table.getByRole("row", { name: "Excel 0 of 4 3 of 4" })).toBeAttached();
    await expect(page.getByText(/Skills picked by AI/).first()).toBeVisible();
    // The job's levels vary: it is not a regular shape.
    expect(await radar().getByRole("row").count()).toBeGreaterThan(3);
    // Every skill below the job is listed, biggest shortfall first, then every skill that meets it.
    expect(await listItems(page.getByRole("list", { name: "Level up next" }))).toEqual(["SQL", "Excel", "Data visualisation"]);
    expect(await listItems(page.getByRole("list", { name: "In the bag" }))).toEqual([
      "Python or R",
      "Statistics",
      "Dashboards (Power BI or Tableau)",
    ]);
    // No numbers on the chart: the levels live in the hidden table only.
    await expect(page.locator("figure").getByText(/\b(now|job|you) \d\b|\d → \d/)).toHaveCount(0);

    // The placeholder projects close SQL and Excel, so each rises to what the job asks (4 and 3); Data visualisation stays at 0.
    await unlockProjects(page, { email: uniqueEmail("radar") });
    await expect(page.getByRole("button", { name: /^Swap/ }).first()).toBeVisible();
    await page.goto(`${base}?view=gaps`);
    await expect(page.getByRole("button", { name: "Now" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("button", { name: "After the projects" })).toHaveAttribute("aria-pressed", "false");
    const both = page.getByRole("table", { name: "You, against what the job asks for" });
    await expect(both.getByRole("row", { name: "Skill Now After the projects What the job asks for" })).toBeAttached();
    await expect(both.getByRole("row", { name: "SQL 1 of 4 4 of 4 4 of 4" })).toBeAttached();
    await expect(both.getByRole("row", { name: "Excel 0 of 4 3 of 4 3 of 4" })).toBeAttached();
    await expect(both.getByRole("row", { name: "Data visualisation 0 of 4 0 of 4 3 of 4" })).toBeAttached();
    await page.getByRole("button", { name: "After the projects" }).click();
    await expect(page.getByText("If you do the suggested projects.")).toBeVisible();
    expect(await listItems(page.getByRole("list", { name: "Level up next" }))).toEqual(["Data visualisation"]);
    expect(await listItems(page.getByRole("list", { name: "In the bag" }))).toEqual(["Python or R", "SQL", "Excel", "Statistics", "Dashboards (Power BI or Tableau)"]);

    // The Projects page has no second radar, just a way back to this one.
    await page.goto(`${base}?view=projects`);
    await expect(page.locator("figure")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "See what these projects do for your skills" })).toBeVisible();

    // The chart doesn't widen the page on a small phone.
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(`${base}?view=gaps`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(overflow).toBe(false);
  });

  test("pricing shows Free, Plus and Pro, each paid tier with its own waitlist", async ({ page }) => {
    // The live site's waitlist version (Phase 2 off); in development ?preview=waitlist shows it.
    await page.goto("/pricing?preview=waitlist", { waitUntil: "networkidle" });
    for (const tier of [PLAN_NAMES.free, PLAN_NAMES.premium, PLAN_NAMES.max]) {
      await expect(page.getByRole("heading", { level: 2, name: tier, exact: true })).toBeVisible();
    }
    await page.locator("#waitlist-pricing-premium").fill(`wait+${Date.now()}@example.com`);
    await page.locator("section#premium").getByRole("button", { name: "Join the waitlist" }).click();
    await expect(page.locator("section#premium").getByText("You’re on the list.")).toBeVisible();
  });

  test("roadmap appears straight away, clicks through to the gate, and a copy is emailed", async ({ page, browser }) => {
    const email = uniqueEmail("flow");
    await buildRoadmap(page);

    // The building screen shows first, then the result, with no email asked for yet.
    await waitForResult(page);
    const resultUrl = page.url().split("?")[0];

    // Click through the free views with the Next button, up to the project-ideas gate.
    for (const heading of ["Gaps to close", "Already in your CV", "Your project ideas"]) {
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
    await expect(page.getByRole("heading", { level: 1, name: "Your project ideas" })).toBeVisible();
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
    await expect(page.getByRole("link", { name: "See what these projects do for your skills" })).toBeVisible();
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
