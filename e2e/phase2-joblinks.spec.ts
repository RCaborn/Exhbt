import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { EXHBTS_PER_JOB_LINK } from "../lib/entitlements";
import { htmlToListingText, listingTextProblem } from "../lib/jobs/listing-text";
import { mockRank, tidyMatch, REASON_WORDS, INTRO_WORDS, type MatchCandidate } from "../lib/jobs/rank";
import { jobLinkSlug, slugTaken, takenSlugs, JOB_LINK_SLUG_MAX, type SlugSource } from "../lib/slugs";
import type { ExhbtRecord, JobLink } from "../lib/store";

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

// Per-job links (docs/phase-2.md section 8, decision 0008): slugs, matching, and the app pages.

const DESCRIPTION =
  "We are hiring a graduate data analyst for our customer insight team. You will write SQL against our sales data, " +
  "build time series forecasts of weekly demand, and keep the reporting in Excel up to date. Some Python is useful but " +
  "not essential. You will explain what you find to managers who are not analysts, so clear writing matters. The role " +
  "suits someone who checks their numbers and likes turning messy data into a plain answer. Training is provided.";

/** Seeded order (lib/exhbt/sample.ts, via /dev/portfolio): GP reminders first, library footfall second. */
const GP = "Cutting missed GP appointments by changing when reminders are sent";
const FOOTFALL = "Forecasting weekly footfall for a city-centre library";

test.describe("job link slugs", () => {
  test("clean: lower case, hyphens, at most 40 characters, numbered when taken", () => {
    expect(jobLinkSlug("Lloyds Banking Group", "clean", [])).toBe("lloyds-banking-group");
    expect(jobLinkSlug("Lloyds Banking Group", "clean", ["lloyds-banking-group"])).toBe("lloyds-banking-group-2");
    expect(jobLinkSlug("Marks & Spencer", "clean", [])).toBe("marks-and-spencer");
    expect(jobLinkSlug("!!!", "clean", [])).toBe("job");
    const long = jobLinkSlug("The Very Long Name Of A Large International Consulting Partnership", "clean", []);
    expect(long.length).toBeLessThanOrEqual(JOB_LINK_SLUG_MAX);
    expect(long.endsWith("-")).toBe(false);
  });

  test("suffixed: the company and four random letters or digits, unique", () => {
    const s = jobLinkSlug("Lloyds", "suffix", []);
    expect(s).toMatch(/^lloyds-[a-z0-9]{4}$/);
    const long = jobLinkSlug("The Very Long Name Of A Large International Consulting Partnership", "suffix", []);
    expect(long.length).toBeLessThanOrEqual(JOB_LINK_SLUG_MAX);
    expect(long).toMatch(/-[a-z0-9]{4}$/);
    // A taken ending is drawn again: this source gives "aaaa" twice, then "bbbb".
    const seq = [0, 0, 0, 0, 0, 0, 0, 0, 0.03, 0.03, 0.03, 0.03];
    let i = 0;
    expect(jobLinkSlug("Lloyds", "suffix", ["lloyds-aaaa"], () => seq[i++]!)).toBe("lloyds-bbbb");
  });

  test("one slug space: exhbt slugs and job-link slugs both count", async () => {
    const exhbt = (id: string, slug: string | null) => ({ id, slug }) as ExhbtRecord;
    const link = (id: string, slug: string) => ({ id, slug }) as JobLink;
    const source: SlugSource = {
      listExhbts: async () => [exhbt("e1", "gp-reminders"), exhbt("e2", null)],
      listJobLinks: async () => [link("l1", "lloyds-x7k2")],
    };
    expect(await slugTaken("u", "gp-reminders", source)).toBe(true);
    expect(await slugTaken("u", "lloyds-x7k2", source)).toBe(true);
    expect(await slugTaken("u", "lloyds", source)).toBe(false);
    expect([...(await takenSlugs("u", { source, exceptJobLinkId: "l1" }))]).toEqual(["gp-reminders"]);
    // A clean job link avoids an exhbt's slug, and an exhbt's slug would avoid a link's.
    expect(jobLinkSlug("GP Reminders", "clean", await takenSlugs("u", { source }))).toBe("gp-reminders-2");
  });
});

test.describe("matching", () => {
  const candidates: MatchCandidate[] = [
    { id: "a", title: "GP reminders", context: "", skills: ["Python", "pandas", "Logistic regression"], findings: [] },
    { id: "b", title: "Library footfall", context: "", skills: ["SQL", "Time series", "Excel"], findings: [] },
    { id: "c", title: "Union cafe", context: "", skills: ["Process mapping"], findings: [] },
  ];

  test("the stand-in ranks by skills the description names, and says it's a placeholder", () => {
    const r = mockRank(DESCRIPTION, candidates, "Acme");
    expect(r.picks.map((p) => p.exhbtId)).toEqual(["b", "a", "c"]);
    expect(r.picks[0]!.reason).toContain("SQL, Time series, Excel");
    for (const p of r.picks) {
      expect(p.reason).toMatch(/^Placeholder/);
      expect(p.reason.split(/\s+/).length).toBeLessThanOrEqual(REASON_WORDS + 1);
    }
    expect(r.intro).toMatch(/^Placeholder/);
    expect(r.intro.split(/\s+/).length).toBeLessThanOrEqual(INTRO_WORDS + 1);
    // Deterministic.
    expect(mockRank(DESCRIPTION, candidates, "Acme")).toEqual(r);
  });

  test("at most the plan's number of picks", () => {
    const many = Array.from({ length: EXHBTS_PER_JOB_LINK + 3 }, (_, i) => ({ ...candidates[0]!, id: `x${i}` }));
    expect(mockRank(DESCRIPTION, many).picks).toHaveLength(EXHBTS_PER_JOB_LINK);
  });

  test("the model's answer is tidied: unknown or repeated ids go, reasons are clipped, gaps are filled", () => {
    const long = Array.from({ length: 40 }, () => "word").join(" ");
    const r = tidyMatch(
      { picks: [{ exhbtId: "zzz", reason: "made up" }, { exhbtId: "b", reason: long }, { exhbtId: "b", reason: "again" }], intro: long },
      DESCRIPTION,
      candidates,
    );
    expect(r.picks.map((p) => p.exhbtId)).toEqual(["b", "a", "c"]);
    expect(r.picks[0]!.reason.split(/\s+/).length).toBe(REASON_WORDS);
    expect(r.intro.split(/\s+/).length).toBe(INTRO_WORDS);
  });
});

test.describe("reading a listing", () => {
  test("a JavaScript-only page is thin; a JobPosting block is read", () => {
    const shell = `<html><head><script>var x = "${"lots of code ".repeat(200)}"</script></head><body><div id="root"></div><noscript>Enable JavaScript.</noscript></body></html>`;
    expect(listingTextProblem(htmlToListingText(shell))).toBe("thin");

    const posting = { "@type": "JobPosting", title: "Graduate Data Analyst", description: `<p>${DESCRIPTION}</p>` };
    const page = `<html><head><script type="application/ld+json">${JSON.stringify(posting)}</script></head><body><nav>Sign in</nav><p>Cookies</p></body></html>`;
    const text = htmlToListingText(page);
    expect(text.startsWith("Graduate Data Analyst")).toBe(true);
    expect(text).toContain("time series forecasts");
    expect(text).not.toContain("Sign in");
    expect(listingTextProblem(text)).toBeNull();
  });

  test("navigation, scripts and entities are cleaned from a plain page", () => {
    const page = `<html><body><nav>Home Jobs</nav><main><h1>Analyst</h1><p>${DESCRIPTION.replace("&", "&amp;")} Salary &pound;28,000.</p><script>track()</script></main><footer>Privacy</footer></body></html>`;
    const text = htmlToListingText(page);
    expect(text).toContain("Salary £28,000.");
    expect(text).not.toMatch(/Home Jobs|track\(\)|Privacy/);
  });
});

/** A dev user with a username, published exhbts and a plan, signed in on /job-links. */
async function signInAs(page: Page, username: string, plan: "premium" | "max", count = 2) {
  await page.goto(`/dev/portfolio?username=${username}&plan=${plan}&count=${count}`);
  await page.goto(`/auth/dev?email=${username}@example.com&next=/portfolio`);
  await expect(page.getByRole("heading", { level: 2, name: "Job links" })).toBeVisible();
}

async function openNewForm(page: Page) {
  await page.getByRole("link", { name: "New job link" }).click();
  await expect(page.locator("form[data-ready=true]")).toBeAttached();
}

const picks = (page: Page) => page.getByRole("list", { name: "Picks, in order" }).getByRole("listitem");

test.describe("job link pages", () => {
  test("Max: paste a description, check the picks, reorder, edit the intro, switch the address, turn off and on, delete", async ({ page }) => {
    test.slow(); // one long scenario; each page compiles on first visit in the dev server
    await signInAs(page, "jlmax", "max");
    let { violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze();
    expect(violations.map((v) => `list ${v.id}: ${v.nodes.map((n) => n.target).join(", ")}`)).toEqual([]);

    await openNewForm(page);
    await page.getByLabel("Company", { exact: true }).fill("Acme");
    await page.getByLabel("Role title", { exact: true }).fill("Graduate Data Analyst");
    await page.getByLabel("Job description", { exact: true }).fill(DESCRIPTION);
    // The suffixed address is the default.
    await expect(page.getByRole("radio", { name: /With a short code/ })).toBeChecked();
    await page.getByRole("button", { name: "Pick my exhbts" }).click();

    await page.waitForURL(/\/job-links\/[0-9a-f-]{36}$/);
    const editor = page.url();
    await expect(page.getByRole("heading", { level: 1, name: "Acme · Graduate Data Analyst" })).toBeVisible();
    await expect(picks(page)).toHaveCount(2);
    // Footfall shares three skills with the description, so it comes first, with its reason.
    await expect(picks(page).nth(0)).toContainText(FOOTFALL);
    await expect(picks(page).nth(0)).toContainText("SQL, Time series, Excel");
    await expect(picks(page).nth(1)).toContainText(GP);
    await expect(page.getByTestId("job-link-address")).toHaveText(/^jlmax\.exhbt\.co\.uk\/acme-[a-z0-9]{4}$/);

    ({ violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze());
    expect(violations.map((v) => `edit ${v.id}: ${v.nodes.map((n) => n.target).join(", ")}`)).toEqual([]);

    // Reorder.
    await page.getByRole("button", { name: `Move ${FOOTFALL} down` }).click();
    await expect(picks(page).nth(0)).toContainText(GP);
    await page.reload();
    await expect(picks(page).nth(0)).toContainText(GP);
    await expect(picks(page).nth(1)).toContainText(FOOTFALL);

    // Edit the intro (the field is read-only until the page has hydrated).
    await expect(page.locator("form[data-ready=true]")).toBeAttached();
    await page.getByLabel(/A line or two to the employer/).fill("I forecast library footfall and cut missed appointments.");
    await page.getByRole("button", { name: "Save intro" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Saved" })).toBeVisible();
    await page.goto(editor);
    await expect(page.getByLabel(/A line or two to the employer/)).toHaveValue("I forecast library footfall and cut missed appointments.");

    // Remove one, then add it back.
    await page.getByRole("button", { name: `Remove ${GP}` }).click();
    await expect(picks(page)).toHaveCount(1);
    await page.getByLabel("Add an exhbt").selectOption({ label: GP });
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expect(picks(page)).toHaveCount(2);
    await expect(picks(page).nth(1)).toContainText("Added by you.");

    // The clean address, and back.
    await page.getByRole("button", { name: "Use a clean address" }).click();
    await expect(page.getByTestId("job-link-address")).toHaveText("jlmax.exhbt.co.uk/acme");
    await page.getByRole("button", { name: "Use an address with a code" }).click();
    await expect(page.getByTestId("job-link-address")).toHaveText(/^jlmax\.exhbt\.co\.uk\/acme-[a-z0-9]{4}$/);
    const slug = (await page.getByTestId("job-link-address").textContent())!.split("/")[1]!;

    // The preview is the employer's page: heading, intro, tiles in order, each keeping the way back.
    await page.getByRole("link", { name: "Preview the page" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "For Acme · Graduate Data Analyst" })).toBeVisible();
    await expect(page.getByText("I forecast library footfall and cut missed appointments.")).toBeVisible();
    const tiles = page.locator("[data-job-page] ol > li > a[href*='?for=']");
    await expect(tiles).toHaveCount(2);
    await expect(tiles.nth(0)).toContainText(FOOTFALL);
    await expect(tiles.nth(0)).toHaveAttribute("href", `/p/jlmax/library-footfall?for=${slug}`);
    await page.getByRole("link", { name: "Back to editing" }).click();

    // Off and on.
    await page.getByRole("button", { name: "Turn off" }).click();
    await expect(page.getByText("Off", { exact: true })).toBeVisible();
    await page.goto("/job-links");
    await expect(page.getByRole("list", { name: /Your job links/ })).toContainText("Off");
    await page.goto(editor);
    await page.getByRole("button", { name: "Turn on" }).click();
    await expect(page.getByText("Live", { exact: true })).toBeVisible();

    // Delete, after a confirmation.
    await page.getByRole("button", { name: "Delete the link for Acme · Graduate Data Analyst" }).click();
    await page.getByRole("button", { name: "Yes, delete" }).click();
    await page.waitForURL(/\/portfolio/);
    await expect(page.getByRole("list", { name: /Your job links/ })).toHaveCount(0);
  });

  test("Premium sees what job links are and where to upgrade", async ({ page }) => {
    await signInAs(page, "jlprem", "premium", 1);
    await expect(page.getByTestId("upgrade-prompt")).toContainText("Links for each job come with Max.");
    await expect(page.getByRole("link", { name: /^Upgrade to Max/ })).toHaveAttribute("href", "/account/billing");
    await expect(page.getByRole("link", { name: "New job link" })).toHaveCount(0);
    await page.goto("/job-links/new");
    await expect(page.getByTestId("upgrade-prompt")).toContainText("Links for each job come with Max.");
    await expect(page.getByLabel("Company", { exact: true })).toHaveCount(0);
  });

  test("a link that gives only a few lines asks for a paste; a readable one is shown to check", async ({ page }) => {
    await signInAs(page, "jlfetch", "max");
    const origin = new URL(page.url()).origin;
    await openNewForm(page);
    await page.getByLabel("Company", { exact: true }).fill("Acme");
    await page.getByLabel("Role title", { exact: true }).fill("Graduate Data Analyst");
    await page.getByRole("radio", { name: "Use a link" }).check();

    await page.getByLabel("Link to the advert").fill(`${origin}/dev/listing`);
    await page.getByRole("button", { name: "Read the page" }).click();
    const alert = page.getByRole("alert").filter({ hasText: "few lines" });
    await expect(alert).toContainText("We could only read a few lines from that page.");
    await expect(alert).toContainText("paste it instead");
    await alert.getByRole("button", { name: "Paste it instead" }).click();
    await expect(page.getByLabel("Job description", { exact: true })).toBeVisible();
    await expect(page.getByRole("radio", { name: "Paste the job description" })).toBeChecked();

    // A page with a readable advert: the text comes back to check before matching.
    await page.getByRole("radio", { name: "Use a link" }).check();
    await page.getByLabel("Link to the advert").fill(`${origin}/dev/listing?full=1`);
    await page.getByRole("button", { name: "Read the page" }).click();
    const read = page.getByLabel("The description we read");
    await expect(read).toHaveValue(/graduate data analyst to join our customer insight team/);
    await expect(read).not.toHaveValue(/Sign in/);
    await page.getByRole("button", { name: "Pick my exhbts" }).click();
    await page.waitForURL(/\/job-links\/[0-9a-f-]{36}$/);
    await expect(picks(page)).toHaveCount(2);
  });
});

/** The test server's address on a name.localhost host (Chromium resolves *.localhost to loopback). */
const on = (baseURL: string | undefined, name: string) => (baseURL ?? "").replace("//localhost", `//${name}.localhost`);

async function makeLink(page: Page, company: string, role: string, style: "suffix" | "clean" = "suffix") {
  await openNewForm(page);
  await page.getByLabel("Company", { exact: true }).fill(company);
  await page.getByLabel("Role title", { exact: true }).fill(role);
  await page.getByLabel("Job description", { exact: true }).fill(DESCRIPTION);
  if (style === "clean") await page.getByRole("radio", { name: /^Clean/ }).check();
  await page.getByRole("button", { name: "Pick my exhbts" }).click();
  await page.waitForURL(/\/job-links\/[0-9a-f-]{36}$/);
  return page.url();
}

test.describe("the public job page", () => {
  test("name.localhost/<slug> shows the job heading, intro and picks in order; ?for= gives the way back; it is noindex; off is a 404", async ({ page, baseURL }) => {
    await signInAs(page, "jlpub", "max");
    const editor = await makeLink(page, "Acme", "Graduate Data Analyst", "clean");
    await expect(page.getByTestId("job-link-address")).toHaveText("jlpub.exhbt.co.uk/acme");
    // Put the GP exhbt first (the stand-in ranks footfall first) and write the intro, so the order and the words are the person's.
    await page.getByRole("button", { name: `Move ${FOOTFALL} down` }).click();
    await expect(picks(page).nth(0)).toContainText(GP);
    await expect(page.locator("form[data-ready=true]")).toBeAttached();
    await page.getByLabel(/A line or two to the employer/).fill("I cut missed appointments and forecast demand.");
    await page.getByRole("button", { name: "Save intro" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Saved" })).toBeVisible();

    const origin = on(baseURL, "jlpub");
    const res = await page.goto(`${origin}/acme`);
    expect(res?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1, name: "For Acme · Graduate Data Analyst" })).toBeVisible();
    await expect(page.getByText("I cut missed appointments and forecast demand.")).toBeVisible();
    // The picks are the portfolio's cards, in the person's order, each with the AI's reason under it.
    const cards = page.locator("[data-job-page] ol > li[data-card]");
    await expect(cards).toHaveCount(2);
    await expect(cards.nth(0)).toContainText(GP);
    await expect(cards.nth(1)).toContainText(FOOTFALL);
    await expect(cards.nth(1).locator("[data-reason]")).toContainText("SQL, Time series, Excel");
    await expect(cards.nth(0).locator("a")).toHaveAttribute("href", "/gp-reminders?for=acme");
    await expect(page.getByRole("link", { name: /See all of Amara Okafor's work/ })).toHaveAttribute("href", "/");
    // Never indexed, and no project frame around it.
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    await expect(page).toHaveTitle("For Acme · Amara Okafor");
    await expect(page.locator("[data-exhbt-page]")).toHaveCount(0);
    const { violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze();
    expect(violations.map((v) => `public ${v.id}: ${v.nodes.map((n) => n.target).join(", ")}`)).toEqual([]);

    // Opening a pick keeps the way back to the job page.
    await cards.nth(0).locator("a").click();
    await page.waitForURL(`${origin}/gp-reminders?for=acme`);
    await expect(page.getByRole("heading", { level: 1, name: GP })).toBeVisible();
    await expect(page.getByRole("link", { name: "Back to Acme" })).toHaveAttribute("href", "/acme");
    // Without ?for=, or with one that isn't a live link, there is no way back (and nothing about the company).
    await page.goto(`${origin}/gp-reminders`);
    await expect(page.getByRole("heading", { level: 1, name: GP })).toBeVisible();
    await expect(page.getByRole("link", { name: /Back to/ })).toHaveCount(0);
    await page.goto(`${origin}/gp-reminders?for=nothing-here`);
    await expect(page.getByRole("heading", { level: 1, name: GP })).toBeVisible();
    await expect(page.getByRole("link", { name: /Back to/ })).toHaveCount(0);

    // Off: not found on the public page, and no way back from a project.
    await page.goto(editor);
    await page.getByRole("button", { name: "Turn off" }).click();
    await expect(page.getByText("Off", { exact: true })).toBeVisible();
    expect((await page.goto(`${origin}/acme`))?.status()).toBe(404);
    await page.goto(`${origin}/gp-reminders?for=acme`);
    await expect(page.getByRole("heading", { level: 1, name: GP })).toBeVisible();
    await expect(page.getByRole("link", { name: /Back to/ })).toHaveCount(0);

    // On again: it is back. Deleted: gone.
    await page.goto(editor);
    await page.getByRole("button", { name: "Turn on" }).click();
    await expect(page.getByText("Live", { exact: true })).toBeVisible();
    expect((await page.goto(`${origin}/acme`))?.status()).toBe(200);
    await page.goto(editor);
    await page.getByRole("button", { name: "Delete the link for Acme · Graduate Data Analyst" }).click();
    await page.getByRole("button", { name: "Yes, delete" }).click();
    await page.waitForURL(/\/portfolio/);
    expect((await page.goto(`${origin}/acme`))?.status()).toBe(404);
  });

  test("a job link and an exhbt never share a slug, and an unknown slug is a 404", async ({ page, baseURL }) => {
    await signInAs(page, "jlslug", "max");
    // A company named like one of the person's exhbts: the link takes the next free address.
    await makeLink(page, "Library footfall", "Analyst", "clean");
    await expect(page.getByTestId("job-link-address")).toHaveText("jlslug.exhbt.co.uk/library-footfall-2");
    const origin = on(baseURL, "jlslug");
    await page.goto(`${origin}/library-footfall`);
    await expect(page.getByRole("heading", { level: 1, name: FOOTFALL })).toBeVisible();
    await page.goto(`${origin}/library-footfall-2`);
    await expect(page.getByRole("heading", { level: 1, name: "For Library footfall · Analyst" })).toBeVisible();
    expect((await page.goto(`${origin}/no-such-job`))?.status()).toBe(404);
  });

  test("a downgrade takes the public page down", async ({ page, baseURL }) => {
    await signInAs(page, "jldown", "max");
    await makeLink(page, "Acme", "Analyst", "clean");
    const origin = on(baseURL, "jldown");
    expect((await page.goto(`${origin}/acme`))?.status()).toBe(200);
    // Same person, now on Premium: the link is still stored, but the plan no longer includes job links.
    await page.goto("/dev/plan?plan=premium&next=/job-links");
    expect((await page.goto(`${origin}/acme`))?.status()).toBe(404);
    await page.goto("/dev/plan?plan=max&next=/job-links");
    expect((await page.goto(`${origin}/acme`))?.status()).toBe(200);
  });
});
