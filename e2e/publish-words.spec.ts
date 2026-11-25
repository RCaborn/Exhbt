import { expect, test } from "@playwright/test";
import { liveLine, portfolioAddress } from "../lib/exhbt/publish-words";
import { openPublishSheet, publishSheet, startFromScratch } from "./editor";
import * as classic from "./editor-classic-helpers";
import { uniqueEmail } from "./helpers";
import { freshName } from "./page-editor";

/*
 * What publishing says about the portfolio (Rory and Alex, 25 Nov 2026: "Am I publishing this one exhbt, or my
 * portfolio?"): before, where the exhbt goes; after, that it is live there, with a way to the portfolio. The same words
 * in both editors (components/editor/PublishWhere.tsx). The new editor's sheet with a username is in
 * e2e/editor-sheets.spec.ts, "a complete exhbt".
 */

test.describe("What publishing says about the portfolio", () => {
  test("the words after publishing, and for an exhbt hidden from the portfolio's home page", () => {
    expect(liveLine(false, false)).toBe("It's live on your portfolio.");
    expect(liveLine(true, false)).toBe("Your changes are live on your portfolio.");
    // Hidden from the home page (decision 0014): live at its own link, and not listed there.
    expect(liveLine(false, true)).toBe("It's live at its own link.");
    expect(liveLine(true, true)).toBe("Your changes are live at its own link.");
    expect(portfolioAddress("https://rory.exhbt.co.uk")).toBe("rory.exhbt.co.uk");
    expect(portfolioAddress("/p/rory")).toBe("/p/rory");
  });

  test("with no username yet, the sheet says exhbts go on a portfolio at yourname.exhbt.co.uk, and links to choosing one", async ({ page }) => {
    await page.goto(`/auth/dev?email=${encodeURIComponent(uniqueEmail("nouser"))}&next=/exhbts`);
    await page.goto("/dev/plan?plan=premium&next=/exhbts");
    await startFromScratch(page);
    await openPublishSheet(page);
    const s = publishSheet(page);
    await expect(s.getByText("Your exhbts go on your own portfolio, at yourname.exhbt.co.uk. You need a username to publish.")).toBeVisible();
    await expect(s.getByRole("link", { name: "Choose one" })).toHaveAttribute("href", "/account/portfolio");
  });

  test("the classic editor says the same: where it goes, then live on the portfolio, with See your portfolio", async ({ page }) => {
    const user = freshName("pubclassic");
    await classic.signInAs(page, user, "premium");
    await classic.startFromScratch(page);
    await expect(page.getByTestId("where-it-goes")).toHaveText(`Publishing puts this exhbt on your portfolio at /p/${user}, with its own link to send with applications.`);
    await classic.fillValid(page, "Shorter lunch queues");
    await classic.waitForSaved(page);
    await classic.publish(page);
    await expect(page.getByText("Paste this into an application:")).toBeVisible();
    await expect(page.getByRole("link", { name: "See your portfolio" })).toHaveAttribute("href", `/p/${user}`);
    await expect(page.getByTestId("where-it-goes")).toHaveCount(0);
  });
});
