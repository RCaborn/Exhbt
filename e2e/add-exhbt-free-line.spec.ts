import { expect, test } from "@playwright/test";
import { PLAN_NAMES } from "../lib/entitlements";
import { ADD_EXHBT, DRAFT_WITH_AI } from "./add-exhbt";
import { signInAs } from "./editor";
import { freshName } from "./page-editor";

/*
 * The Free line ("On Free, an exhbt stays private ...") is said before anyone starts. The chooser at /exhbts/new
 * has it; a Free account that lands straight on the draft form (/exhbts/new?start=draft) gets the same line from
 * the same component (job 3a, `FreePrivateLine`). A plan with a public portfolio sees it on neither.
 */
test.describe.configure({ timeout: 240_000 });

const LINE = `On ${PLAN_NAMES.free}, an exhbt stays private: only you can see it until you pay to put it online.`;

test("a Free account landing on the draft form sees the same Free line as the chooser", async ({ page }) => {
  await signInAs(page, freshName("freeline"), "free");
  await page.goto(ADD_EXHBT);
  const chooser = page.locator("[data-free-private]");
  await expect(chooser).toHaveText(LINE);
  const chooserTag = await chooser.evaluate((el) => el.tagName);

  await page.goto(DRAFT_WITH_AI);
  await expect(page.getByRole("heading", { level: 1, name: "Draft it from your files" })).toBeVisible();
  const line = page.locator("[data-free-private]");
  await expect(line).toHaveCount(1);
  await expect(line).toHaveText(LINE);
  expect(await line.evaluate((el) => el.tagName)).toBe(chooserTag);
  // It stands with the intro and the allowance, inside the card, before the form.
  await expect(page.locator("#allowance")).toBeVisible();
});

test("a plan with a public portfolio sees no Free line on the draft form", async ({ page }) => {
  await signInAs(page, freshName("paidline"), "premium");
  await page.goto(DRAFT_WITH_AI);
  await expect(page.getByRole("heading", { level: 1, name: "Draft it from your files" })).toBeVisible();
  await expect(page.locator("[data-free-private]")).toHaveCount(0);
});
