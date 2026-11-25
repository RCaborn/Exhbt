import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { LIMITS } from "../lib/exhbt/blocks";
import { buildRoadmap, unlockProjects, uniqueEmail, waitForResult } from "./helpers";
import { closeOpenSheet, editorRoot, fieldAt, fillContext, fillPlain, fillTitle, fillValid, openPublishSheet, openThingsToFix, openWorkSheet, pickImages, removeSection, publish, publishSheet, seeAsVisitor, signInAs, startFromScratch, visitorRegion, waitEditor, waitForSaved, workSheet } from "./editor";
import { docNow, READY } from "./page-editor";
import { uniqueBytes } from "./unique-bytes";

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

// Editor round two: images and the work as a file, autosave that can't lose work, word guidance,
// the first-exhbt checklist, roadmap to exhbt, the Free and signed-in screens, the publish moment.

const PNG = uniqueBytes(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64"));
const PDF_TEXT = `%PDF-1.4\n% a tiny stand-in report\n%%EOF\n% ${uniqueBytes(Buffer.alloc(0)).toString("hex")}\n`;

test.describe("images and the work as a file", () => {
  test("add an image, publishing waits for its description, removing deletes the file", async ({ page }) => {
    test.setTimeout(150_000); // the picture, two publishes and a cold public page
    await signInAs(page, "imogen", "premium");
    await startFromScratch(page);
    await fillValid(page, "Queue study with a picture");

    await pickImages(page, { name: "queue.png", mimeType: "image/png", buffer: PNG });
    await expect(page.getByLabel(/Image 1: describe it/)).toBeVisible();
    // A growing textarea, so a long description is never cut off.
    expect(await page.getByLabel(/Image 1: describe it/).evaluate((el) => el.tagName)).toBe("TEXTAREA");
    await expect(editorRoot(page).locator("article img[alt='']").first()).toBeVisible();

    await openPublishSheet(page);
    await page.getByLabel("This is my work, and the numbers are true").check();
    await page.getByRole("button", { name: "Publish", exact: true }).click();
    // The top list says what is wrong and takes you to the field.
    await expect(page.getByText("It's live.")).toHaveCount(0);
    const problems = await openThingsToFix(page);
    await expect(problems.getByRole("button", { name: /Image 1: Describe the image/ })).toBeVisible();
    await expect(page.getByText("It's live.")).toHaveCount(0);

    await page.keyboard.press("Escape");
    await fillPlain(page, page.getByLabel(/Image 1: describe it/), "A queue at the cafe till");
    await publish(page);
    await expect(page.getByRole("link", { name: "View it" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Copy link" })).toBeVisible();
    await closeOpenSheet(page);

    // After a reload the image on the page comes from the stored file.
    await page.reload();
    await waitEditor(page);
    const src = await editorRoot(page).locator("article img[alt='A queue at the cafe till']").getAttribute("src");
    expect(src).toMatch(/^\/dev\/files\//);
    expect((await page.request.get(src!)).status()).toBe(200);

    // Removing it from a live exhbt keeps the file for the live copy until the next publish.
    await removeSection(page, "Image 1");
    await waitForSaved(page);
    expect((await page.request.get(src!)).status()).toBe(200);
    await publish(page, { changes: true });
    // Undo can still bring the picture back while the visit lasts (decision 0026, "what may delete a file"), so it goes when the person leaves.
    expect((await page.request.get(src!)).status()).toBe(200);
    await closeOpenSheet(page);
    await page.goto("/exhbts");
    await expect.poll(async () => (await page.request.get(src!)).status()).toBe(404);
  });

  test("an unpublished draft's removed image is deleted once saved and the person leaves", async ({ page }) => {
    await signInAs(page, "irene", "premium");
    await startFromScratch(page);
    await pickImages(page, { name: "a.png", mimeType: "image/png", buffer: PNG });
    await expect(page.getByLabel(/Image 1: describe it/)).toBeVisible();
    await waitForSaved(page);
    await page.reload();
    await waitEditor(page);
    const src = await editorRoot(page).locator("article img").last().getAttribute("src");
    expect(src).toMatch(/^\/dev\/files\//);
    await removeSection(page, "Image 1");
    await waitForSaved(page);
    // Undo can still bring the picture back while the visit lasts (decision 0026, "what may delete a file"), so it goes when the person leaves.
    expect((await page.request.get(src!)).status()).toBe(200);
    await page.goto("/exhbts");
    await expect.poll(async () => (await page.request.get(src!)).status()).toBe(404);
  });

  test("a wrong type of picture is refused with a reason", async ({ page }) => {
    await signInAs(page, "ivor", "premium");
    await startFromScratch(page);
    await pickImages(page, { name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("hi") });
    await expect(page.getByRole("alert").filter({ hasText: "JPEG, PNG, WebP or GIF" })).toBeVisible();
    await expect(page.getByLabel(/Image 1: describe it/)).toHaveCount(0);
  });

  test("a file as the work: it downloads from the published page; replacing deletes the old file", async ({ page }) => {
    await signInAs(page, "wilf", "premium");
    await startFromScratch(page);
    await fillValid(page, "Queue study with a report");
    await openWorkSheet(page);
    await workSheet(page).locator("input[aria-label='Choose a file']").setInputFiles({ name: "report.pdf", mimeType: "application/pdf", buffer: Buffer.from(PDF_TEXT) });
    await expect(page.getByText("File attached:")).toBeVisible();
    await expect(page.locator("#evidence-label")).toHaveValue("report.pdf");
    await waitForSaved(page);
    await page.reload();
    await waitEditor(page);
    // The page's work button never opens the file (nothing navigates in the editor), so the file's address is made from the stored id.
    const evidence = (await docNow(page)).evidence;
    expect(evidence?.kind).toBe("file");
    const first = `/dev/files/${(evidence as { fileId: string }).fileId}`;
    expect((await page.request.get(first)).status()).toBe(200);

    // Replace it with a different file: the old one is deleted after the save.
    await openWorkSheet(page);
    await workSheet(page).locator("input[aria-label='Choose a file']").setInputFiles({ name: "report-v2.pdf", mimeType: "application/pdf", buffer: Buffer.from(PDF_TEXT + "v2") });
    await expect(page.locator("#evidence-label")).toHaveValue("report-v2.pdf");
    await waitForSaved(page);
    await expect.poll(async () => (await page.request.get(first)).status()).toBe(404);

    await publish(page);
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
    await fillTitle(page, "Retried save");
    await expect(page.locator(`${READY} .xe-save`, { hasText: /^Saved$/ })).toBeVisible({ timeout: 30_000 });
    expect(posts).toBe(3);
    await expect(page.getByRole("button", { name: /Not saved/ })).toHaveCount(0);
    await page.reload();
    await waitEditor(page);
    await expect(page.locator("#title")).toHaveValue("Retried save");
  });

  test("when saving keeps failing it says so, keeps a copy here, and offers it back after a reload", async ({ page }) => {
    page.on("dialog", (d) => void d.accept());
    await signInAs(page, "fay", "premium");
    await startFromScratch(page);
    await page.route(/\/exhbts\/[0-9a-f-]{36}\/edit/, (route) => (route.request().method() === "POST" ? route.abort() : route.continue()));
    await fillTitle(page, "Only in this browser");
    await expect(page.getByRole("button", { name: "Not saved. Retry" })).toBeVisible({ timeout: 30_000 });
    const kept = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("exhbt-backup:")).length);
    expect(kept).toBe(1);

    await page.unroute(/\/exhbts\/[0-9a-f-]{36}\/edit/);
    await page.reload();
    await waitEditor(page);
    await expect(page.locator("#title")).toHaveValue("");
    await expect(page.getByText(/We kept changes from/)).toBeVisible();
    await page.getByRole("button", { name: "Restore them" }).click();
    await expect(page.locator("#title")).toHaveValue("Only in this browser");
    await waitForSaved(page);

    await page.reload();
    await waitEditor(page);
    await expect(page.locator("#title")).toHaveValue("Only in this browser");
    await expect(page.getByText(/We kept changes from/)).toHaveCount(0);
  });

  test("Retry saves once the connection is back", async ({ page }) => {
    await signInAs(page, "ray", "premium");
    await startFromScratch(page);
    await page.route(/\/exhbts\/[0-9a-f-]{36}\/edit/, (route) => (route.request().method() === "POST" ? route.abort() : route.continue()));
    await fillTitle(page, "Retry by hand");
    await expect(page.getByRole("button", { name: "Not saved. Retry" })).toBeVisible({ timeout: 30_000 });
    await page.unroute(/\/exhbts\/[0-9a-f-]{36}\/edit/);
    await page.getByRole("button", { name: "Not saved. Retry" }).click();
    await waitForSaved(page);
  });
});

test.describe("the save status for a screen reader", () => {
  test("one live region from the start says only a failure and the recovery, not the routine Saving and Saved", async ({ page }) => {
    await signInAs(page, "gus", "premium");
    await startFromScratch(page);
    const region = page.locator(`${READY} [data-topbar] div[role=status].sr-only`);
    await expect(region).toHaveCount(1);
    await expect(region).toBeEmpty();
    // Everything the region holds from now on.
    await region.evaluate((el) => {
      const seen: string[] = [];
      (window as unknown as { __said: string[] }).__said = seen;
      new MutationObserver(() => el.textContent && seen.push(el.textContent)).observe(el, { childList: true, characterData: true, subtree: true });
    });
    const said = () => page.evaluate(() => (window as unknown as { __said: string[] }).__said);
    // An ordinary save: "Saving…" and "Saved" are drawn, and nothing is said.
    await fillTitle(page, "Routine words");
    await waitForSaved(page);
    expect(await said()).toEqual([]);
    expect(await region.evaluate((el) => el.isConnected)).toBe(true);

    // A failed save is said in the same region.
    await page.route(/\/exhbts\/[0-9a-f-]{36}\/edit/, (route) => (route.request().method() === "POST" ? route.abort() : route.continue()));
    await fillTitle(page, "Routine words, then offline");
    await expect(page.getByRole("button", { name: "Not saved. Retry" })).toBeVisible({ timeout: 30_000 });
    await expect(region).toContainText("Not saved.");
    expect(await region.evaluate((el) => el.isConnected)).toBe(true);

    // And so is the recovery, in plain words.
    await page.unroute(/\/exhbts\/[0-9a-f-]{36}\/edit/);
    await page.getByRole("button", { name: "Not saved. Retry" }).click();
    await waitForSaved(page);
    await expect(region).toContainText("Saved again.");
    expect((await said()).some((t) => /^Saving/.test(t) || t === "Saved")).toBe(false);
  });
});

test.describe("guidance", () => {
  test("over 200 words: the bar turns red and the page's limit is listed to fix; the context line has no limit of its own", async ({ page }) => {
    await signInAs(page, "walt", "premium");
    await startFromScratch(page);
    const long = Array.from({ length: LIMITS.totalWords + 30 }, (_, i) => `word${i}`).join(" ");
    await fillContext(page, long);
    await expect(page.getByText(`aim for ${LIMITS.targetWords}, at most ${LIMITS.totalWords}`)).toBeVisible();
    await expect(page.locator(`${READY} [data-word-bar]`)).toHaveAttribute("data-over", "true");
    // The only word limit is the page's (decision 0030): the field itself is not marked, and nothing names a limit for it.
    await expect(fieldAt(page, "gap")).not.toHaveAttribute("data-invalid");
    await expect(page.getByText(/Keep the context to/)).toHaveCount(0);
    const fixes = await openThingsToFix(page);
    await expect(fixes).toContainText(`Keep the whole exhbt to ${LIMITS.totalWords} words (it's ${LIMITS.totalWords + 30}).`);
    await expect(fixes).not.toContainText(/Keep the context/);
  });

  test("the badge waits for the confirmation", async ({ page }) => {
    await signInAs(page, "pru", "premium");
    await startFromScratch(page);
    await seeAsVisitor(page, true);
    const preview = visitorRegion(page);
    await expect(preview.getByText(/^Confirmed by /)).toHaveCount(0);
    await expect(preview.getByText("Not confirmed yet")).toBeVisible();
    await seeAsVisitor(page, false);
    await openPublishSheet(page);
    await publishSheet(page).getByLabel("This is my work, and the numbers are true").check();
    await closeOpenSheet(page);
    await seeAsVisitor(page, true);
    await expect(visitorRegion(page).getByText(/^Confirmed by /)).toBeVisible();
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
    await waitEditor(page);
    await expect(page.locator("#title")).toHaveValue(title.slice(0, LIMITS.titleChars));
    await expect(page.locator("#context")).toHaveValue("Project from my Exhbt roadmap");
    await expect(fieldAt(page, "gap")).not.toHaveText(/^\s*$/);
    await expect(editorRoot(page).getByLabel(/^Box \d$/)).toHaveCount(3);

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
    await fillTitle(page, "Only a preview");
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
    await expect(page.getByRole("banner").getByRole("link", { name: "Account" })).toBeVisible();
    await expect(page.getByRole("banner").getByRole("link", { name: "Log in" })).toHaveCount(0);
    await page.getByRole("banner").getByRole("link", { name: "Account" }).click();
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
    await publish(page);
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
    await pickImages(page, { name: "a.png", mimeType: "image/png", buffer: PNG });
    await expect(page.getByLabel(/Image 1: describe it/)).toBeVisible();
    await openWorkSheet(page);
    await workSheet(page).locator("input[aria-label='Choose a file']").setInputFiles({ name: "r.pdf", mimeType: "application/pdf", buffer: Buffer.from(PDF_TEXT) });
    await expect(page.getByText("File attached:")).toBeVisible();
    await openPublishSheet(page);
    await page.getByRole("button", { name: "Publish", exact: true }).click();
    await closeOpenSheet(page);
    await openThingsToFix(page);
    let { violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze();
    expect(violations.map((v) => `editor ${v.id}: ${v.nodes.map((n) => n.target).join(", ")}`)).toEqual([]);
    await waitForSaved(page);
    await page.goto("/exhbts");
    ({ violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze());
    expect(violations.map((v) => `list ${v.id}: ${v.nodes.map((n) => n.target).join(", ")}`)).toEqual([]);
  });
});
