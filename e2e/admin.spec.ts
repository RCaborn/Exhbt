import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { uniqueEmail } from "./helpers";

// The admin panel (decision 0021). The in-memory store is shared by the whole suite, so the numbers
// are read before and after seeding and compared as differences, never as absolute totals.
// /dev/admin stands in for profiles.role = 'exhbt_admin', which the in-memory store doesn't have.

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
const stamp = () => `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;
const enc = encodeURIComponent;
const HUMAN = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

/** Signs in as a new person, then (optionally) makes them an admin, landing on `next`. */
async function signIn(page: Page, opts: { admin: boolean; next?: string }): Promise<string> {
  const email = uniqueEmail("admin");
  const dest = opts.next ?? "/admin?range=all";
  const next = opts.admin ? `/dev/admin?role=admin&next=${enc(dest)}` : dest;
  await page.goto(`/auth/dev?email=${enc(email)}&next=${enc(next)}`);
  return email;
}

/** Reads a figure off the overview by its data-stat id. */
async function stat(page: Page, id: string): Promise<number> {
  const text = await page.locator(`[data-stat="${id}"]`).first().innerText();
  return Number(text.replace(/[$,]/g, ""));
}
const ALL = ["accounts-total", "roadmaps-total", "people-one", "people-two", "people-three", "roadmaps-failed", "roadmaps-fresh", "roadmaps-cached",
  "ideas-failures", "ideas-swaps", "exhbts-ai-drafts", "ai-cost", "ai-calls", "subs-active", "waitlist-total", "leads-total"] as const;
async function read(page: Page): Promise<Record<(typeof ALL)[number], number>> {
  const out = {} as Record<(typeof ALL)[number], number>;
  for (const id of ALL) out[id] = await stat(page, id);
  return out;
}

test.describe("Admin panel", () => {
  test("anyone who is not an admin gets a plain 404, signed out or in", async ({ page }) => {
    for (const path of ["/admin", "/admin/accounts", "/admin/accounts/anything"]) {
      const res = await page.goto(path);
      expect(res?.status(), `signed out ${path}`).toBe(404);
      await expect(page.getByText("Overview", { exact: true })).toHaveCount(0);
    }
    await signIn(page, { admin: false, next: "/account" });
    for (const path of ["/admin", "/admin/accounts", "/admin/accounts/anything"]) {
      const res = await page.goto(path);
      expect(res?.status(), `signed in ${path}`).toBe(404);
      await expect(page.getByRole("link", { name: "Accounts" })).toHaveCount(0);
    }
  });

  test("an admin sees the overview, and its numbers move by what was added", async ({ page }) => {
    await signIn(page, { admin: true });
    await expect(page.getByRole("heading", { level: 1, name: "Overview" })).toBeVisible();
    await expect(page.getByRole("link", { name: "All time" })).toHaveAttribute("aria-current", "page");
    const before = await read(page);

    const tag = stamp();
    const seeded = await page.request.get(`/dev/admin?seed=${tag}`);
    expect(seeded.ok()).toBe(true);
    await page.reload();
    const after = await read(page);

    const delta = (id: (typeof ALL)[number]) => after[id] - before[id];
    expect(delta("accounts-total")).toBe(3);
    expect(delta("roadmaps-total")).toBe(6);
    expect([delta("people-one"), delta("people-two"), delta("people-three")]).toEqual([1, 1, 1]);
    expect(delta("roadmaps-failed")).toBe(2);
    expect([delta("roadmaps-fresh"), delta("roadmaps-cached")]).toEqual([1, 1]);
    expect(delta("ideas-failures")).toBe(1);
    expect(delta("ideas-swaps")).toBe(2);
    expect(delta("exhbts-ai-drafts")).toBe(1);
    expect(delta("ai-calls")).toBe(2);
    expect(delta("ai-cost")).toBeCloseTo(0.75, 1);
    expect(delta("subs-active")).toBe(1);
    expect(delta("waitlist-total")).toBe(1);
    expect(delta("leads-total")).toBe(1);

    // Plans: the comp Max subscription shows against Max, and the AI step table names its steps.
    await expect(page.getByRole("region", { name: "Subscriptions" }).getByRole("cell", { name: "Max" })).toBeVisible();
    await expect(page.getByRole("region", { name: "AI usage and cost" }).getByRole("cell", { name: "project ideas" }).first()).toBeVisible();
    await expect(page.getByRole("region", { name: "Waitlist and university leads" }).getByText(`lead-${tag}@example.com`)).toBeVisible();
    // Every chart has its figures in a table, and the roadmaps chart is present.
    await expect(page.getByRole("region", { name: "Roadmaps", exact: true }).locator("[data-chart]").first()).toBeVisible();
    await expect(page.getByRole("region", { name: "Roadmaps", exact: true }).locator("table").first()).toBeAttached();

    // The range selector narrows the figures and keeps the page.
    await page.getByRole("link", { name: "7 days" }).click();
    await expect(page).toHaveURL(/range=7d/);
    await expect(page.getByRole("link", { name: "7 days" })).toHaveAttribute("aria-current", "page");
    expect(await stat(page, "roadmaps-total")).toBeGreaterThanOrEqual(6);
    await page.getByRole("link", { name: "30 days" }).click();
    await expect(page).toHaveURL(/\/admin$/);
  });

  test("accounts: search, pages and a read-only account page", async ({ page }) => {
    await signIn(page, { admin: true, next: "/admin/accounts" });
    const tag = `pg${stamp()}`;
    // Nine seeds make 27 accounts that share a prefix: one more than a page.
    for (const k of "abcdefghi") expect((await page.request.get(`/dev/admin?seed=${tag}${k}`)).ok()).toBe(true);

    await page.goto(`/admin/accounts?q=seed-${tag}`);
    await expect(page.locator('[data-stat="accounts-found"]')).toHaveText("27");
    await expect(page.getByText("Page 1 of 2")).toBeVisible();
    expect(await page.locator("tbody tr").count()).toBe(25);
    await page.getByRole("link", { name: "Next" }).click();
    await expect(page.getByText("Page 2 of 2")).toBeVisible();
    expect(await page.locator("tbody tr").count()).toBe(2);

    // Search by a whole address finds one person, and their page shows their counts.
    await page.getByLabel("Search by email or username").fill(`seed-${tag}c-3@example.com`);
    await page.getByRole("button", { name: "Search" }).click();
    await expect(page.locator('[data-stat="accounts-found"]')).toHaveText("1");
    const row = page.locator("tbody tr").first();
    await expect(row).toContainText("Free");
    await expect(row).toContainText("3"); // roadmaps
    await row.getByRole("link").click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(`seed-${tag}c-3@example.com`);
    await expect(page.locator('[data-stat="detail-roadmaps"]')).toHaveText("3");
    await expect(page.getByText("Read only.")).toBeVisible();
    await expect(page.locator("main").getByRole("button")).toHaveCount(0);

    // The first seeded account has the comp Max subscription.
    await page.goto(`/admin/accounts?q=seed-${tag}c-1@example.com`);
    await expect(page.locator("tbody tr").first()).toContainText("Max (comp)");

    await page.goto(`/admin/accounts?q=nobody-${tag}`);
    await expect(page.getByText("No accounts match.")).toBeVisible();
  });

  test("page views are counted without a cookie, skip robots and the admin, and show up", async ({ page, baseURL }) => {
    const origin = new URL(baseURL!).origin;
    await signIn(page, { admin: true });
    const before = await stat(page, "views-total");

    const post = (path: string, headers: Record<string, string> = {}) =>
      page.request.post("/api/pv", { data: JSON.stringify({ p: path, r: "www.google.com" }), headers: { origin, "content-type": "text/plain", "user-agent": HUMAN, ...headers } });

    const id = stamp();
    // One real view, with an id and a query that must not be stored.
    expect((await post(`/roadmap/0b5f6e1e-9d4c-4a43-8e1f-0e8f3f1a2b3c?email=a@b.c&x=${id}`)).status()).toBe(204);
    // None of these count: a robot, the admin panel, the API, another site's page, and no origin at all.
    expect((await post("/pricing", { "user-agent": "Mozilla/5.0 (compatible; Googlebot/2.1)" })).status()).toBe(204);
    expect((await post("/admin")).status()).toBe(204);
    expect((await post("/api/health")).status()).toBe(204);
    expect((await post("/pricing", { origin: "https://example.com" })).status()).toBe(204);
    expect((await page.request.post("/api/pv", { data: JSON.stringify({ p: "/pricing" }), headers: { "content-type": "text/plain", "user-agent": HUMAN } })).status()).toBe(204);

    await expect
      .poll(async () => {
        await page.goto("/admin?range=all");
        return (await stat(page, "views-total")) - before;
      })
      .toBe(1);
    // The path is stored with its id and query removed, and the referrer as a host only.
    const pages = page.getByRole("region", { name: "Page views", exact: true }).getByRole("table", { name: "Top pages" });
    await expect(pages.getByRole("cell", { name: "/roadmap/:id", exact: true })).toBeVisible();
    await expect(page.getByRole("region", { name: "Page views", exact: true }).getByRole("table", { name: "Top referring sites" }).getByRole("cell", { name: "google.com", exact: true })).toBeVisible();
    await expect(page.getByRole("region", { name: "Page views", exact: true })).not.toContainText("0b5f6e1e");
    await expect(page.getByRole("region", { name: "Page views", exact: true })).not.toContainText("a@b.c");
  });

  test("a view sent from a portfolio host counts as a portfolio, stored without the person's name", async ({ page, baseURL }) => {
    const port = new URL(baseURL!).port;
    await signIn(page, { admin: true });
    const before = { portfolio: await stat(page, "views-portfolio"), total: await stat(page, "views-total") };
    const origin = `http://someone.localhost:${port}`;
    const send = (path: string) =>
      page.request.post("/api/pv", { data: JSON.stringify({ p: path, r: "" }), headers: { origin, "content-type": "text/plain", "user-agent": HUMAN } });
    expect((await send("/")).status()).toBe(204);
    expect((await send("/an-exhbt-slug-1")).status()).toBe(204);
    await expect
      .poll(async () => {
        await page.goto("/admin?range=all");
        return [(await stat(page, "views-portfolio")) - before.portfolio, (await stat(page, "views-total")) - before.total];
      })
      .toEqual([2, 2]);
    const pages = page.getByRole("region", { name: "Page views", exact: true }).getByRole("table", { name: "Top pages" });
    await expect(pages).not.toContainText("an-exhbt-slug");
    await expect(pages).not.toContainText("someone");
  });

  test("a real page load sends the beacon, and no cookie is set for it", async ({ page, context }) => {
    await signIn(page, { admin: true });
    const before = await stat(page, "views-total");
    await context.clearCookies();
    const sent = page.waitForRequest((r) => r.url().endsWith("/api/pv") && r.method() === "POST");
    await page.goto("/pricing");
    const req = await sent;
    expect(JSON.parse(req.postData() ?? "{}")).toMatchObject({ p: "/pricing" });
    // The beacon adds no cookie. (The marketing page sets none of its own.)
    expect(await context.cookies()).toEqual([]);

    await signIn(page, { admin: true });
    await expect.poll(async () => (await stat(page, "views-total")) - before).toBeGreaterThanOrEqual(1);
  });

  test("a failed AI draft shows in Failed AI calls, with its reason and the tokens it spent", async ({ page }) => {
    await signIn(page, { admin: true });
    await expect(page.getByRole("heading", { level: 2, name: "Failed AI calls" })).toBeVisible();
    const row = () => page.getByRole("table", { name: "Failed AI calls by feature" }).getByRole("row", { name: /^Exhbt drafts/ });
    const failedBefore = await stat(page, "ai-failures-total");
    const outBefore = await stat(page, "ai-failures-out");

    // The stand-in fails the way a real draft does when it runs out of room ("stand-in: fail" in the notes).
    const res = await page.request.post("/api/exhbts/draft", {
      data: { text: "We timed lunchtime queues at the union cafe for two weeks, then opened a second till at the busiest hour, and the queue fell.", notes: "stand-in: fail" },
    });
    expect(res.status()).toBe(502);
    expect(((await res.json()) as { error: string }).error).toContain("didn't use up a draft");

    await page.reload();
    expect(await stat(page, "ai-failures-total")).toBe(failedBefore + 1);
    expect(await stat(page, "ai-failures-out")).toBe(outBefore + 16000);
    await expect(row()).toContainText("ran out of room");
  });

  test("no accessibility violations on the overview, accounts and an account", async ({ page }) => {
    await signIn(page, { admin: true });
    await page.request.get(`/dev/admin?seed=${stamp()}`);
    const scan = async (label: string) => {
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      const { violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze();
      expect(violations.map((v) => `${label} ${v.id}: ${v.nodes.map((n) => n.target).join(", ")}`)).toEqual([]);
    };
    await page.goto("/admin?range=all");
    await scan("overview");
    await page.goto("/admin?range=7d");
    await scan("overview 7d");
    await page.goto("/admin/accounts");
    await scan("accounts");
    await page.locator("tbody tr").first().getByRole("link").click();
    await scan("account");
  });
});
