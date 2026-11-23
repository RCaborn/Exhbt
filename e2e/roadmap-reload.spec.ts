import { expect, test } from "@playwright/test";
import { buildRoadmap, waitForResult } from "./helpers";

/**
 * Two generations of one roadmap at once (a reload or a second tab while "Building your roadmap"
 * runs): the first result saved wins, and the later one is discarded rather than overwriting it.
 * The stand-in is told by "[roadmap-delay=ms]" in the skills box to make the first generation slow
 * and the next one quick, and each run's summary names its run.
 */
test("a second generation started by a reload doesn't overwrite the roadmap already saved", async ({ page, context }) => {
  await buildRoadmap(page, { skills: "Excel, SQL [roadmap-delay=8000]" });
  await page.waitForURL(/\/roadmap\/[0-9a-f-]{36}/);
  const id = page.url().match(/roadmap\/([0-9a-f-]{36})/)![1]!;

  // The page's own generation is slow; this second one (a reload, in effect) finishes first and is saved.
  const second = await page.request.post(`/api/roadmap/${id}/generate`);
  expect(second.ok()).toBe(true);
  const other = await context.newPage();
  await other.goto(`/roadmap/${id}`);
  const runOf = async (p: typeof page) => (await p.getByText(/Stand-in run \d+\./).innerText()).match(/Stand-in run (\d+)/)![1];
  const saved = await runOf(other);

  // The first generation then finishes: it is discarded, and its page shows the saved roadmap.
  await waitForResult(page);
  expect(await runOf(page)).toBe(saved);
  await other.reload();
  expect(await runOf(other)).toBe(saved);
});
