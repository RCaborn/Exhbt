import { expect, test } from "./editor-test";
import { openBankingDoc } from "../lib/exhbt/sample";
import type { ExhbtDoc } from "../lib/exhbt/blocks";
import { portfolioHref } from "../lib/portfolio-links";
import { freshName, openNew, waitSaved } from "./page-editor";

/*
 * The exhbt editor's live links go through portfolioHref (decision 0031, the hotfix). On the real
 * domains a person's portfolio is https://<name>.exhbt.co.uk, and /p/<name> answers 404 there.
 */

test.describe("portfolioHref", () => {
  for (const host of ["www.exhbt.co.uk", "app.exhbt.co.uk", "exhbt.co.uk", "www.exhbt.co.uk:443", "exhbt.co.uk:8080", "WWW.Exhbt.co.uk"]) {
    test(`${host} gives the subdomain`, () => {
      expect(portfolioHref("alex", host)).toBe("https://alex.exhbt.co.uk");
    });
  }
  for (const host of ["localhost:3200", "localhost", "exhbt-preview.example.workers.dev", null]) {
    test(`${host ?? "no host"} gives /p/alex`, () => {
      expect(portfolioHref("alex", host)).toBe("/p/alex");
    });
  }
});

test("the publish sheet's portfolio links go to /p/<name> in development", async ({ page }) => {
  const user = freshName("live");
  const id = await openNew(page, user);
  await page.evaluate((d) => window.__exhbtEditor!.patchDoc(() => d), openBankingDoc as ExhbtDoc as never);
  await waitSaved(page, id);
  await page.getByRole("button", { name: "Review and publish" }).click();
  const s = page.locator('dialog[data-sheet="publish"]');
  await expect(s).toBeVisible();
  await expect(s.getByTestId("where-it-goes").getByRole("link")).toHaveAttribute("href", `/p/${user}`);
  await s.getByLabel("This is my work, and the numbers are true").check();
  await s.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(s.getByText("It's live on your portfolio.")).toBeVisible();
  await expect(s.getByRole("link", { name: "See your portfolio" })).toHaveAttribute("href", `/p/${user}`);
  await expect(s.getByRole("link", { name: "View it" })).toHaveAttribute("href", new RegExp(user));
});
