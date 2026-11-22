import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { slugify, uniqueSlug, SLUG_MAX } from "../lib/exhbt/slug";
import { docToRuns, runsToDoc } from "../lib/exhbt/richtext-tiptap";
import { LIMITS } from "../lib/exhbt/blocks";
import { addGraphSection, addSkill, box, closeSheet, fieldAt, fillBox, fillContext, fillFinding, fillPlain, fillTitle, fillValid, finding, openPublishSheet, publish, publishSheet, reviewButton, seeAsVisitor, signInAs, startFromScratch, visitorRegion, waitForSave, waitEditor } from "./editor";

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

const TITLE = "Cutting queue times at the student union cafe";
const SLUG = "cutting-queue-times-at-the-student-union-cafe";

test.describe("the exhbt editor", () => {
  test("build from scratch, autosave, publish once the plan and the checks allow, then unpublish", async ({ page }) => {
    test.setTimeout(180_000); // sign-in, the build, two plan changes and the public pages: cold compiles included
    await signInAs(page, "eddie", "free");
    await startFromScratch(page);

    await fillTitle(page, TITLE);
    await fillPlain(page, page.locator("#context"), "Operations module, Year 2");
    await fillContext(page, "Lunchtime queues ran past ten minutes. Would a second till help?");
    await fillBox(page, 1, "Timed the queue for two weeks");
    await fillBox(page, 2, "Moved drinks to a second till");
    await fillBox(page, 3, "Waits fell to four minutes");

    // "+" adds a box on the diagram; × takes it away again.
    await page.getByRole("button", { name: "Add a box after box 2" }).click();
    await expect(box(page, 4)).toHaveValue("Waits fell to four minutes");
    await expect(box(page, 3)).toHaveValue("");
    await page.getByRole("button", { name: "Remove box 3" }).click();
    await page.getByRole("button", { name: "Add a box at the end" }).click();
    await expect(box(page, 4)).toBeVisible();
    await page.getByRole("button", { name: "Remove box 4" }).click();
    await expect(box(page, 4)).toHaveCount(0);

    await fillFinding(page, 1, "Average wait fell from 11 to 4 minutes.");
    await fillFinding(page, 2, "Sales held steady, so the till paid for itself.");
    await addSkill(page, "Process mapping");
    await expect(page.getByRole("list", { name: "Skills used", exact: true }).getByText("Process mapping")).toBeVisible();
    // The page is the editor, so what is typed is on it as it is typed; the visitor's view shows the same words.
    await expect(box(page, 2)).toHaveValue("Moved drinks to a second till");
    await seeAsVisitor(page, true);
    await expect(visitorRegion(page).getByText("Moved drinks to a second till")).toBeVisible();
    await seeAsVisitor(page, false);
    await waitForSave(page);

    // Autosave reached the server.
    await page.reload();
    await waitEditor(page);
    await expect(page.locator("#title")).toHaveValue(TITLE);
    await expect(page.locator("#context")).toHaveValue("Operations module, Year 2");
    await expect(fieldAt(page, "gap")).toContainText("Would a second till help?");
    await expect(box(page, 3)).toHaveValue("Waits fell to four minutes");
    await expect(box(page, 4)).toHaveCount(0);
    await expect(finding(page, 2)).toContainText("paid for itself");
    await expect(page.getByRole("list", { name: "Skills used", exact: true }).getByText("Process mapping")).toBeVisible();
    const editor = page.url();

    // Free can build and preview, not publish.
    await expect(page.getByText("Preview only", { exact: true })).toBeVisible();
    await reviewButton(page).click();
    await expect(page.getByRole("button", { name: "Publish", exact: true })).toHaveCount(0);
    await expect(publishSheet(page).getByRole("link", { name: /Upgrade to Premium/ })).toBeVisible();
    await expect(publishSheet(page).getByText(/comes with Premium/)).toBeVisible();
    await expect(page.getByText("It's live.")).toHaveCount(0);

    // On Premium it still waits for the confirmation.
    await page.goto(`/dev/plan?plan=premium&next=${encodeURIComponent(new URL(editor).pathname)}`);
    await waitEditor(page);
    await openPublishSheet(page);
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

    // Unpublish: nothing is live, so there's no public page. The owner sees a preview of it instead
    // (decision 0016); a visitor gets not found.
    await page.goto(editor);
    await waitEditor(page);
    await openPublishSheet(page);
    await page.getByRole("button", { name: "Unpublish" }).click();
    await page.getByRole("button", { name: "Yes, unpublish" }).click();
    await expect(publishSheet(page).getByRole("button", { name: "Publish", exact: true })).toBeVisible();
    await page.goto("/p/eddie");
    await expect(page.getByTestId("owner-preview")).toBeVisible();
    const visitor = await page.context().browser()!.newPage();
    const res = await visitor.goto(new URL("/p/eddie", page.url()).toString());
    expect(res?.status()).toBe(404);
    await visitor.close();

    // Free's one exhbt is used, so the list says why there's no new one (the plan is Premium now; back to Free).
    await page.goto("/dev/plan?plan=free&next=/exhbts");
    const prompt = page.getByTestId("upgrade-prompt");
    await expect(prompt.getByText(/Delete one, or move to Premium/)).toBeVisible();
    await expect(prompt.getByRole("link", { name: /^Upgrade to Premium/ })).toHaveAttribute("href", "/account/billing");
    await expect(prompt.getByRole("link", { name: "Compare plans" })).toHaveAttribute("href", "/pricing");
    await expect(page.getByRole("button", { name: "Start from scratch" })).toHaveCount(0);
  });

  test("See as a visitor draws the article the public page draws: Save as PDF, the checked-on date, the checks link", async ({ page }) => {
    await signInAs(page, "vera", "premium");
    await startFromScratch(page);
    await fillValid(page, "Would a second till help at lunch?");
    await waitForSave(page);
    // A draft first: no date yet, so the preview shows the day it would say if it went live now.
    await seeAsVisitor(page, true);
    const today = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
    await expect(visitorRegion(page)).toContainText(`Checked by exhbt, ${today}`);
    await expect(visitorRegion(page).getByRole("button", { name: /Save as PDF/ })).toBeVisible();
    await expect(page.locator("[data-visitor-signoff]").getByLabel("Made with exhbt")).toBeVisible();
    await seeAsVisitor(page, false);

    await publish(page);
    const live = (await publishSheet(page).getByRole("link", { name: /^\/p\/vera\// }).textContent())!.trim();
    await closeSheet(page);
    await seeAsVisitor(page, true);
    // What each page is made of: the elements and their classes in order (headings sit one level lower in the editor), and the words.
    const read = () =>
      page.locator("article[data-exhbt-page]").evaluate((a) => ({
        shape: [a, ...a.querySelectorAll("*")].map((e) => `${/^H[1-3]$/.test(e.tagName) ? "H" : e.tagName}.${[...e.classList].sort().join(".")}`),
        words: (a as HTMLElement).innerText,
      }));
    const preview = await read();
    await page.goto(live);
    await expect(page.getByRole("heading", { level: 1, name: "Would a second till help at lunch?" })).toBeVisible();
    const publicPage = await read();
    expect(publicPage.words).toContain("Save as PDF");
    expect(publicPage.words).toContain("Checked by exhbt");
    expect(preview.words).toBe(publicPage.words);
    expect(preview.shape).toEqual(publicPage.shape);
  });

  test("a title over the limit shows the issue beside it and blocks publishing", async ({ page }) => {
    await signInAs(page, "lena", "premium");
    await startFromScratch(page);
    // The title field does not cut what is typed or pasted: past the limit it says so, and publishing waits.
    const long = "A".repeat(LIMITS.titleChars + 5);
    await page.locator("#title").click();
    await page.keyboard.type(long);
    await expect(page.locator("#title")).toHaveValue(long);
    await expect(page.locator("#title-issue")).toContainText(`Keep the title to ${LIMITS.titleChars} characters.`);
    await openPublishSheet(page);
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
      await fillTitle(page, title);
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
    await fillTitle(page, "Forecasting footfall");
    await addGraphSection(page);
    await expect(page.getByLabel("Graph 1, row 1 group")).toBeVisible();
    ({ violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze());
    expect(violations.map((v) => `editor ${v.id}: ${v.nodes.map((n) => n.target).join(", ")}`)).toEqual([]);

    await page.goto("/exhbts");
    ({ violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze());
    expect(violations.map((v) => `list with one ${v.id}: ${v.nodes.map((n) => n.target).join(", ")}`)).toEqual([]);
  });
});
