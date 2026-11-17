import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { buildRoadmap, uniqueEmail, unlockProjects, waitForResult } from "./helpers";

/**
 * The project ideas are written in the background after the roadmap (docs/decisions/0019). The
 * development stand-in is told how slow or broken to be by a marker in the skills box
 * (`[ideas-delay=ms]`, `[ideas-fail=n]`), so each test sets its own.
 */

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
const NOTHING = /didn.t have enough|haven.t got anything|nothing for you|no project ideas/i;

async function roadmapWith(page: Page, marker: string) {
  await buildRoadmap(page, { skills: `Excel, SQL ${marker}` });
  await waitForResult(page);
}

const roadmapId = (page: Page) => page.url().match(/roadmap\/([0-9a-f-]{36})/)![1];
const ideaList = (page: Page) => page.getByRole("list", { name: "Project ideas" }).getByRole("listitem");
const failure = (page: Page) => page.getByRole("alert").filter({ hasText: "project ideas" });
const pendingBox = (page: Page) => page.getByRole("status").filter({ hasText: "Writing your project ideas" });
const statusOf = async (page: Page, id: string) => (await (await page.request.get(`/api/roadmap/${id}/ideas`)).json()).status;

test.describe("Project ideas: loading and failure", () => {
  test("slow ideas show a progress state, then the ideas, with no reload and no empty message", async ({ page }) => {
    await roadmapWith(page, "[ideas-delay=9000]");
    await unlockProjects(page, { email: uniqueEmail("slow") });

    await expect(page.getByRole("heading", { level: 1, name: "Projects that would prove them" })).toBeVisible();
    await expect(pendingBox(page)).toBeVisible();
    await expect(pendingBox(page).getByText("Matching projects to your gaps")).toBeVisible();
    await expect(page.getByText(NOTHING)).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Try again" })).toHaveCount(0);

    // Marks the document so a full reload would be noticed.
    await page.evaluate(() => ((window as unknown as { __kept: boolean }).__kept = true));
    await expect(ideaList(page)).toHaveCount(3, { timeout: 30_000 });
    await expect(ideaList(page).first()).toContainText("Placeholder project 1");
    expect(await page.evaluate(() => (window as unknown as { __kept?: boolean }).__kept)).toBe(true);
    await expect(pendingBox(page)).toHaveCount(0);
    await expect(page.getByText(NOTHING)).toHaveCount(0);
  });

  test("the pending state passes axe", async ({ page }) => {
    await roadmapWith(page, "[ideas-delay=20000]");
    await unlockProjects(page, { email: uniqueEmail("axe") });
    await expect(pendingBox(page)).toBeVisible();
    const { violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze();
    expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(", ")}`)).toEqual([]);
  });

  test("a failed run says so plainly, and Try again brings the ideas", async ({ page }) => {
    await roadmapWith(page, "[ideas-fail=1]");
    await unlockProjects(page, { email: uniqueEmail("fail") });

    const alert = failure(page).filter({ hasText: "We couldn’t write your project ideas" });
    await expect(alert).toBeVisible();
    await expect(alert).toContainText("Your roadmap and answers are saved");
    await expect(page.getByText(NOTHING)).toHaveCount(0);
    await expect(ideaList(page)).toHaveCount(0);

    await page.getByRole("button", { name: "Try again" }).click();
    await expect(ideaList(page)).toHaveCount(3);
    await expect(alert).toHaveCount(0);
  });

  test("Try again is limited, and the limit is explained rather than offered again", async ({ page }) => {
    await roadmapWith(page, "[ideas-fail=99]");
    await unlockProjects(page, { email: uniqueEmail("limit") });
    // One try at the start, then four more from the button.
    for (let i = 0; i < 4; i++) {
      await page.getByRole("button", { name: "Try again" }).click();
      await expect(failure(page)).toBeVisible();
    }
    await expect(failure(page)).toContainText("tried a few times");
    await expect(page.getByRole("button", { name: "Try again" })).toHaveCount(0);
  });

  test("ideas are started when the roadmap is saved, so they're ready before the gate", async ({ page }) => {
    await buildRoadmap(page);
    await waitForResult(page);
    await expect.poll(() => statusOf(page, roadmapId(page))).toBe("ready");

    await unlockProjects(page, { email: uniqueEmail("early") });
    await expect(ideaList(page)).toHaveCount(3);
    await expect(pendingBox(page)).toHaveCount(0);
  });

  test("two starts at once make the ideas once", async ({ page }) => {
    await roadmapWith(page, "[ideas-delay=2000]");
    const id = roadmapId(page);
    const answers = await Promise.all([1, 2, 3].map(() => page.request.post(`/api/roadmap/${id}/ideas`, { data: {} })));
    for (const a of answers) expect(["pending", "ready"]).toContain((await a.json()).status);
    await expect.poll(() => statusOf(page, id)).toBe("ready");
    await unlockProjects(page, { email: uniqueEmail("once") });
    await expect(ideaList(page)).toHaveCount(3);
  });
});
