import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// Phase 2 hardening (docs/phase-2.md section 9): the account export covers the portfolio, and the
// privacy policy and terms describe what Phase 2 does. The in-memory store starts empty each run.

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
const unique = (tag: string) => `${tag}-${Date.now().toString(36)}${Math.floor(Math.random() * 1e3)}`;

test.describe("Account export", () => {
  test("includes the portfolio profile, both copies of each exhbt, file details and subscriptions", async ({ page }) => {
    const username = unique("export");
    const seeded = await page.request.get(`/dev/portfolio?username=${username}&plan=premium&count=2`, { maxRedirects: 0 });
    expect(seeded.status()).toBe(307);
    await page.goto(`/auth/dev?email=${username}@example.com&next=/account`);

    // A stored file: only its details should come back, never the bytes.
    const ticket = await page.request.post("/api/files/upload-url", {
      data: { name: "results.csv", mime: "text/csv", bytes: 120, kind: "source" },
    });
    expect(ticket.ok()).toBe(true);
    const { fileId } = (await ticket.json()) as { fileId: string };

    const res = await page.request.get("/api/account/export");
    expect(res.ok()).toBe(true);
    expect(res.headers()["content-disposition"]).toContain("attachment");
    const data = (await res.json()) as {
      profile: { username: string; name: string; headline: string; bio: string; hideFromSearch: boolean } | null;
      exhbts: { status: string; slug: string | null; doc: { title: string }; published: { title: string } | null }[];
      files: { id: string; bucket: string; mime: string; bytes: number }[];
      subscriptions: unknown[];
      roadmaps: unknown[];
      projectIdeas: unknown[];
    };

    expect(data.profile).toMatchObject({ username, name: "Amara Okafor", hideFromSearch: false });
    expect(data.profile?.headline).toBeTruthy();
    expect(data.profile?.bio).toBeTruthy();

    expect(data.exhbts).toHaveLength(2);
    for (const e of data.exhbts) {
      expect(e.status).toBe("published");
      expect(e.slug).toBeTruthy();
      expect(e.doc.title).toBeTruthy();
      expect(e.published?.title).toBe(e.doc.title);
    }

    expect(data.files).toEqual([expect.objectContaining({ id: fileId, bucket: "sources", mime: "text/csv", bytes: 120 })]);
    expect(Object.keys(data.files[0])).not.toContain("data");
    expect(Array.isArray(data.subscriptions)).toBe(true);
    expect(Array.isArray(data.roadmaps)).toBe(true);
    expect(Array.isArray(data.projectIdeas)).toBe(true);
  });

  test("signed out, it refuses", async ({ request }) => {
    expect((await request.get("/api/account/export")).status()).toBe(401);
  });
});

test.describe("Privacy policy and terms", () => {
  test("the privacy policy covers public portfolios, project files and AI drafting", async ({ page }) => {
    await page.goto("/legal/privacy");
    await expect(page.getByRole("heading", { level: 2, name: "Public portfolios" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Project files" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "AI drafting" })).toBeVisible();
    await expect(page.getByText(/Hide my portfolio from search/)).toBeVisible();
    await expect(page.getByText(/card details go straight to\s+Stripe/)).toBeVisible();
  });

  test("the terms cover confidential information", async ({ page }) => {
    await page.goto("/legal/terms");
    await expect(page.getByRole("heading", { level: 2, name: "Confidential information" })).toBeVisible();
    await expect(page.getByText(/remove exhbts that we believe/)).toBeVisible();
  });

  for (const path of ["/legal/privacy", "/legal/terms"]) {
    test(`no accessibility violations on ${path}`, async ({ page }) => {
      await page.goto(path);
      const { violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze();
      expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(", ")}`)).toEqual([]);
    });
  }
});
