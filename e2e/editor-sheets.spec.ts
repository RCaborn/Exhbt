import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import type { ExhbtDoc } from "../lib/exhbt/blocks";
import { openBankingDoc } from "../lib/exhbt/sample";
import { docNow, field, freshName, openDoc, openNew, READY, readStored, waitSaved } from "./page-editor";

/*
 * The edit-on-page editor's sheets (decision 0026, "What the page does not draw"): review and publish,
 * card and link details, and the work. Each is a native dialog: it traps focus, closes on Escape, gives
 * the focus back, and fills the screen on a phone.
 */

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
const PDF = { name: "report.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n") };
const PDF2 = { name: "second.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n2 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n") };

const sheet = (page: Page, name: string) => page.locator(`dialog[data-sheet="${name}"]`);
const openUi = (page: Page, name: string) => page.evaluate((n) => window.__exhbtUi!.open(n as "publish"), name);
const openPublish = async (page: Page) => {
  await page.getByRole("button", { name: "Review and publish" }).click();
  await expect(sheet(page, "publish")).toBeVisible();
};

/** Puts a whole doc in the editor (an edit like any other) and waits for it to be saved. */
async function setDoc(page: Page, id: string, doc: ExhbtDoc) {
  await page.evaluate((d) => window.__exhbtEditor!.patchDoc(() => d), doc as never);
  await waitSaved(page, id);
}

const complete = (extra: Partial<ExhbtDoc> = {}): ExhbtDoc => ({ ...openBankingDoc, ...extra }) as ExhbtDoc;

test.describe("review and publish", () => {
  test("a complete exhbt: tick, Publish, It's live., the address opens; then a change and Publish changes", async ({ page }) => {
    const user = freshName("pub");
    const id = await openNew(page, user);
    await setDoc(page, id, complete());
    await openPublish(page);
    const s = sheet(page, "publish");
    await expect(s.getByRole("button", { name: "Publish", exact: true })).toBeVisible();
    await s.getByLabel("This is my work, and the numbers are true").check();
    await s.getByRole("button", { name: "Publish", exact: true }).click();
    await expect(s.getByText("It's live.")).toBeVisible();
    const view = s.getByRole("link", { name: "View it" });
    const href = (await view.getAttribute("href"))!;
    expect(href).toContain(user);
    await expect(s.getByRole("button", { name: /Copy link/ })).toBeVisible();
    await expect(s.getByRole("link", { name: "Back to your exhbts" })).toBeVisible();
    const live = await page.request.get(href);
    expect(live.status()).toBe(200);

    // The status changed with no reload: the button now says so, and a change goes live with it.
    await page.keyboard.press("Escape");
    await expect(s).toBeHidden();
    const title = field(page, "title");
    await title.click();
    await page.keyboard.press("End");
    await page.keyboard.type(" Updated.");
    await waitSaved(page, id);
    await openPublish(page);
    await expect(s.getByText(/^Live at /)).toBeVisible();
    await s.getByRole("button", { name: "Publish changes" }).click();
    await expect(s.getByText("Your changes are live.")).toBeVisible();
    const stored = await readStored(page, id);
    expect(stored.published?.title).toContain("Updated.");
  });

  test("an incomplete exhbt: the reasons show, Show me lands in the first field to fix, and Confirmed by is hollow until the tick", async ({ page }) => {
    await openNew(page, freshName("inc"));
    await expect(page.getByText("Not confirmed yet")).toBeVisible();
    await openPublish(page);
    const s = sheet(page, "publish");
    await expect(s.getByText(/things? to fix before this can go live\./)).toBeVisible();
    await s.getByRole("button", { name: "Publish", exact: true }).click();
    await expect(s.locator("[role=status] li").first()).toBeVisible();
    await s.getByRole("button", { name: "Show me" }).first().click();
    await expect(s).toBeHidden();
    await expect.poll(() => page.evaluate(() => document.activeElement?.getAttribute("data-path") ?? document.activeElement?.closest("[data-path]")?.getAttribute("data-path"))).toBe("title");

    await openPublish(page);
    await s.getByLabel("This is my work, and the numbers are true").check();
    await page.keyboard.press("Escape");
    await expect(page.getByText(/^Confirmed by /)).toBeVisible();
  });

  test("one flagged number: it is listed, That's right, the tick, Publish gives It's live.", async ({ page }) => {
    const id = await openNew(page, freshName("flag"));
    await setDoc(page, id, complete({ unverified: ["18%"] }));
    await openPublish(page);
    const s = sheet(page, "publish");
    const list = s.getByRole("list", { name: "Numbers to check" });
    await expect(list).toContainText("Check this number: 18%");
    await list.getByRole("button", { name: "That's right: 18%" }).click();
    await expect(list).toBeHidden();
    await s.getByLabel("This is my work, and the numbers are true").check();
    await s.getByRole("button", { name: "Publish", exact: true }).click();
    await expect(s.getByText("It's live.")).toBeVisible();
  });

  test("a Free plan sees the preview-only words and no Publish button", async ({ page }) => {
    await openDoc(page, freshName("free"), complete(), { plan: "free" });
    await openPublish(page);
    const s = sheet(page, "publish");
    await expect(s.getByText("This exhbt is a preview only: nobody else can see it.")).toBeVisible();
    await expect(s.getByRole("button", { name: /^Publish/ })).toHaveCount(0);
  });

  test("Unpublish asks once, then the exhbt goes back to a draft", async ({ page }) => {
    const { url } = await openDoc(page, freshName("unpub"), complete());
    expect((await page.request.get(url)).status()).toBe(200);
    await openPublish(page);
    const s = sheet(page, "publish");
    await s.getByRole("button", { name: "Unpublish" }).click();
    await s.getByRole("button", { name: "Yes, unpublish" }).click();
    await expect.poll(async () => (await page.request.get(url)).status()).toBe(404);
    await expect(s.getByRole("button", { name: "Publish", exact: true })).toBeVisible();
  });
});

test.describe("card and link details", () => {
  test("the summary shows on the tile beside it, is saved, and an over-long one shows its issue", async ({ page }) => {
    const id = await openNew(page, freshName("card"));
    await openUi(page, "card");
    const s = sheet(page, "card");
    const summary = s.getByLabel("One-sentence summary");
    await expect(s.getByText("What you found, in one sentence. Shown on your portfolio's cards.")).toBeVisible();
    await summary.fill("Waits fell by two thirds.");
    await expect(s.getByTestId("tile-summary")).toHaveText("Waits fell by two thirds.");
    await s.getByLabel("Headline number", { exact: true }).fill("-18%");
    await s.getByLabel("What the number measures").fill("missed appointments");
    await expect(s.locator("[data-headline]")).toContainText("-18%");
    await waitSaved(page, id);
    const stored = (await readStored(page, id)).working;
    expect(stored.summary).toBe("Waits fell by two thirds.");
    expect(stored.headline).toEqual({ value: "-18%", label: "missed appointments" });

    await summary.fill(Array.from({ length: 30 }, (_, i) => `word${i}`).join(" "));
    await expect(s.getByText(/Keep the summary to one sentence/)).toBeVisible();
    await expect(summary).toHaveAttribute("aria-invalid", "true");
  });

  test("Show me on a summary issue opens the card sheet with the cursor in the field", async ({ page }) => {
    const id = await openNew(page, freshName("cardjump"));
    await setDoc(page, id, complete({ summary: Array.from({ length: 30 }, (_, i) => `word${i}`).join(" ") }));
    await openPublish(page);
    await sheet(page, "publish").getByRole("button", { name: "Show me" }).first().click();
    await expect(sheet(page, "card")).toBeVisible();
    await expect(sheet(page, "card").getByLabel("One-sentence summary")).toBeFocused();
  });
});

test.describe("the work", () => {
  test("a link and its name appear on the sidebar button", async ({ page }) => {
    const id = await openNew(page, freshName("work"));
    const button = page.getByRole("button", { name: "Add the work" });
    await button.click();
    const s = sheet(page, "work");
    await s.getByLabel("Link to the work").fill("https://example.com/report");
    await s.getByLabel("Name on the button").fill("Final report");
    await expect(s.getByLabel("Link to the work")).toHaveAttribute("data-path", "evidence");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "See the work: Final report" })).toBeVisible();
    await waitSaved(page, id);
    expect((await readStored(page, id)).working.evidence).toEqual({ kind: "link", href: "https://example.com/report", label: "Final report" });
  });

  test("a file can be attached, replaced and removed; Undo brings it back", async ({ page }) => {
    const id = await openNew(page, freshName("workfile"));
    await page.getByRole("button", { name: "Add the work" }).click();
    const s = sheet(page, "work");
    await s.getByLabel("Choose a file").setInputFiles(PDF);
    await expect(s.getByText("File attached:")).toContainText("report.pdf");
    const first = (await docNow(page)).evidence;
    expect(first).toMatchObject({ kind: "file", label: "report.pdf" });

    await s.getByLabel("Choose a file").setInputFiles(PDF2);
    await expect(s.getByText("File attached:")).toContainText("second.pdf");
    const second = (await docNow(page)).evidence as { fileId: string };
    expect(second.fileId).not.toBe((first as { fileId: string }).fileId);

    await s.getByRole("button", { name: "Remove the file" }).click();
    await expect(s.getByLabel("Link to the work")).toBeVisible();
    expect((await docNow(page)).evidence).toBeUndefined();
    await page.evaluate(() => window.__exhbtEditor!.undo());
    await expect(s.getByText("File attached:")).toContainText("second.pdf");
    expect(((await docNow(page)).evidence as { fileId: string }).fileId).toBe(second.fileId);
    await waitSaved(page, id);
    expect(((await readStored(page, id)).working.evidence as { fileId: string }).fileId).toBe(second.fileId);
  });
});

test.describe("every sheet", () => {
  const OPEN: Record<string, (page: Page) => Promise<void>> = {
    publish: async (page) => void (await page.getByRole("button", { name: "Review and publish" }).click()),
    work: async (page) => void (await page.getByRole("button", { name: "Add the work" }).click()),
    card: async (page) => {
      const opener = page.getByRole("button", { name: "Review and publish" });
      await opener.focus();
      await openUi(page, "card");
    },
  };

  for (const name of ["publish", "card", "work"]) {
    test(`${name}: traps focus, closes on Escape, gives the focus back, fills a phone, and has no axe violations`, async ({ page }) => {
      await openNew(page, freshName(`sh${name}`));
      await OPEN[name]!(page);
      const s = sheet(page, name);
      await expect(s).toBeVisible();
      await expect(s).toHaveAttribute("aria-labelledby", /.+/);

      const { violations } = await new AxeBuilder({ page }).include(`dialog[data-sheet="${name}"]`).withTags(WCAG).analyze();
      expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(", ")}`)).toEqual([]);

      for (let i = 0; i < 14; i++) {
        await page.keyboard.press("Tab");
        // A modal dialog makes the page behind it inert: the focus is in the sheet, or has left the page for the browser's own controls (body).
        expect(
          await page.evaluate((n) => {
            const a = document.activeElement;
            return !a || a === document.body || Boolean(a.closest(`dialog[data-sheet="${n}"]`));
          }, name),
        ).toBe(true);
      }

      await page.setViewportSize({ width: 390, height: 800 });
      const box = (await s.boundingBox())!;
      expect(Math.round(box.width)).toBe(390);
      expect(Math.round(box.height)).toBe(800);
      await page.setViewportSize({ width: 1280, height: 800 });

      const opener = await page.evaluate(() => (document.activeElement ? 1 : 0));
      expect(opener).toBe(1);
      await page.keyboard.press("Escape");
      await expect(s).toBeHidden();
      const back = name === "publish" ? "Review and publish" : name === "work" ? "Add the work" : "Review and publish";
      await expect(page.getByRole("button", { name: back })).toBeFocused();
    });
  }
});

test.afterEach(async ({ page }) => {
  await expect(page.locator(READY)).toBeAttached();
});

test.describe("a file already on someone else's exhbt, attached in the work sheet", () => {
  test("the question appears above the sheet and can be answered without closing it; the focus goes in and comes back", async ({ page }) => {
    const notes = Buffer.from(`Survey of 412 patients about reminders, cleaned in Python. Ref ${freshName("n")}.`);
    // The owner uploads it to their exhbt.
    const ownerId = await openNew(page, freshName("orig"));
    const ticket = await page.request.post("/api/files/upload-url", { data: { name: "report.txt", mime: "text/plain", bytes: notes.length, kind: "evidence", exhbtId: ownerId } });
    expect(ticket.ok()).toBe(true);
    const { fileId, uploadUrl } = (await ticket.json()) as { fileId: string; uploadUrl: string };
    expect((await page.request.put(uploadUrl, { data: notes, headers: { "content-type": "text/plain" } })).status()).toBe(200);
    expect((await page.request.post(`/api/files/${fileId}/complete`)).ok()).toBe(true);

    // Someone else attaches the same file as their work.
    await openNew(page, freshName("str"));
    await page.getByRole("button", { name: "Add the work" }).click();
    const s = sheet(page, "work");
    await expect(s).toBeVisible();
    await s.locator("input[aria-label='Choose a file']").setInputFiles({ name: "my-report.txt", mimeType: "text/plain", buffer: notes });
    const prompt = page.getByTestId("match-prompt");
    await expect(prompt.getByRole("heading", { name: "This file is already on someone else's exhbt" })).toBeVisible();
    // Above the sheet, with the focus in it, and a real press reaches it (no `intercepts pointer events`).
    await expect(prompt.getByRole("button", { name: "Ask to join" })).toBeFocused();
    expect(await prompt.evaluate((el) => el.matches(":modal"))).toBe(true);
    await prompt.getByRole("button", { name: "Ask to join" }).click();
    await expect(prompt.getByLabel(/Your part in it/)).toBeVisible();
    await expect(s).toBeAttached();
    await prompt.getByRole("button", { name: "Back" }).click();
    await prompt.getByRole("button", { name: "Decide later" }).click();
    await expect(prompt).toHaveCount(0);
    // Back in the sheet, which stayed open with the file attached, the focus inside it.
    await expect(s).toBeVisible();
    await expect(s.getByText("File attached:")).toBeVisible();
    expect(await s.evaluate((el) => el.contains(document.activeElement))).toBe(true);
    await page.keyboard.press("Escape");
    await expect(s).toBeHidden();
  });
});
