import { FULL } from "./fixtures/portfolio-pages";
import { READY, expect, fresh, openEditor, setKind, test, uiNow, waitReady } from "./portfolio-editor";

// Portfolio first's structure, end to end (decision 0031, "The structure"; brief J of docs/briefs/portfolio-first).
// What e2e/portfolio-routes.spec.ts (H's) already proves is not repeated: the list's redirect with its query, the
// exhbt editor's way back, a publish landing at its tile, team invites, roadmap ideas, and ?joined=1 with
// #team-projects all the way into the editor. Sign-in landings and the nav are portfolio-landing's. Here: each
// other address the list is sent to (by the team actions, by emails) followed to what the editor does with it,
// and the same addresses at "steps", where the list draws them as it always has.
//
// Waiting for F's and G's work (the first-run strip, the vision band's button, the draft tile, the publish sheet):
// a new person's first journey, the publish sheet on Free and Premium.

/** Follows `/exhbts<rest>` (a redirect at "page") from another page, so even a hash alone loads it. */
async function arrive(page: import("@playwright/test").Page, rest: string) {
  await page.goto("/account");
  await page.goto(`/exhbts${rest}`);
}

test.describe("Where the exhbts list's addresses arrive, at page", () => {
  test("?full=1 arrives at the editor with the plan's reason ready for the Add tile, and nothing opens", async ({ page }) => {
    await openEditor(page, fresh(FULL, "stfull"));
    await arrive(page, "?full=1");
    await waitReady(page);
    await expect.poll(async () => (await uiNow(page)).full).toBe(true);
    expect((await uiNow(page)).sheet).toBeNull();
    await expect.poll(() => page.evaluate(() => location.pathname + location.search)).toBe("/portfolio");
  });

  test("?left=1 opens Team with the note about leaving, and the note's words stay until Team closes", async ({ page }) => {
    await openEditor(page, fresh(FULL, "stleft"));
    await arrive(page, "?left=1#team-projects");
    await waitReady(page);
    await expect.poll(async () => (await uiNow(page)).sheet).toBe("team");
    expect((await uiNow(page)).team).toBe("left");
    await expect.poll(() => page.evaluate(() => location.pathname + location.search + location.hash)).toBe("/portfolio?left=1");
  });

  test("#team-projects alone, as sent emails carry it, opens Team with no note", async ({ page }) => {
    await openEditor(page, fresh(FULL, "sthash"));
    await arrive(page, "#team-projects");
    await waitReady(page);
    await expect.poll(async () => (await uiNow(page)).sheet).toBe("team");
    expect((await uiNow(page)).team).toBeNull();
    await expect.poll(() => page.evaluate(() => location.pathname + location.search + location.hash)).toBe("/portfolio");
  });
});

test.describe("The same addresses at steps", () => {
  test("the list draws them as it always has: the notes after joining and leaving, and no editor", async ({ page }) => {
    await openEditor(page, fresh(FULL, "ststeps"));
    await setKind(page, "steps");
    for (const [rest, note] of [
      // TEAM_SAID in components/team/TeamPanel.tsx (a server-only module, so its opening words are matched here).
      ["?joined=1#team-projects", /^You're on the team\./],
      ["?left=1#team-projects", /^You've left the project\./],
    ] as const) {
      await arrive(page, rest);
      await expect(page).toHaveURL(new RegExp(`/exhbts\\${rest.split("#")[0]}`));
      await expect(page.getByRole("heading", { level: 1, name: "Your exhbts" })).toBeVisible();
      await expect(page.locator("[data-said]")).toHaveText(note);
      await expect(page.locator(READY)).toHaveCount(0);
    }
  });
});
