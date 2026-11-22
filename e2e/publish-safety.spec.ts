import { expect, test } from "@playwright/test";
import { validateForPublish, type ExhbtDoc } from "../lib/exhbt/blocks";
import { openBankingDoc } from "../lib/exhbt/sample";

/*
 * Two things that keep an unsafe or unchecked doc off the public page (release 3 review, security-1):
 *  - the page draws the work link only when it is https;
 *  - store.publishExhbt checks the whole stored doc itself, so a save that lands between the publish
 *    action's own check and the store's copy cannot slip past validateForPublish.
 */

const withWork = (href: string): ExhbtDoc => ({ ...openBankingDoc, evidence: { kind: "link", label: "The repository", href } });

test.describe("the work link on the public page", () => {
  test("an https address is a link", async ({ page, request }) => {
    const res = await request.post("/dev/parity", { data: { username: "linkcheck", slug: "https-work", doc: withWork("https://example.com/repo") } });
    expect(res.ok()).toBe(true);
    await page.goto(((await res.json()) as { url: string }).url);
    const work = page.getByRole("link", { name: "See the work: The repository" });
    await expect(work).toHaveAttribute("href", "https://example.com/repo");
  });

  for (const href of ["javascript:alert(1)", "http://example.com/repo", "data:text/html,hello", "www.example.com/repo"]) {
    test(`${href} is not drawn as a link`, async ({ page, request }) => {
      const res = await request.post("/dev/parity", { data: { username: "linkcheck", slug: `bad-work-${href.length}`, doc: withWork(href) } });
      expect(res.ok()).toBe(true);
      await page.goto(((await res.json()) as { url: string }).url);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.getByText("See the work")).toHaveCount(0);
      expect(await page.locator("article a[href]").evaluateAll((as) => as.map((a) => a.getAttribute("href")).filter((h) => /^(javascript|data|http):/i.test(h ?? "")))).toEqual([]);
    });
  }
});

test.describe("the store checks the doc it publishes", () => {
  const publishStored = async (request: import("@playwright/test").APIRequestContext, username: string, doc: unknown) => {
    const res = await request.post("/dev/publish-check", { data: { username, doc } });
    expect(res.ok()).toBe(true);
    return (await res.json()) as { published: boolean; status: string | null; live: boolean };
  };

  test("a doc that passes is published", async ({ request }) => {
    expect(validateForPublish(openBankingDoc)).toEqual([]);
    expect(await publishStored(request, "pubcheck", openBankingDoc)).toEqual({ published: true, status: "published", live: true });
  });

  test("a stored doc that fails validateForPublish is not published", async ({ request }) => {
    for (const doc of [
      { ...openBankingDoc, title: "T".repeat(90) },
      withWork("javascript:alert(1)"),
      { ...openBankingDoc, sections: [] },
    ]) {
      expect(validateForPublish(doc as ExhbtDoc).length).toBeGreaterThan(0);
      expect(await publishStored(request, "pubcheck", doc)).toEqual({ published: false, status: "draft", live: false });
    }
  });

  test("a stored doc with a flagged number left is not published", async ({ request }) => {
    expect(await publishStored(request, "pubcheck", { ...openBankingDoc, unverified: ["18%"] })).toEqual({ published: false, status: "draft", live: false });
  });
});
