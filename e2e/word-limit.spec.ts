import { expect, test } from "@playwright/test";
import { LIMITS } from "../lib/exhbt/blocks";
import * as classic from "./editor-classic-helpers";
import { freshName } from "./page-editor";

/*
 * One word limit for the page (decision 0030), in the classic editor, which is still what everyone gets by default: no
 * part has a word cap of its own, so a long finding shows no count against a cap and no message, and only the page's
 * 200 words stop publishing. The new editor's side is in e2e/phase2-editor-media.spec.ts ("over 200 words") and
 * e2e/editor-inplace.spec.ts ("a finding with an issue").
 */

const nWords = (n: number) => Array.from({ length: n }, (_, i) => `w${i}`).join(" ");

test("the classic editor holds a finding to no cap of its own; only the page's 200 words stop publishing", async ({ page }) => {
  await classic.signInAs(page, freshName("capclassic"), "premium");
  await classic.startFromScratch(page);
  await classic.fillValid(page, "Shorter lunch queues");
  // 30 words in Finding 1: past the 20 a finding was held to until 25 Nov 2026. No count against a cap, no message.
  const first = page.getByRole("textbox", { name: "Finding 1" });
  await first.fill(nWords(30));
  await expect(page.getByText(/\d+ \/ \d+ words/)).toHaveCount(0);
  await expect(page.getByText(/Keep each finding/)).toHaveCount(0);
  await expect(first).not.toHaveAttribute("aria-invalid", "true");
  // Past the page's 200 words, the page's own limit holds, and publishing is refused.
  await page.getByRole("textbox", { name: "Finding 2" }).fill(nWords(LIMITS.totalWords));
  await expect(page.getByText(`Keep the whole exhbt to ${LIMITS.totalWords} words`).first()).toBeVisible();
  await page.getByLabel("This is my work, and the numbers are true").check();
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(page.getByText(/^(It's live|Your changes are live)\b/)).toHaveCount(0);
  await expect(page.getByText(/Keep each finding/)).toHaveCount(0);
});
