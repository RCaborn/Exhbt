import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// The skill radar's own behaviour, on the home page example (fixed data, no AI): one radar, the
// job always drawn, "you" switching between Now and After the projects, every axis marked.
// Rules in lib/roadmap/radar.ts and lib/roadmap/skills.ts are in skills.spec.ts.

const section = (page: Page) => page.locator("section[aria-labelledby=gaps-example]");
const youPoints = (page: Page) => section(page).locator("polygon[data-series=you]").getAttribute("points");
const states = async (page: Page) => section(page).locator("[data-axis]").evaluateAll((els) => els.map((e) => `${e.getAttribute("data-axis")}:${e.getAttribute("data-state")}`));

test.describe("skill radar", () => {
  test("every axis has a marker, and nothing is capped", async ({ page }) => {
    await page.goto("/");
    const axes = section(page).locator("[data-axis]");
    await expect(axes).toHaveCount(6);
    // Six axes, six labels, each with one marker (a tick or an arrow) and its name.
    for (const axis of await axes.all()) await expect(axis.locator(":scope > span[aria-hidden]")).toHaveCount(1);
    expect(await states(page)).toEqual([
      "SQL:below",
      "Data visualisation:below",
      "Statistics:below",
      "Excel:meets",
      "Python:meets",
      "Dashboards:below",
    ]);
    // The lists hold every axis once between them.
    const up = await section(page).getByRole("list", { name: "Level up next" }).getByRole("listitem").count();
    const bag = await section(page).getByRole("list", { name: "In the bag" }).getByRole("listitem").count();
    expect(up + bag).toBe(6);
  });

  test("the switch changes the fill, the markers and the lists, and the job stays put", async ({ page }) => {
    await page.goto("/");
    const now = section(page).getByRole("button", { name: "Now" });
    const after = section(page).getByRole("button", { name: "After the projects" });
    await expect(now).toHaveAttribute("aria-pressed", "true");
    await expect(after).toHaveAttribute("aria-pressed", "false");
    const nowFill = await youPoints(page);
    const job = await section(page).locator("polygon[data-series=job]").getAttribute("points");
    const nowStates = await states(page);

    await after.click();
    await expect(after).toHaveAttribute("aria-pressed", "true");
    await expect(now).toHaveAttribute("aria-pressed", "false");
    expect(await youPoints(page)).not.toBe(nowFill);
    expect(await section(page).locator("polygon[data-series=job]").getAttribute("points")).toBe(job);
    expect(await states(page)).not.toEqual(nowStates);
    expect(await states(page)).toEqual([
      "SQL:meets",
      "Data visualisation:meets",
      "Statistics:below",
      "Excel:meets",
      "Python:meets",
      "Dashboards:meets",
    ]);
    await expect(section(page).getByText("If you do the suggested projects.")).toBeVisible();

    // And back again.
    await now.click();
    expect(await youPoints(page)).toBe(nowFill);
    expect(await states(page)).toEqual(nowStates);
  });

  test("the hidden table holds now, after and the job's level whichever view shows", async ({ page }) => {
    await page.goto("/");
    const table = section(page).getByRole("table", { name: /Amara/ });
    const rows = async () => table.getByRole("row").allTextContents();
    const before = await rows();
    expect(before[0]).toMatch(/Skill\s*Now\s*After the projects\s*What the job asks for/);
    expect(before.slice(1)).toEqual([
      "SQL1 of 44 of 44 of 4",
      "Data visualisation2 of 43 of 43 of 4",
      "Statistics2 of 42 of 43 of 4",
      "Excel2 of 42 of 42 of 4",
      "Python3 of 43 of 42 of 4",
      "Dashboards0 of 42 of 42 of 4",
    ]);
    await section(page).getByRole("button", { name: "After the projects" }).click();
    expect(await rows()).toEqual(before);
  });

  test("the switch works from the keyboard", async ({ page }) => {
    await page.goto("/");
    const after = section(page).getByRole("button", { name: "After the projects" });
    await expect(after).toBeVisible();
    await after.focus();
    await page.keyboard.press("Enter");
    await expect(after).toHaveAttribute("aria-pressed", "true");
    // Shift+Tab to Now, then Space.
    await page.keyboard.press("Shift+Tab");
    await expect(section(page).getByRole("button", { name: "Now" })).toBeFocused();
    await page.keyboard.press("Space");
    await expect(section(page).getByRole("button", { name: "Now" })).toHaveAttribute("aria-pressed", "true");
    await expect(after).toHaveAttribute("aria-pressed", "false");
  });

  test("the example passes axe in both views", async ({ page }) => {
    await page.goto("/");
    await expect(section(page).getByRole("button", { name: "Now" })).toBeVisible();
    for (const view of ["Now", "After the projects"]) {
      await section(page).getByRole("button", { name: view }).click();
      const { violations } = await new AxeBuilder({ page }).include("section[aria-labelledby=gaps-example]").withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
      expect(violations.map((v) => `${view} ${v.id}: ${v.nodes.map((n) => n.target).join(", ")}`)).toEqual([]);
    }
  });
});
