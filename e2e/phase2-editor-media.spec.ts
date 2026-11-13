import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { LIMITS } from "../lib/exhbt/blocks";
import { buildRoadmap, unlockProjects, uniqueEmail, waitForResult } from "./helpers";

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

// Editor round two: images and the work as a file, autosave that can't lose work, word guidance,
// the first-exhbt checklist, roadmap to exhbt, the Free and signed-in screens, the publish moment.

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
const PDF_TEXT = "%PDF-1.4\n% a tiny stand-in report\n";

async function signInAs(page: Page, username: string, plan: "free" | "premium") {
  await page.goto(`/dev/portfolio?username=${username}&plan=${plan}&count=0`);
  await page.goto(`/auth/dev?email=${username}@example.com&next=/exhbts`);
  await expect(page.getByRole("heading", { level: 1, name: "Your exhbts" })).toBeVisible();
}

async function startFromScratch(page: Page) {
  await page.getByRole("button", { name: "Start from scratch" }).click();
  await page.waitForURL(/\/exhbts\/[0-9a-f-]{36}\/edit$/);
  await expect(page.locator("[data-ready=true]")).toBeAttached();
  await expect(page.getByRole("textbox", { name: "The question" })).toBeVisible();
}

async function waitForSaved(page: Page) {
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
}

/** Fills everything a publish needs, apart from images and the work. */
async function fillValid(page: Page, title: string) {
  await page.locator("#title").fill(title);
  await page.getByRole("textbox", { name: "The question" }).fill("Queues ran long at lunch. Would a second till help?");
  await page.getByLabel("Box 1", { exact: true }).fill("Timed the queue");
  await page.getByLabel("Box 2", { exact: true }).fill("Added a second till");
  await page.getByLabel("Box 3", { exact: true }).fill("Waits fell");
  await page.getByRole("textbox", { name: "Finding 1" }).fill("Waits fell from 11 to 4 minutes.");
  await page.getByRole("textbox", { name: "Finding 2" }).fill("Sales held steady.");
}

test.describe("images and the work as a file", () => {
  test("add an image, publishing waits for its description, removing deletes the file", async ({ page }) => {
    await signInAs(page, "imogen", "premium");
    await startFromScratch(page);
    await fillValid(page, "Queue study with a picture");

    await page.locator("input[aria-label='Choose an image']").setInputFiles({ name: "queue.png", mimeType: "image/png", buffer: PNG });
    await expect(page.getByLabel(/Image 1: describe it/)).toBeVisible();
    await expect(page.getByRole("region", { name: "Preview" }).locator("img[alt='']").first()).toBeVisible();

    await page.getByLabel("This is my work, and the numbers are true").check();
    await page.getByRole("button", { name: "Publish", exact: true }).click();
    // The top list says what is wrong and links to the card.
    const problems = page.getByRole("region", { name: "Things to fix before publishing" });
    await expect(problems.getByRole("link", { name: /Image 1: Describe the image/ })).toBeVisible();
    await expect(page.getByText("It's live.")).toHaveCount(0);

    await page.getByLabel(/Image 1: describe it/).fill("A queue at the cafe till");
    await page.getByRole("button", { name: "Publish", exact: true }).click();
    await expect(page.getByText("It's live.")).toBeVisible();
    await expect(page.getByRole("link", { name: "View it" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Copy link" })).toBeVisible();

    // After a reload the preview image comes from the stored file.
    await page.reload();
    await expect(page.locator("[data-ready=true]")).toBeAttached();
    const src = await page.getByRole("region", { name: "Preview" }).locator("img[alt='A queue at the cafe till']").getAttribute("src");
    expect(src).toMatch(/^\/dev\/files\//);
    expect((await page.request.get(src!)).status()).toBe(200);

    // Removing it from a live exhbt keeps the file for the live copy until the next publish.
    await page.getByRole("button", { name: "Remove image 1" }).click();
    await waitForSaved(page);
    expect((await page.request.get(src!)).status()).toBe(200);
    await page.getByLabel("This is my work, and the numbers are true").check();
    await page.getByRole("button", { name: "Publish changes" }).click();
    await expect(page.getByText("Your changes are live.")).toBeVisible();
    await expect.poll(async () => (await page.request.get(src!)).status()).toBe(404);
  });

  test("an unpublished draft's removed image is deleted once saved", async ({ page }) => {
    await signInAs(page, "irene", "premium");
    await startFromScratch(page);
    await page.locator("input[aria-label='Choose an image']").setInputFiles({ name: "a.png", mimeType: "image/png", buffer: PNG });
    await expect(page.getByLabel(/Image 1: describe it/)).toBeVisible();
    await waitForSaved(page);
    await page.reload();
    await expect(page.locator("[data-ready=true]")).toBeAttached();
    const src = await page.getByRole("region", { name: "Preview" }).locator("img").last().getAttribute("src");
    expect(src).toMatch(/^\/dev\/files\//);
    await page.getByRole("button", { name: "Remove image 1" }).click();
    await waitForSaved(page);
    await expect.poll(async () => (await page.request.get(src!)).status()).toBe(404);
  });

  test("a wrong type of picture is refused with a reason", async ({ page }) => {
    await signInAs(page, "ivor", "premium");
    await startFromScratch(page);
    await page.locator("input[aria-label='Choose an image']").setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("hi") });
    await expect(page.getByRole("alert").filter({ hasText: "JPEG, PNG, WebP or GIF" })).toBeVisible();
    await expect(page.getByLabel(/Image 1: describe it/)).toHaveCount(0);
  });

  test("a file as the work: it downloads from the published page; replacing deletes the old file", async ({ page }) => {
    await signInAs(page, "wilf", "premium");
    await startFromScratch(page);
    await fillValid(page, "Queue study with a report");
    const choose = page.locator("input[aria-label='Choose a file']");
    await choose.setInputFiles({ name: "report.pdf", mimeType: "application/pdf", buffer: Buffer.from(PDF_TEXT) });
    await expect(page.getByText("File attached:")).toBeVisible();
    await expect(page.locator("#evidence-label")).toHaveValue("report.pdf");
    await waitForSaved(page);
    await page.reload();
    await expect(page.locator("[data-ready=true]")).toBeAttached();
    const first = await page.getByRole("region", { name: "Preview" }).getByRole("link", { name: /See the work/ }).getAttribute("href");
    expect(first).toMatch(/^\/dev\/files\//);

    // Replace it with a different file: the old one is deleted after the save.
    await page.locator("input[aria-label='Choose a file']").setInputFiles({ name: "report-v2.pdf", mimeType: "application/pdf", buffer: Buffer.from(PDF_TEXT + "v2") });
    await expect(page.locator("#evidence-label")).toHaveValue("report-v2.pdf");
    await waitForSaved(page);
    await expect.poll(async () => (await page.request.get(first!)).status()).toBe(404);

    await page.getByLabel("This is my work, and the numbers are true").check();
    await page.getByRole("button", { name: "Publish", exact: true }).click();
    await expect(page.getByText("It's live.")).toBeVisible();
    await page.goto("/p/wilf/queue-study-with-a-report");
    const link = page.getByRole("link", { name: /See the work: report-v2.pdf/ });
    await expect(link).toBeVisible();
    const res = await page.request.get((await link.getAttribute("href"))!);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-disposition"]).toContain("attachment");
    expect(await res.text()).toBe(PDF_TEXT + "v2");
  });
});

test.describe("autosave that can't lose work", () => {
  test("two failed saves are retried and then show Saved", async ({ page }) => {
    await signInAs(page, "rita", "premium");
    await startFromScratch(page);
    let posts = 0;
    await page.route(/\/exhbts\/[0-9a-f-]{36}\/edit/, async (route) => {
      if (route.request().method() === "POST" && ++posts <= 2) return route.abort();
      return route.continue();
    });
    await page.locator("#title").fill("Retried save");
    await expect(page.getByText("Saved", { exact: true })).toBeVisible({ timeout: 30_000 });
    expect(posts).toBe(3);
    await expect(page.getByRole("button", { name: /Not saved/ })).toHaveCount(0);
    await page.reload();
    await expect(page.locator("#title")).toHaveValue("Retried save");
  });

  test("when saving keeps failing it says so, keeps a copy here, and offers it back after a reload", async ({ page }) => {
    page.on("dialog", (d) => void d.accept());
    await signInAs(page, "fay", "premium");
    await startFromScratch(page);
    await page.route(/\/exhbts\/[0-9a-f-]{36}\/edit/, (route) => (route.request().method() === "POST" ? route.abort() : route.continue()));
    await page.locator("#title").fill("Only in this browser");
    await expect(page.getByRole("button", { name: "Not saved. Retry" })).toBeVisible({ timeout: 30_000 });
    const kept = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("exhbt-backup:")).length);
    expect(kept).toBe(1);

    await page.unroute(/\/exhbts\/[0-9a-f-]{36}\/edit/);
    await page.reload();
    await expect(page.locator("[data-ready=true]")).toBeAttached();
    await expect(page.locator("#title")).toHaveValue("");
    await expect(page.getByText(/We kept changes from/)).toBeVisible();
    await page.getByRole("button", { name: "Restore them" }).click();
    await expect(page.locator("#title")).toHaveValue("Only in this browser");
    await waitForSaved(page);

    await page.reload();
    await expect(page.locator("#title")).toHaveValue("Only in this browser");
    await expect(page.getByText(/We kept changes from/)).toHaveCount(0);
  });

  test("Retry saves once the connection is back", async ({ page }) => {
    await signInAs(page, "ray", "premium");
    await startFromScratch(page);
    await page.route(/\/exhbts\/[0-9a-f-]{36}\/edit/, (route) => (route.request().method() === "POST" ? route.abort() : route.continue()));
    await page.locator("#title").fill("Retry by hand");
    await expect(page.getByRole("button", { name: "Not saved. Retry" })).toBeVisible({ timeout: 30_000 });
    await page.unroute(/\/exhbts\/[0-9a-f-]{36}\/edit/);
    await page.getByRole("button", { name: "Not saved. Retry" }).click();
    await waitForSaved(page);
  });
});

test.describe("guidance", () => {
  test("a first exhbt gets a checklist that ticks, and teaching placeholders", async ({ page }) => {
    await signInAs(page, "gus", "premium");
    await startFromScratch(page);
    const guide = page.getByRole("region", { name: "Your first exhbt" });
    await expect(guide).toBeVisible();
    const item = (name: string) => guide.getByRole("listitem").filter({ hasText: name });
    await expect(item("Give it a title")).not.toHaveAttribute("data-done", "true");
    await expect(page.locator("#title")).toHaveAttribute("placeholder", /e\.g\./);
    await expect(page.getByLabel("Box 1", { exact: true })).toHaveAttribute("placeholder", /e\.g\./);

    await page.locator("#title").fill("Checking the checklist");
    await expect(item("Give it a title")).toHaveAttribute("data-done", "true");
    await page.getByRole("textbox", { name: "The question" }).fill("Does it tick?");
    await expect(item("Write the question")).toHaveAttribute("data-done", "true");
    for (const n of [1, 2, 3]) await page.getByLabel(`Box ${n}`, { exact: true }).fill(`Step ${n}`);
    await expect(item("process boxes")).toHaveAttribute("data-done", "true");
    await page.getByRole("textbox", { name: "Finding 1" }).fill("One.");
    await page.getByRole("textbox", { name: "Finding 2" }).fill("Two.");
    await expect(item("2 or more findings")).toHaveAttribute("data-done", "true");
    await expect(item("Publish it")).not.toHaveAttribute("data-done", "true");

    await page.getByRole("button", { name: "Hide the checklist" }).click();
    await expect(guide).toHaveCount(0);
  });

  test("over 200 words: the bar turns red and the longest card is flagged with a hint", async ({ page }) => {
    await signInAs(page, "walt", "premium");
    await startFromScratch(page);
    const long = Array.from({ length: LIMITS.totalWords + 30 }, (_, i) => `word${i}`).join(" ");
    await page.getByRole("textbox", { name: "The question" }).fill(long);
    await expect(page.getByText(`aim for ${LIMITS.targetWords}, at most ${LIMITS.totalWords}`)).toBeVisible();
    await expect(page.getByText(/this part has the most/)).toBeVisible();
    await expect(page.getByText(`Keep the question to ${LIMITS.gapWords} words.`)).toBeVisible();
  });

  test("the preview stays in view on a wide screen, and the badge waits for the confirmation", async ({ page }) => {
    await signInAs(page, "pru", "premium");
    await startFromScratch(page);
    const preview = page.getByRole("region", { name: "Preview" });
    await expect(preview).toHaveCSS("position", "sticky");
    await expect(preview.getByText("Confirmed by author")).toHaveCount(0);
    await expect(preview.getByText("Not confirmed yet")).toBeVisible();
    await page.getByLabel("This is my work, and the numbers are true").check();
    await expect(preview.getByText("Confirmed by author")).toBeVisible();
  });
});

test.describe("roadmap to exhbt", () => {
  test("Build this as an exhbt opens the editor prefilled; the plan limit is explained", async ({ page }) => {
    const email = uniqueEmail("build");
    await buildRoadmap(page);
    await waitForResult(page);
    const roadmapUrl = page.url().split("?")[0]!;
    await unlockProjects(page, { email });
    await expect(page.getByRole("heading", { level: 1, name: "Projects that would prove them" })).toBeVisible();

    // Signed out: a way to sign in, then back here.
    await expect(page.getByRole("link", { name: /Sign in to build this/ }).first()).toBeVisible();
    await page.goto(`/auth/dev?email=${encodeURIComponent(email)}&next=${encodeURIComponent(new URL(roadmapUrl).pathname + "?view=projects")}`);
    const first = page.getByRole("listitem").filter({ has: page.getByRole("button", { name: /^Build this as an exhbt/ }) }).first();
    const title = (await first.getByRole("heading", { level: 2 }).innerText()).trim();
    await first.getByRole("button", { name: /^Build this as an exhbt/ }).click();

    await page.waitForURL(/\/exhbts\/[0-9a-f-]{36}\/edit$/);
    await expect(page.locator("#title")).toHaveValue(title.slice(0, LIMITS.titleChars));
    await expect(page.locator("#context")).toHaveValue("Project from my Exhbt roadmap");
    await expect(page.getByRole("textbox", { name: "The question" })).not.toBeEmpty();
    await expect(page.getByLabel(/^Box \d$/)).toHaveCount(3);

    // Free holds one exhbt: now the Projects page says why and points to billing.
    await page.goto(`${roadmapUrl}?view=projects`);
    await expect(page.getByRole("button", { name: /^Build this as an exhbt/ })).toHaveCount(0);
    await expect(page.getByText(/Your plan holds \d+ exhbt/).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "See plans" }).first()).toHaveAttribute("href", "/account/billing");
  });
});

test.describe("Free, the header and the live moment", () => {
  test("Free shows Preview only, not Live, and explains Premium", async ({ page }) => {
    await signInAs(page, "fred", "free");
    await startFromScratch(page);
    await page.locator("#title").fill("Only a preview");
    await waitForSaved(page);
    await page.goto("/exhbts");
    const row = page.getByRole("listitem").filter({ hasText: "Only a preview" });
    await expect(row.getByText("Preview only")).toBeVisible();
    await expect(page.getByText("Live", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /Upgrade to Premium/ })).toHaveAttribute("href", "/account/billing");
  });

  test("signed in, the header shows Your exhbts, Portfolio and Account, and no Log in", async ({ page }) => {
    await signInAs(page, "hana", "premium");
    const nav = page.getByRole("navigation", { name: "Main" });
    await expect(nav.getByRole("link", { name: "Your exhbts" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Portfolio" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Account" })).toBeVisible();
    await expect(page.getByRole("banner").getByRole("link", { name: "Log in" })).toHaveCount(0);
    await nav.getByRole("link", { name: "Account" }).click();
    await expect(page.getByRole("link", { name: "Your exhbts" }).first()).toBeVisible();
    // Marketing pages stay as they were.
    await page.goto("/pricing");
    await expect(page.getByRole("banner").getByRole("link", { name: "Log in" })).toBeVisible();
  });

  test("publishing gives a success panel with the address, View it and Copy link", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await signInAs(page, "lois", "premium");
    await startFromScratch(page);
    await fillValid(page, "A live moment");
    await page.getByLabel("This is my work, and the numbers are true").check();
    await page.getByRole("button", { name: "Publish", exact: true }).click();
    await expect(page.getByText("It's live.")).toBeVisible();
    await expect(page.getByRole("link", { name: "/p/lois/a-live-moment" })).toBeVisible();
    await page.getByRole("button", { name: "Copy link" }).click();
    await expect(page.getByText("Copied", { exact: true })).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(/\/p\/lois\/a-live-moment$/);
    await page.getByRole("link", { name: "View it" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "A live moment" })).toBeVisible();
  });

  test("no accessibility violations on the editor with an image and the work, or on the list", async ({ page }) => {
    await signInAs(page, "axl", "premium");
    await startFromScratch(page);
    await fillValid(page, "Accessible editor");
    await page.locator("input[aria-label='Choose an image']").setInputFiles({ name: "a.png", mimeType: "image/png", buffer: PNG });
    await expect(page.getByLabel(/Image 1: describe it/)).toBeVisible();
    await page.locator("input[aria-label='Choose a file']").setInputFiles({ name: "r.pdf", mimeType: "application/pdf", buffer: Buffer.from(PDF_TEXT) });
    await expect(page.getByText("File attached:")).toBeVisible();
    await page.getByRole("button", { name: "Publish", exact: true }).click();
    await expect(page.getByRole("region", { name: "Things to fix before publishing" })).toBeVisible();
    let { violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze();
    expect(violations.map((v) => `editor ${v.id}: ${v.nodes.map((n) => n.target).join(", ")}`)).toEqual([]);
    await waitForSaved(page);
    await page.goto("/exhbts");
    ({ violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze());
    expect(violations.map((v) => `list ${v.id}: ${v.nodes.map((n) => n.target).join(", ")}`)).toEqual([]);
  });
});
