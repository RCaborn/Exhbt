import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { slugify, uniqueSlug, SLUG_MAX } from "../lib/exhbt/slug";
import { docToRuns, runsToDoc } from "../lib/exhbt/richtext-tiptap";
import { LIMITS } from "../lib/exhbt/blocks";

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

// The editor (docs/phase-2.md section 6): the list, the cards, autosave, publish checks.

test.describe("slugs", () => {
  test("lower case, hyphens, no accents or symbols, never empty", () => {
    expect(slugify("Cutting missed GP appointments: 18% fewer!")).toBe("cutting-missed-gp-appointments-18-fewer");
    expect(slugify("  Café & Bar  rota ")).toBe("cafe-and-bar-rota");
    expect(slugify("!!!")).toBe("exhbt");
  });

  test("at most 60 characters, cut between words", () => {
    const s = slugify("A very long title about forecasting weekly footfall for a city centre library service");
    expect(s.length).toBeLessThanOrEqual(SLUG_MAX);
    expect(s).toBe("a-very-long-title-about-forecasting-weekly-footfall-for-a");
    expect(s.endsWith("-")).toBe(false);
  });

  test("unique among the person's exhbts by adding -2, -3", () => {
    expect(uniqueSlug("footfall", [])).toBe("footfall");
    expect(uniqueSlug("footfall", ["footfall"])).toBe("footfall-2");
    expect(uniqueSlug("footfall", ["footfall", "footfall-2"])).toBe("footfall-3");
    const long = "x".repeat(SLUG_MAX);
    expect(uniqueSlug(long, [long])).toHaveLength(SLUG_MAX);
  });
});

test.describe("rich text and Tiptap JSON", () => {
  test("round trip keeps bold, italic and an https link", () => {
    const runs = [
      { t: "Did the " },
      { t: "timing", b: true },
      { t: " matter, " },
      { t: "really", i: true },
      { t: "? See " },
      { t: "the report", href: "https://example.com/report" },
      { t: "." },
    ];
    const doc = runsToDoc(runs);
    expect(doc.content).toHaveLength(1);
    expect(docToRuns(doc)).toEqual(runs);
  });

  test("an http link is dropped, the words stay", () => {
    const fromEditor = {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "plain site", marks: [{ type: "link", attrs: { href: "http://example.com" } }] }] }],
    };
    expect(docToRuns(fromEditor)).toEqual([{ t: "plain site" }]);
    expect(runsToDoc([{ t: "x", href: "javascript:alert(1)" }]).content![0]!.content![0]!.marks).toBeUndefined();
  });

  test("empty fields are empty, pasted paragraphs join with a space", () => {
    expect(docToRuns(runsToDoc([]))).toEqual([]);
    const pasted = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "One." }] }, { type: "paragraph", content: [{ type: "text", text: "Two." }] }] };
    expect(docToRuns(pasted)).toEqual([{ t: "One. Two." }]);
  });
});

/** Makes a dev user with a username on a plan, signs in, and opens /exhbts. */
async function signInAs(page: Page, username: string, plan: "free" | "premium") {
  await page.goto(`/dev/portfolio?username=${username}&plan=${plan}&count=0`);
  await page.goto(`/auth/dev?email=${username}@example.com&next=/exhbts`);
  await expect(page.getByRole("heading", { level: 1, name: "Your exhbts" })).toBeVisible();
}

async function startFromScratch(page: Page) {
  await page.getByRole("button", { name: "Start from scratch" }).click();
  await page.waitForURL(/\/exhbts\/[0-9a-f-]{36}\/edit$/);
  await expect(page.locator("[data-ready=true]")).toBeAttached();
  // Tiptap loads in its own chunk after the page.
  await expect(page.getByRole("textbox", { name: "The question" })).toBeVisible();
}

/** Waits for the autosave after the last change to land. */
async function waitForSave(page: Page) {
  await expect(page.getByText("Saving…")).toBeVisible();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
}

const TITLE = "Cutting queue times at the student union cafe";
const SLUG = "cutting-queue-times-at-the-student-union-cafe";

test.describe("the exhbt editor", () => {
  test("build from scratch, autosave, publish once the plan and the checks allow, then unpublish", async ({ page }) => {
    await signInAs(page, "eddie", "free");
    await startFromScratch(page);

    await page.locator("#title").fill(TITLE);
    await page.locator("#context").fill("Operations module, Year 2");
    await page.getByRole("textbox", { name: "The question" }).fill("Lunchtime queues ran past ten minutes. Would a second till help?");
    await page.getByLabel("Box 1", { exact: true }).fill("Timed the queue for two weeks");
    await page.getByLabel("Box 2", { exact: true }).fill("Moved drinks to a second till");
    await page.getByLabel("Box 3", { exact: true }).fill("Waits fell to four minutes");

    // "+" adds a box on the diagram; × takes it away again.
    await page.getByRole("button", { name: "Add a box after box 2" }).click();
    await expect(page.getByLabel("Box 4", { exact: true })).toHaveValue("Waits fell to four minutes");
    await expect(page.getByLabel("Box 3", { exact: true })).toHaveValue("");
    await page.getByRole("button", { name: "Remove box 3" }).click();
    await page.getByRole("button", { name: "Add a box at the end" }).click();
    await expect(page.getByLabel("Box 4", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Remove box 4" }).click();
    await expect(page.getByLabel("Box 4", { exact: true })).toHaveCount(0);

    await page.getByRole("textbox", { name: "Finding 1" }).fill("Average wait fell from 11 to 4 minutes.");
    await page.getByRole("textbox", { name: "Finding 2" }).fill("Sales held steady, so the till paid for itself.");
    await page.locator("#skill-new").fill("Process mapping");
    await page.locator("#skill-new").press("Enter");
    await expect(page.getByRole("list", { name: "Skills", exact: true }).getByText("Process mapping")).toBeVisible();
    // The preview redraws as you type.
    await expect(page.getByRole("region", { name: "Preview" }).getByText("Moved drinks to a second till")).toBeVisible();
    await waitForSave(page);

    // Autosave reached the server.
    await page.reload();
    await expect(page.locator("#title")).toHaveValue(TITLE);
    await expect(page.locator("#context")).toHaveValue("Operations module, Year 2");
    await expect(page.getByRole("textbox", { name: "The question" })).toContainText("Would a second till help?");
    await expect(page.getByLabel("Box 3", { exact: true })).toHaveValue("Waits fell to four minutes");
    await expect(page.getByLabel("Box 4", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("textbox", { name: "Finding 2" })).toContainText("paid for itself");
    await expect(page.getByRole("list", { name: "Skills", exact: true }).getByText("Process mapping")).toBeVisible();
    const editor = page.url();

    // Free can build and preview, not publish.
    await expect(page.getByText("Preview only")).toBeVisible();
    await expect(page.getByRole("button", { name: "Publish", exact: true })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Publish with Premium" })).toBeVisible();
    await expect(page.getByText(/comes with Premium/)).toBeVisible();
    await expect(page.getByText("It's live.")).toHaveCount(0);

    // On Premium it still waits for the confirmation.
    await page.goto(`/dev/plan?plan=premium&next=${encodeURIComponent(new URL(editor).pathname)}`);
    await expect(page.locator("[data-ready=true]")).toBeAttached();
    await expect(page.getByText(/comes with Premium/)).toHaveCount(0);
    await page.getByRole("button", { name: "Publish", exact: true }).click();
    await expect(page.getByText("Tick the box to confirm this is your work and the numbers are true.")).toBeVisible();
    await expect(page.getByText("It's live.")).toHaveCount(0);

    await page.getByLabel("This is my work, and the numbers are true").check();
    await page.getByRole("button", { name: "Publish", exact: true }).click();
    await expect(page.getByText("It's live.")).toBeVisible();
    await expect(page.getByRole("link", { name: `/p/eddie/${SLUG}` })).toBeVisible();

    // The portfolio shows it: the tile, then the project with its flowchart and findings.
    await page.goto("/p/eddie");
    await expect(page.getByText(TITLE)).toBeVisible();
    await page.goto(`/p/eddie/${SLUG}`);
    await expect(page.getByRole("heading", { level: 1, name: TITLE })).toBeVisible();
    const flow = page.getByRole("list", { name: "Methodology" });
    for (const box of ["Timed the queue for two weeks", "Moved drinks to a second till", "Waits fell to four minutes"]) {
      await expect(flow.getByText(box)).toBeVisible();
    }
    await expect(page.getByText("Average wait fell from 11 to 4 minutes.")).toBeVisible();

    // Unpublish: nothing is live, so there's no public page.
    await page.goto(editor);
    await expect(page.locator("[data-ready=true]")).toBeAttached();
    await page.getByRole("button", { name: "Unpublish" }).click();
    await page.getByRole("button", { name: "Yes, unpublish" }).click();
    await expect(page.getByRole("heading", { level: 2, name: "Publish" })).toBeVisible();
    const res = await page.goto("/p/eddie");
    expect(res?.status()).toBe(404);

    // Free's one exhbt is used, so the list says why there's no new one (the plan is Premium now; back to Free).
    await page.goto("/dev/plan?plan=free&next=/exhbts");
    await expect(page.getByText(/Delete one, or upgrade for more/)).toBeVisible();
    await expect(page.getByRole("link", { name: "See plans" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Start from scratch" })).toHaveCount(0);
  });

  test("a title over the limit shows the issue beside it and blocks publishing", async ({ page }) => {
    await signInAs(page, "lena", "premium");
    await startFromScratch(page);
    await page.locator("#title").fill("A".repeat(LIMITS.titleChars + 5));
    await expect(page.locator("#title-issues")).toContainText(`Keep the title to ${LIMITS.titleChars} characters.`);
    await page.getByLabel("This is my work, and the numbers are true").check();
    await page.getByRole("button", { name: "Publish", exact: true }).click();
    await expect(page.getByText(/^Fix \d+ things first/)).toBeVisible();
    await expect(page.getByText("It's live.")).toHaveCount(0);
    await page.goto("/exhbts");
    await expect(page.getByRole("listitem").filter({ hasText: "Draft" })).toHaveCount(1);
  });

  test("the list reorders and deletes", async ({ page }) => {
    await signInAs(page, "rhea", "premium");
    for (const title of ["First project", "Second project"]) {
      await startFromScratch(page);
      await page.locator("#title").fill(title);
      await waitForSave(page);
      await page.goto("/exhbts");
    }
    const list = page.getByRole("list", { name: "Your exhbts, in portfolio order" });
    await expect(list.getByRole("listitem").first()).toContainText("First project");
    await page.getByRole("button", { name: "Move First project down" }).click();
    await expect(list.getByRole("listitem").first()).toContainText("Second project");
    await page.getByRole("button", { name: "Delete Second project" }).click();
    await page.getByRole("button", { name: "Yes, delete" }).click();
    await expect(list.getByRole("listitem")).toHaveCount(1);
    await expect(list).toContainText("First project");
  });

  test("no accessibility violations on the list and the editor", async ({ page }) => {
    await signInAs(page, "axel", "premium");
    let { violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze();
    expect(violations.map((v) => `list ${v.id}: ${v.nodes.map((n) => n.target).join(", ")}`)).toEqual([]);

    await startFromScratch(page);
    await page.locator("#title").fill("Forecasting footfall");
    await page.getByRole("button", { name: "Add a graph" }).click();
    await expect(page.getByLabel("Graph 1, row 1 group")).toBeVisible();
    ({ violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze());
    expect(violations.map((v) => `editor ${v.id}: ${v.nodes.map((n) => n.target).join(", ")}`)).toEqual([]);

    await page.goto("/exhbts");
    ({ violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze());
    expect(violations.map((v) => `list with one ${v.id}: ${v.nodes.map((n) => n.target).join(", ")}`)).toEqual([]);
  });
});
