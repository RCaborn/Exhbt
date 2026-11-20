import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { ENTITLEMENTS } from "../lib/entitlements";
import { emptyDoc, text, type ExhbtDoc, type RichText } from "../lib/exhbt/blocks";
import { aiVersionOf, blockValue, replaceBlock, sameBlock } from "../lib/exhbt/draft-blocks";
import { backToAiVersion, cardMenuButton, DRAFT_PROJECT as PROJECT, draftAndOpen, findingsField, openCardMenu, rewritesLeft, signInToDraft, startRewrite, keepClassic } from "./editor";

// Release 3, milestone 0: this spec still drives the classic editor, which a bare /edit no longer serves.
test.beforeEach(({ page }) => keepClassic(page));

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

// Draft tools (docs/phase-2.md section 6): the kept source text and AI version, "Rewrite this
// block", "Back to the AI version" and the drafting screen. No API key in tests, so the AI is the
// labelled placeholder (lib/ai/exhbt-draft.ts, lib/ai/exhbt-rewrite.ts).

const FREE_REWRITES = ENTITLEMENTS.free.blockRegenerations;

test.describe("Block helpers", () => {
  /** The findings block is the findings section (decision 0015). */
  const withFindings = (d: ExhbtDoc, items: RichText[]): ExhbtDoc => ({ ...d, sections: [{ id: "findings", kind: "findings", items }] });
  const doc = withFindings({ ...emptyDoc(), title: "Reminders", gap: text("Did timing matter?"), skills: ["Python"] }, [text("Fell from 7.9% to 6.5%."), text("Cleaned 14,200 rows.")]);

  test("a block can be read, replaced and compared", () => {
    expect(blockValue(doc, "skills")).toEqual(["Python"]);
    expect(sameBlock(blockValue(doc, "findings"), [text("Fell from 7.9% to 6.5%."), text("Cleaned 14,200 rows.")])).toBe(true);
    expect(sameBlock(blockValue(doc, "gap"), text("Different."))).toBe(false);
  });

  test("replacing a block drops flags for numbers that are gone and adds the new block's", () => {
    const flagged = { ...withFindings(doc, [text("Fell 18%."), text("Cleaned 14,200 rows.")]), unverified: ["18%"] };
    const next = replaceBlock(flagged, "findings", [text("Fell from 7.9% to 6.5%."), text("Up 22%.")], ["22%"]);
    expect(next.unverified).toEqual(["22%"]);
    expect(next.title).toBe("Reminders");
  });

  test("the AI version keeps each block, with the numbers the source lacks", () => {
    const ai = aiVersionOf(withFindings(doc, [text("Fell 18%."), text("Cleaned 14,200 rows.")]), PROJECT);
    expect(ai.unverified.findings).toEqual(["18%"]);
    expect(ai.unverified.gap).toEqual([]);
    expect(ai.blocks.skills).toEqual(["Python"]);
  });
});

test.describe("Draft from a file", () => {
  test("a text file is drafted and the editor opens with the rewrite tools", async ({ page }) => {
    await signInToDraft(page, "txt");
    await page.locator("#files").setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from(PROJECT) });
    await expect(page.getByTestId("file-status")).toContainText("uploaded");
    await page.getByRole("button", { name: "Draft my exhbt" }).click();
    await page.waitForURL(/\/exhbts\/[0-9a-f-]{36}\/edit$/);
    await expect(page.getByRole("heading", { level: 1, name: "Edit exhbt" })).toBeVisible();
    for (const block of ["header", "skills", "gap", "flow", "findings"]) {
      await expect(cardMenuButton(page, block)).toBeVisible();
    }
    await openCardMenu(page, "findings");
    await expect(rewritesLeft(page, "findings")).toBeVisible();
    await expect(rewritesLeft(page, "findings")).toHaveText(`${FREE_REWRITES} of ${FREE_REWRITES} rewrites left`);
  });

  test("an exhbt started from scratch has no rewrite tools", async ({ page }) => {
    await signInToDraft(page, "scratch");
    await page.goto("/exhbts");
    await page.getByRole("button", { name: /start from scratch/i }).click();
    await page.waitForURL(/\/exhbts\/[0-9a-f-]{36}\/edit$/);
    await expect(page.getByRole("heading", { level: 1, name: "Edit exhbt" })).toBeVisible();
    await expect(page.getByTestId("tools-findings")).toHaveCount(0);
  });
});

test.describe("Rewrite and back to the AI version", () => {
  test("rewriting the findings with a note changes the text and uses up a rewrite", async ({ page }) => {
    await draftAndOpen(page, "rewrite");
    const before = await findingsField(page).innerText();
    expect(before).not.toContain("Preview rewrite");
    await openCardMenu(page, "findings");
    await expect(backToAiVersion(page, "findings")).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(cardMenuButton(page, "findings")).toBeFocused();
    await expect(cardMenuButton(page, "findings")).toHaveAttribute("aria-expanded", "false");

    await startRewrite(page, "findings");
    await page.getByLabel("Note for the rewrite").fill("shorter");
    await page.getByRole("button", { name: "Rewrite the findings now" }).click();

    await expect(findingsField(page)).toContainText("Preview rewrite 1");
    await expect(rewritesLeft(page, "findings")).toHaveText(`${FREE_REWRITES - 1} of ${FREE_REWRITES} rewrites left`);
    // Every card shows the same count.
    await expect(rewritesLeft(page, "gap")).toHaveText(`${FREE_REWRITES - 1} of ${FREE_REWRITES} rewrites left`);
    await expect(page.getByTestId("tools-findings").getByTestId("tools-status")).toContainText("Rewritten.");

    // It survives a reload (autosave) and the count is the server's.
    await expect(page.getByRole("status").filter({ hasText: "Saved" })).toBeVisible();
    await page.reload();
    await expect(findingsField(page)).toContainText("Preview rewrite 1");
    await expect(rewritesLeft(page, "findings")).toContainText(`${FREE_REWRITES - 1} of`);
  });

  test("Back to the AI version restores the AI's wording after an edit", async ({ page }) => {
    await draftAndOpen(page, "undo");
    const original = await findingsField(page).innerText();
    await expect(backToAiVersion(page, "findings")).toHaveCount(0);

    await findingsField(page).click();
    await page.keyboard.press("End");
    await page.keyboard.type(" MY OWN EDIT");
    await expect(findingsField(page)).toContainText("MY OWN EDIT");
    await openCardMenu(page, "findings");
    await expect(backToAiVersion(page, "findings")).toBeVisible();
    await backToAiVersion(page, "findings").click();
    await expect(findingsField(page)).not.toContainText("MY OWN EDIT");
    expect((await findingsField(page).innerText()).trim()).toBe(original.trim());
    await expect(backToAiVersion(page, "findings")).toHaveCount(0);

    // After a rewrite, "the AI version" is the rewrite.
    await startRewrite(page, "findings");
    await page.getByRole("button", { name: "Rewrite the findings now" }).click();
    await expect(findingsField(page)).toContainText("Preview rewrite 1");
    await findingsField(page).click();
    await page.keyboard.press("End");
    await page.keyboard.type(" SECOND EDIT");
    await openCardMenu(page, "findings");
    await expect(backToAiVersion(page, "findings")).toBeVisible();
    await backToAiVersion(page, "findings").click();
    await expect(findingsField(page)).toContainText("Preview rewrite 1");
    await expect(findingsField(page)).not.toContainText("SECOND EDIT");
  });

  test("on Free the rewrites run out, and the server refuses another with the reason", async ({ page }) => {
    await draftAndOpen(page, "limit");
    // A second tab that doesn't know the count has changed.
    const stale = await page.context().newPage();
    await stale.goto(page.url());
    await expect(rewritesLeft(stale, "flow")).toContainText(`${FREE_REWRITES} of`);

    for (let i = 1; i <= FREE_REWRITES; i++) {
      await startRewrite(page, "flow");
      await page.getByRole("button", { name: "Rewrite the process now" }).click();
      await expect(rewritesLeft(page, "flow")).toContainText(`${FREE_REWRITES - i} of`);
    }
    await startRewrite(page, "flow");
    await expect(page.getByTestId("tools-flow")).toContainText("No rewrites left on this exhbt.");
    await expect(page.getByTestId("tools-flow").getByRole("link", { name: "See your plan" })).toHaveAttribute("href", "/account/billing");

    await startRewrite(stale, "flow");
    await stale.getByRole("button", { name: "Rewrite the process now" }).click();
    const status = stale.getByTestId("tools-flow").getByTestId("tools-status");
    await expect(status).toContainText(`You've used all ${FREE_REWRITES} rewrites for this exhbt on the Free plan.`);
    await expect(status.getByRole("link", { name: "See your plan" })).toHaveAttribute("href", "/account/billing");
    await expect(stale.locator("body")).not.toContainText(`Preview rewrite ${FREE_REWRITES + 1}`);
  });

  test("no accessibility violations on the editor with the rewrite controls open", async ({ page }) => {
    await draftAndOpen(page, "a11y");
    await startRewrite(page, "findings");
    await startRewrite(page, "gap");
    // Make "Back to the AI version" show on the findings card too, so it is scanned, with its menu open.
    await findingsField(page).click();
    await page.keyboard.press("End");
    await page.keyboard.type(" extra");
    await openCardMenu(page, "findings");
    await expect(backToAiVersion(page, "findings")).toBeVisible();
    const { violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze();
    expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(", ")}`)).toEqual([]);
  });
});

test.describe("The drafting screen", () => {
  test("shows three steps and the usual time, then completes and opens the editor", async ({ page }) => {
    await signInToDraft(page, "progress");
    await page.route("**/api/exhbts/draft", async (route) => {
      await new Promise((r) => setTimeout(r, 8000));
      await route.continue();
    });
    await page.locator("#files").setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from(PROJECT) });
    await expect(page.getByTestId("file-status")).toContainText("uploaded");
    await page.getByRole("button", { name: "Draft my exhbt" }).click();

    const view = page.getByTestId("drafting");
    await expect(view).toContainText("usually takes about 20 seconds");
    const steps = view.getByRole("listitem");
    await expect(steps).toHaveCount(3);
    await expect(steps.nth(0)).toContainText("Reading your files");
    await expect(steps.nth(1)).toContainText("Finding the numbers");
    await expect(steps.nth(2)).toContainText("Writing your exhbt");
    await expect(steps.nth(0)).toHaveAttribute("data-state", "active");
    await expect(steps.nth(2)).toHaveAttribute("data-state", "waiting");
    // The timer moves on while we wait.
    await expect(steps.nth(1)).toHaveAttribute("data-state", "active");
    await expect(steps.nth(0)).toHaveAttribute("data-state", "done");
    // The answer arrives: everything is ticked, then the editor opens.
    await page.waitForURL(/\/exhbts\/[0-9a-f-]{36}\/edit$/);
  });

  test("if drafting fails the files and notes stay and Try again works without uploading again", async ({ page }) => {
    await signInToDraft(page, "fail");
    let uploads = 0;
    page.on("request", (r) => {
      if (r.url().includes("/api/files/upload-url")) uploads++;
    });
    await page.locator("#files").setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from(PROJECT) });
    await expect(page.getByTestId("file-status")).toContainText("uploaded");
    await page.locator("#notes").fill("Two practices over six weeks.");

    await page.route("**/api/exhbts/draft", (route) =>
      route.fulfill({ status: 502, contentType: "application/json", body: JSON.stringify({ error: "We couldn't draft your exhbt just now. Your files are saved: try again in a moment." }) }),
    );
    await page.getByRole("button", { name: "Draft my exhbt" }).click();
    const alert = page.getByRole("alert").filter({ hasText: "couldn't draft" });
    await expect(alert).toBeVisible();
    await expect(page.getByTestId("drafting")).toHaveCount(0);
    await expect(page.locator("#file-list")).toContainText("notes.txt");
    await expect(page.locator("#notes")).toHaveValue("Two practices over six weeks.");

    await page.unroute("**/api/exhbts/draft");
    await alert.getByRole("button", { name: "Try again" }).click();
    await page.waitForURL(/\/exhbts\/[0-9a-f-]{36}\/edit$/);
    expect(uploads).toBe(1);
  });
});
