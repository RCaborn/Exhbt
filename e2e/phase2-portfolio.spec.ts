import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { ENTITLEMENTS } from "../lib/entitlements";
import { chartsOf, findingsOf, LIMITS, safeHref, text, validateForPublish, wordCount, type ExhbtDoc, type RichText } from "../lib/exhbt/blocks";
import { sampleDocs } from "../lib/exhbt/sample";
import { APP_HOST, MARKETING_HOST, canonicalRedirectUrl, parseHost, toolRedirectUrl, usernameProblem } from "../lib/hosts";
import { canCreateExhbt, canMakeJobLinks, canPublish, visibleOnPortfolio } from "../lib/plan-rules";
import type { ExhbtRecord } from "../lib/store";

// Phase 2: the exhbt block model, hosts, plan rules, and the public portfolio pages
// (seeded with fictional work by app/dev/portfolio). Figures come from lib/entitlements.ts.
//
// Username redirects (claimUsername keeping the old name for 30 days) aren't covered here:
// lib/store.ts is server-only, so a Playwright test can't import it, and there is no HTTP
// route that renames a username yet.

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
const [GP, LIBRARY] = sampleDocs as [ExhbtDoc, ExhbtDoc];

const doc = (patch: Partial<ExhbtDoc>): ExhbtDoc => ({ ...structuredClone(GP), ...patch });
/** GP with its findings bullets replaced (the findings section is the first, decision 0015). */
const withFindings = (items: RichText[], patch: Partial<ExhbtDoc> = {}): ExhbtDoc =>
  doc({ sections: GP.sections.map((s) => (s.kind === "findings" ? { ...s, items } : s)), ...patch });
const paths = (d: ExhbtDoc) => validateForPublish(d).map((i) => i.path);
/** The test server's address on a name.localhost host (Chromium resolves *.localhost to loopback). */
const on = (baseURL: string | undefined, name: string) => (baseURL ?? "").replace("//localhost", `//${name}.localhost`);
const nWords = (n: number) => Array.from({ length: n }, (_, i) => `w${i}`).join(" ");

test.describe("Exhbt blocks", () => {
  test("the sample exhbts can be published", () => {
    for (const d of sampleDocs) expect(validateForPublish(d)).toEqual([]);
  });

  test("publishing points at the block that breaks a limit", () => {
    expect(paths(doc({ title: "" }))).toEqual(["title"]);
    expect(paths(doc({ title: "x".repeat(LIMITS.titleChars + 1) }))).toEqual(["title"]);
    expect(paths(doc({ flow: GP.flow.slice(0, LIMITS.flow.min - 1) }))).toEqual(["flow"]);
    expect(paths(withFindings(Array.from({ length: LIMITS.findings.max + 1 }, () => text("A short finding."))))).toEqual(["sections.0.items"]);
    expect(paths(withFindings([[{ t: "Report", href: "http://example.com/report" }], text("Another finding.")]))).toEqual(["sections.0.items.0"]);
    expect(paths(doc({ gap: [{ t: "A question", href: "javascript:alert(1)" }] }))).toEqual(["gap"]);
    expect(paths(doc({ sections: [...GP.sections, { id: "image-1", kind: "image", fileId: "f1", alt: " ", caption: [] }] }))).toEqual(["sections.2.alt"]);
    expect(paths(doc({ evidence: { kind: "link", href: "http://example.com/work", label: "The work" } }))).toEqual(["evidence"]);
  });

  test("the whole exhbt has a word limit, even when every block is within its own", () => {
    const long = withFindings(
      Array.from({ length: LIMITS.findings.max }, () => text(nWords(LIMITS.findings.wordsEach))),
      {
        title: "Total words",
        gap: text(nWords(LIMITS.gapWords)),
        flow: Array.from({ length: LIMITS.flow.max }, () => ({ step: nWords(LIMITS.flow.stepWords), detail: nWords(LIMITS.flow.detailWords) })),
        evidence: undefined,
      },
    );
    expect(wordCount(long)).toBeGreaterThan(LIMITS.totalWords);
    expect(paths(long)).toEqual([""]);
  });

  test("the word count covers everything on the page except alt text", () => {
    const d: ExhbtDoc = {
      ...doc({}),
      title: "One two",
      context: "",
      skills: [],
      headline: undefined,
      gap: [{ t: "three " }, { t: "four", b: true }],
      flow: [{ step: "five six", detail: "seven" }, { step: "eight" }, { step: "nine" }],
      sections: [
        { id: "findings", kind: "findings", items: [text("ten eleven"), text("twelve")] },
        { id: "image-1", kind: "image", fileId: "f1", alt: "not counted at all", caption: text("thirteen fourteen") },
      ],
      evidence: { kind: "link", href: "https://example.com/x", label: "fifteen" },
    };
    expect(wordCount(d)).toBe(15);
    // Header, skills and headline count (Rory, 12 Nov 2026: the cap covers everything).
    expect(wordCount({ ...d, context: "a b", skills: ["Python", "Regression analysis"], headline: { value: "−18%", label: "missed appointments" } })).toBe(15 + 2 + 3 + 3);
    // So do graph titles and labels.
    const chart = { kind: "beforeAfter" as const, title: "Missed appointments", beforeLabel: "Before", afterLabel: "After change", lowerIsBetter: true, rows: [{ label: "All patients", before: 1, after: 2 }] };
    expect(wordCount({ ...d, sections: [...d.sections, { id: "graph-1", kind: "graph", chart }] })).toBe(15 + 2 + 1 + 2 + 2);
  });

  test("links must be https", () => {
    expect(safeHref("https://example.com/a?b=1")).toBe("https://example.com/a?b=1");
    for (const bad of ["http://example.com", "javascript:alert(1)", "data:text/html,<b>hi</b>", "not a link", "", undefined]) {
      expect(safeHref(bad)).toBeNull();
    }
  });
});

test.describe("Hosts", () => {
  test("each host is marketing, the app, a portfolio, or unknown", () => {
    const cases: [string, ReturnType<typeof parseHost>][] = [
      ["exhbt.co.uk", { kind: "marketing" }],
      ["www.exhbt.co.uk", { kind: "marketing" }],
      ["app.exhbt.co.uk", { kind: "app" }],
      ["alex.exhbt.co.uk", { kind: "portfolio", username: "alex" }],
      ["ALEX.exhbt.co.uk:443", { kind: "portfolio", username: "alex" }],
      ["alex.localhost:3200", { kind: "portfolio", username: "alex" }],
      ["localhost:3200", { kind: "marketing" }],
      ["something.workers.dev", { kind: "marketing" }],
      ["www.localhost", { kind: "marketing" }],
      ["app.localhost", { kind: "app" }],
      ["a.b.exhbt.co.uk", { kind: "unknown" }],
      ["admin.exhbt.co.uk", { kind: "unknown" }],
      ["-bad.exhbt.co.uk", { kind: "unknown" }],
    ];
    for (const [host, kind] of cases) expect(parseHost(host), host).toEqual(kind);
    expect(parseHost(null)).toEqual({ kind: "marketing" });
  });

  test("www and the apex send sign-in and the builder to the app host", () => {
    const go = (host: string, path: string, search = "") => toolRedirectUrl(host, path, search, true);
    for (const host of ["www.exhbt.co.uk", "exhbt.co.uk", "WWW.exhbt.co.uk:443"]) {
      expect(go(host, "/login"), host).toBe(`https://${APP_HOST}/login`);
      expect(go(host, "/roadmap/new", "?role=analyst"), host).toBe(`https://${APP_HOST}/roadmap/new?role=analyst`);
      expect(go(host, "/auth/confirm", "?token_hash=abc"), host).toBe(`https://${APP_HOST}/auth/confirm?token_hash=abc`);
    }
    for (const host of ["localhost:3200", "something.workers.dev", "app.exhbt.co.uk", "alex.exhbt.co.uk"]) {
      expect(go(host, "/login"), host).toBeNull();
    }
    expect(go("www.exhbt.co.uk", "/pricing")).toBeNull();
    expect(go("www.exhbt.co.uk", "/account")).toBeNull();
    expect(go("www.exhbt.co.uk", "/exhbts")).toBeNull();
    expect(go("www.exhbt.co.uk", "/start")).toBeNull();
  });

  test("the move to the app host is off by default, so www keeps its sign-in", async ({ request }) => {
    expect(toolRedirectUrl("www.exhbt.co.uk", "/login", "")).toBeNull();
    const www = await request.get("/login?next=%2Froadmap", {
      headers: { host: "www.exhbt.co.uk" },
      maxRedirects: 0,
    });
    expect(www.status()).toBe(200);

    const stayed = await request.get("/login", { maxRedirects: 0 });
    expect(stayed.status()).not.toBe(301);
  });

  test("the bare apex moves to www with the path and query kept; no other host does", async ({ request }) => {
    for (const host of ["exhbt.co.uk", "EXHBT.co.uk:443"]) {
      expect(canonicalRedirectUrl(host, "/auth/confirm", "?token_hash=abc&type=email"), host)
        .toBe(`https://${MARKETING_HOST}/auth/confirm?token_hash=abc&type=email`);
    }
    expect(canonicalRedirectUrl("exhbt.co.uk", "/")).toBe(`https://${MARKETING_HOST}/`);
    for (const host of [MARKETING_HOST, APP_HOST, "alex.exhbt.co.uk", "localhost:3200", "alex.localhost", "x.workers.dev", ""]) {
      expect(canonicalRedirectUrl(host, "/pricing", ""), host).toBeNull();
    }
    expect(canonicalRedirectUrl(null, "/", "")).toBeNull();

    const get = await request.get("/auth/confirm?token_hash=abc&type=email", { headers: { host: "exhbt.co.uk" }, maxRedirects: 0 });
    expect(get.status()).toBe(308);
    expect(get.headers().location).toBe(`https://${MARKETING_HOST}/auth/confirm?token_hash=abc&type=email`);
    const post = await request.post("/api/pv", { headers: { host: "exhbt.co.uk" }, data: {}, maxRedirects: 0 });
    expect(post.status()).toBe(308);
    expect(post.headers().location).toBe(`https://${MARKETING_HOST}/api/pv`);
  });

  test("usernames: shape, single hyphens, and reserved names", () => {
    for (const ok of ["alex", "amara-okafor", "a1b", "x".repeat(30)]) expect(usernameProblem(ok), ok).toBeNull();
    for (const bad of ["al", "x".repeat(31), "Alex", "-alex", "alex-", "al_ex", "al.ex", ""]) expect(usernameProblem(bad), bad).toMatch(/lower-case/);
    expect(usernameProblem("al--ex")).toMatch(/single hyphens/);
    for (const reserved of ["admin", "www", "app", "api"]) expect(usernameProblem(reserved), reserved).toMatch(/reserved/);
  });
});

test.describe("Plan rules", () => {
  const record = (i: number, status: ExhbtRecord["status"], position = i): ExhbtRecord => ({
    id: `e${i}`,
    userId: "u1",
    doc: GP,
    published: status === "published" ? GP : null,
    status,
    slug: status === "published" ? `project-${i}` : null,
    position,
    confirmedAt: null,
    publishedAt: null,
    updatedAt: "2026-11-12T00:00:00Z",
  });
  const many = (n: number, status: ExhbtRecord["status"]) => Array.from({ length: n }, (_, i) => record(i, status));

  test("Free can build but not publish", () => {
    expect(canCreateExhbt("free", []).ok).toBe(true);
    expect(canCreateExhbt("free", many(ENTITLEMENTS.free.exhbts, "draft"))).toMatchObject({ ok: false, upgradeTo: "premium" });
    expect(canPublish("free", [record(0, "draft")], "e0")).toMatchObject({ ok: false, upgradeTo: "premium" });
  });

  test("Premium publishes up to its count and no further", () => {
    const n = ENTITLEMENTS.premium.exhbts;
    expect(canPublish("premium", [...many(n - 1, "published"), record(n - 1, "draft")], `e${n - 1}`).ok).toBe(true);
    // Republishing a live one doesn't count it twice.
    expect(canPublish("premium", many(n, "published"), "e0").ok).toBe(true);
    expect(canPublish("premium", many(n, "published"), "new")).toMatchObject({ ok: false, upgradeTo: "max" });
    expect(canCreateExhbt("premium", many(n - 1, "draft")).ok).toBe(true);
    expect(canCreateExhbt("premium", many(n, "draft"))).toMatchObject({ ok: false, upgradeTo: "max" });
    expect(canCreateExhbt("max", many(ENTITLEMENTS.max.exhbts, "published")).ok).toBe(false);
  });

  test("a portfolio shows live exhbts in the person's order, capped at the plan's count", () => {
    const n = ENTITLEMENTS.premium.exhbts;
    // Positions run backwards, with a draft in the middle that must not show.
    const live = Array.from({ length: n + 2 }, (_, i) => record(i, "published", 100 - i));
    const all = [...live.slice(0, 2), record(99, "draft", 50), ...live.slice(2)];
    expect(visibleOnPortfolio("free", all)).toEqual([]);
    const shown = visibleOnPortfolio("premium", all);
    expect(shown).toHaveLength(n);
    expect(shown.map((x) => x.id)).toEqual(live.slice().reverse().slice(0, n).map((x) => x.id));
    expect(shown.every((x) => x.status === "published")).toBe(true);
    // Unpublished (status draft, published copy kept) drops off the page.
    const unpublished = { ...record(0, "published"), status: "draft" as const };
    expect(visibleOnPortfolio("premium", [unpublished])).toEqual([]);
  });

  test("job links are a Max feature", () => {
    expect(canMakeJobLinks("premium", 0)).toMatchObject({ ok: false, upgradeTo: "max" });
    expect(canMakeJobLinks("max", 0).ok).toBe(true);
    expect(canMakeJobLinks("max", ENTITLEMENTS.max.jobLinksActive).ok).toBe(false);
  });
});

/** Seeds a fictional portfolio in the in-memory store (app/dev/portfolio). */
async function seed(page: Page, username: string, plan: string) {
  const res = await page.request.get(`/dev/portfolio?username=${username}&plan=${plan}`, { maxRedirects: 0 });
  expect(res.status(), await res.text()).toBe(307);
}

test.describe("Public portfolio", () => {
  test("the at-a-glance page opens each project, with the way back and on", async ({ page }) => {
    await seed(page, "amara", "premium");
    await page.goto("/p/amara");
    await expect(page.getByRole("heading", { level: 1, name: "Amara Okafor" })).toBeVisible();
    await expect(page.getByText("Data analyst, health and public services")).toBeVisible();
    // Rory's layout (decision 0016): the first exhbt in the band, the next as a card, no catalogue numbers.
    await expect(page.locator("[data-section=featured] h2")).toHaveText(GP.title);
    await expect(page.locator("[data-card] h3")).toHaveText([LIBRARY.title]);
    await expect(page.locator("[data-catalogue]")).toHaveCount(0);

    await page.getByRole("link", { name: "See how I did it" }).click();
    await page.waitForURL(/\/p\/amara\/gp-reminders$/);
    await expect(page.getByRole("heading", { level: 1, name: GP.title })).toBeVisible();
    await expect(page.locator("article [data-catalogue]")).toHaveText("EX·01");
    await expect(page.getByRole("navigation", { name: "Portfolio" })).not.toContainText("EX·");
    await expect(page.getByRole("list", { name: "Methodology" }).getByRole("listitem")).toHaveCount(GP.flow.length);
    const findings = page.getByRole("region", { name: "findings" }).getByRole("listitem");
    await expect(findings).toHaveCount(findingsOf(GP).length);
    await expect(findings.first()).toContainText("3-hour reminders cut missed appointments");
    await expect(page.getByRole("table", { name: chartsOf(GP)[0]!.title })).toBeAttached();
    await expect(page.getByRole("link", { name: /See the work/ })).toHaveAttribute("href", "https://example.com/gp-reminders-report.pdf");
    const checks = page.getByRole("list", { name: "Checks passed" });
    await expect(checks).toContainText("Confirmed by author");
    await expect(checks).toContainText("Source attached");

    await page.getByRole("link", { name: "All projects" }).click();
    await page.waitForURL(/\/p\/amara$/);
    await page.getByRole("link", { name: "See how I did it" }).click();
    await page.waitForURL(/\/gp-reminders$/);

    await page.getByRole("navigation", { name: "Other projects" }).getByRole("link", { name: /Next/ }).click();
    await page.waitForURL(/\/p\/amara\/library-footfall$/);
    await expect(page.getByRole("heading", { level: 1, name: LIBRARY.title })).toBeVisible();
    await expect(page.locator("article [data-catalogue]")).toHaveText("EX·02");
    // No work linked, so the badge doesn't claim a source.
    await expect(page.getByRole("list", { name: "Checks passed" })).toContainText("Confirmed by author");
    await expect(page.getByRole("list", { name: "Checks passed" })).not.toContainText("Source attached");
    await expect(page.getByRole("link", { name: /See the work/ })).toHaveCount(0);
  });

  test("a portfolio on its own subdomain has short links and sends new people to our site", async ({ page, baseURL }) => {
    const SUBDOMAIN = on(baseURL, "amara");
    await seed(page, "amara", "premium");
    await page.goto(`${SUBDOMAIN}/`);
    await expect(page.getByRole("heading", { level: 1, name: "Amara Okafor" })).toBeVisible();
    await expect(page.getByRole("link", { name: "See how I did it" })).toHaveAttribute("href", "/gp-reminders");
    await expect(page.getByRole("link", { name: new RegExp(LIBRARY.title) })).toHaveAttribute("href", "/library-footfall");
    await expect(page.getByRole("link", { name: /Build your own roadmap/ })).toHaveAttribute("href", `https://${MARKETING_HOST}/start`);

    await page.goto(`${SUBDOMAIN}/gp-reminders`);
    await expect(page.getByRole("heading", { level: 1, name: GP.title })).toBeVisible();
    await expect(page.getByRole("link", { name: "All projects" })).toHaveAttribute("href", "/");
    await expect(page.getByRole("navigation", { name: "Other projects" }).getByRole("link", { name: /Next/ })).toHaveAttribute("href", "/library-footfall");
  });

  test("no public page on Free, for reserved names, or on reserved subdomains", async ({ page, baseURL }) => {
    await seed(page, "freda", "free");
    expect((await page.goto("/p/freda"))?.status()).toBe(404);
    expect((await page.goto("/p/admin"))?.status()).toBe(404);
    expect((await page.goto("/p/nobody-here"))?.status()).toBe(404);
    expect((await page.goto(`${on(baseURL, "admin")}/`))?.status()).toBe(404);
    // A person's host serves their portfolio only: not the app, not the API.
    expect((await page.goto(`${on(baseURL, "amara")}/api/health`))?.status()).toBe(404);
  });

  for (const path of ["/p/amara", "/p/amara/gp-reminders", "/p/amara/library-footfall"]) {
    test(`no accessibility violations on ${path}`, async ({ page }) => {
      await seed(page, "amara", "premium");
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      const { violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze();
      expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(", ")}`)).toEqual([]);
    });
  }
});
