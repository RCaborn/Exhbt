import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { MARKETING_HOST, portfolioHost } from "../lib/hosts";
import { MARKETING_PAGES, jobTitleFrom, serialiseJsonLd, sitemapXml, type MarketingKey } from "../lib/seo";

/**
 * Search and link previews: canonical, Open Graph, Twitter and JSON-LD on the home page, a portfolio
 * and an exhbt; the preview images; each portfolio host's sitemap and robots.txt; and what stays out
 * of search (hidden portfolios, job links).
 *
 * Marketing pages are read with `request` and plain HTML parsing (no browser). The indexable-page
 * checks need a public build, so run this with EXHBT_PUBLIC=1; without it every page is noindex (the
 * private preview, lib/site.ts) and those checks are skipped.
 */

const PUBLIC = process.env.EXHBT_PUBLIC === "1";
const PORT = Number(process.env.E2E_PORT) || 3200;
const unique = (tag: string) => `${tag}${Date.now().toString(36)}${Math.floor(Math.random() * 1e3)}`;

const decode = (s: string) =>
  s.replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

/** The content of a <meta> by its name or property. */
function meta(html: string, key: string): string | null {
  for (const m of html.matchAll(/<meta\s[^>]*>/g)) {
    const tag = m[0];
    if (new RegExp(`(?:name|property)="${key}"`).test(tag)) {
      const c = /content="([^"]*)"/.exec(tag);
      return c ? decode(c[1]!) : null;
    }
  }
  return null;
}

const canonical = (html: string) => {
  const m = /<link\s[^>]*rel="canonical"[^>]*>/.exec(html);
  const h = m ? /href="([^"]*)"/.exec(m[0]) : null;
  return h ? decode(h[1]!) : null;
};

/** Every JSON-LD block on the page, parsed (this throws if one is not valid JSON). */
function jsonLd(html: string): Record<string, unknown>[] {
  const blocks = [...html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]!) as unknown);
  return blocks.flat() as Record<string, unknown>[];
}

const ofType = (list: Record<string, unknown>[], t: string) => list.find((x) => x["@type"] === t);

/** The path of an absolute address, to ask this test server for it. */
const local = (url: string) => new URL(url).pathname;

/** A request on a person's host: the middleware routes by the Host header, as it does in production. */
const onHost = (request: APIRequestContext, name: string, path: string) =>
  request.get(path, { headers: { host: `${name}.localhost:${PORT}` }, maxRedirects: 0 });

async function seed(request: APIRequestContext, username: string, extra = "") {
  const res = await request.get(`/dev/portfolio?username=${username}&plan=max&count=2${extra}`, { maxRedirects: 0 });
  expect(res.status()).toBe(307);
}

test.describe("marketing pages", () => {
  test("the home page has a title that says what it is, a canonical, a card and JSON-LD", async ({ request }) => {
    const res = await request.get("/");
    expect(res.status()).toBe(200);
    const html = await res.text();
    expect(html).toContain("<title>Exhbt: your own website, built from your projects</title>");
    expect(canonical(html)).toBe(`https://${MARKETING_HOST}`);
    expect(meta(html, "description")).toBe(MARKETING_PAGES.home.description);
    expect(meta(html, "og:title")).toBe("Exhbt: your own website, built from your projects");
    expect(meta(html, "og:description")).toBe(MARKETING_PAGES.home.description);
    expect(meta(html, "og:url")).toBe(`https://${MARKETING_HOST}`);
    expect(meta(html, "og:image")).toBe(`https://${MARKETING_HOST}/og/home.png`);
    expect(meta(html, "og:image:width")).toBe("1200");
    expect(meta(html, "twitter:card")).toBe("summary_large_image");
    expect(meta(html, "twitter:image")).toBe(`https://${MARKETING_HOST}/og/home.png`);
    const ld = jsonLd(html);
    expect(ofType(ld, "Organization")).toMatchObject({ name: "Exhbt", url: `https://${MARKETING_HOST}`, logo: `https://${MARKETING_HOST}/brand/exhbt-mark.png` });
    expect(ofType(ld, "WebSite")).toMatchObject({ name: "Exhbt", url: `https://${MARKETING_HOST}` });
    if (PUBLIC) {
      expect(html).not.toMatch(/<meta[^>]*name="robots"[^>]*noindex/);
      expect((res.headers()["x-robots-tag"] ?? "")).not.toContain("noindex");
    }
  });

  test("every marketing page has its own canonical, description and card", async ({ request }) => {
    const keys = Object.keys(MARKETING_PAGES) as MarketingKey[];
    const descriptions = new Set<string>();
    for (const key of keys) {
      const page = MARKETING_PAGES[key];
      const html = await (await request.get(page.path)).text();
      const url = `https://${MARKETING_HOST}${page.path === "/" ? "" : page.path}`;
      expect(canonical(html), key).toBe(url);
      expect(meta(html, "og:url"), key).toBe(url);
      expect(meta(html, "og:image"), key).toBe(`https://${MARKETING_HOST}/og/${key}.png`);
      expect(meta(html, "twitter:card"), key).toBe("summary_large_image");
      const d = meta(html, "description");
      expect(d, key).toBeTruthy();
      expect(meta(html, "og:description"), key).toBe(d);
      descriptions.add(d!);
    }
    expect(descriptions.size).toBe(keys.length);
  });

  test("a demo exhbt has its own canonical", async ({ request }) => {
    const html = await (await request.get("/demo")).text();
    const href = /href="(\/demo\/[a-z0-9-]+)"/.exec(html)?.[1];
    expect(href).toBeTruthy();
    const page = await (await request.get(href!)).text();
    expect(canonical(page)).toBe(`https://${MARKETING_HOST}${href}`);
    expect(meta(page, "og:image")).toBe(`https://${MARKETING_HOST}/og/demo.png`);
  });

  test("the preview images are PNGs, 1200 wide, and only exist for known pages", async ({ request }) => {
    for (const key of Object.keys(MARKETING_PAGES) as MarketingKey[]) {
      const res = await request.get(`/og/${key}.png`);
      expect(res.status(), key).toBe(200);
      expect(res.headers()["content-type"], key).toBe("image/png");
      const bytes = await res.body();
      expect([...bytes.subarray(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
      expect(bytes.readUInt32BE(16), key).toBe(1200);
      expect(bytes.readUInt32BE(20), key).toBe(630);
    }
    expect((await request.get("/og/nothing.png")).status()).toBe(404);
    expect((await request.get("/og/constructor.png")).status()).toBe(404);
  });

  test("the sitemap lists the pages, with lastmod on the legal ones", async ({ request }) => {
    const xml = await (await request.get("/sitemap.xml")).text();
    expect(xml).toContain(`<loc>https://${MARKETING_HOST}</loc>`);
    expect(xml).toContain(`<loc>https://${MARKETING_HOST}/pricing</loc>`);
    expect(xml).toMatch(new RegExp(`<loc>https://${MARKETING_HOST.replace(/\./g, "\\.")}/legal/privacy</loc><lastmod>2026-\\d\\d-\\d\\d</lastmod>`));
    expect(xml).not.toContain("/start");
    expect(xml).not.toContain("/roadmap");
  });

  test("robots.txt on www points at the sitemap (public build) or blocks everything (preview)", async ({ request }) => {
    const body = await (await request.get("/robots.txt")).text();
    if (PUBLIC) {
      expect(body).toContain(`Sitemap: https://${MARKETING_HOST}/sitemap.xml`);
      expect(body).toContain("Allow: /");
    } else {
      expect(body).toMatch(/Disallow: \/\s*$/m);
    }
  });
});

test.describe("portfolio pages", () => {
  test("the home page and an exhbt have a canonical on the person's own host, a card and JSON-LD", async ({ request }) => {
    const name = unique("seo");
    await seed(request, name);
    const host = portfolioHost(name);

    const home = await (await request.get(`/p/${name}`)).text();
    expect(canonical(home)).toBe(`https://${host}`);
    expect(meta(home, "og:title")).toContain("Amara Okafor");
    expect(meta(home, "og:description")).toBeTruthy();
    expect(meta(home, "og:url")).toBe(`https://${host}`);
    const image = meta(home, "og:image")!;
    expect(image).toMatch(new RegExp(`/p/${name}/preview\\.png$`));
    expect(meta(home, "twitter:card")).toBe("summary_large_image");
    expect(meta(home, "twitter:image")).toBe(image);
    const person = ofType(jsonLd(home), "Person");
    expect(person).toMatchObject({
      name: "Amara Okafor",
      url: `https://${host}`,
      jobTitle: "Data analyst, health and public services",
      sameAs: ["https://www.linkedin.com/in/example"],
    });
    // The card the metadata names is the existing preview route, and it is a PNG.
    const card = await request.get(local(image));
    expect(card.status()).toBe(200);
    expect(card.headers()["content-type"]).toBe("image/png");

    const page = await (await request.get(`/p/${name}/gp-reminders`)).text();
    expect(canonical(page)).toBe(`https://${host}/gp-reminders`);
    expect(meta(page, "og:title")).toContain("Amara Okafor");
    expect(meta(page, "og:image")).toMatch(new RegExp(`/p/${name}/gp-reminders/preview\\.png$`));
    expect(meta(page, "twitter:card")).toBe("summary_large_image");
    const work = ofType(jsonLd(page), "CreativeWork");
    expect(work).toMatchObject({
      name: "Cutting missed GP appointments by changing when reminders are sent",
      url: `https://${host}/gp-reminders`,
      author: { "@type": "Person", name: "Amara Okafor", url: `https://${host}` },
    });
    expect(Date.parse(String(work!.dateModified))).not.toBeNaN();
    expect((await request.get(`/p/${name}/gp-reminders/preview.png`)).headers()["content-type"]).toBe("image/png");
    if (PUBLIC) {
      for (const html of [home, page]) expect(html).not.toMatch(/<meta[^>]*name="robots"[^>]*noindex/);
    }
  });

  test("the host serves its own sitemap and robots.txt, listing only live exhbts", async ({ request }) => {
    const name = unique("seomap");
    await seed(request, name);
    const host = portfolioHost(name);

    const res = await onHost(request, name, "/sitemap.xml");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("application/xml");
    const xml = await res.text();
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    expect(locs.sort()).toEqual([`https://${host}`, `https://${host}/gp-reminders`, `https://${host}/library-footfall`].sort());
    expect(xml).toMatch(/<lastmod>\d{4}-\d\d-\d\d<\/lastmod>/);

    const robots = await (await onHost(request, name, "/robots.txt")).text();
    if (PUBLIC) {
      expect(robots).toContain(`Sitemap: https://${host}/sitemap.xml`);
      expect(robots).not.toMatch(/Disallow: \/\s*$/m);
    } else {
      expect(robots).toMatch(/Disallow: \/\s*$/m);
    }
    // Not a portfolio: nothing to list.
    expect((await onHost(request, "nobody-here", "/sitemap.xml")).status()).toBe(404);
    expect((await onHost(request, "nobody-here", "/robots.txt")).status()).toBe(404);
  });

  test("hidden from search: noindex, no sitemap entries, no sitemap line, but still crawlable", async ({ request }) => {
    const name = unique("seohide");
    await seed(request, name, "&hide=1");
    const home = await (await request.get(`/p/${name}`)).text();
    const page = await (await request.get(`/p/${name}/gp-reminders`)).text();
    for (const html of [home, page]) expect(html).toMatch(/<meta[^>]*name="robots"[^>]*noindex/);

    const xml = await (await onHost(request, name, "/sitemap.xml")).text();
    expect(xml).not.toContain("<loc>");
    expect(xml).toContain("<urlset");
    const robots = await (await onHost(request, name, "/robots.txt")).text();
    expect(robots).not.toContain("Sitemap:");
    // Blocking crawlers would hide the noindex from them.
    if (PUBLIC) expect(robots).not.toMatch(/Disallow: \/\s*$/m);
    // The link preview still works for someone sharing the link.
    expect((await request.get(`/p/${name}/preview.png`)).headers()["content-type"]).toBe("image/png");
  });
});

test.describe("job links", () => {
  /** A Max user with a job link on a clean address, made through the app as a person would. */
  async function makeJobLink(page: Page, username: string) {
    await page.goto(`/dev/portfolio?username=${username}&plan=max&count=2`);
    await page.goto(`/auth/dev?email=${username}@example.com&next=/job-links`);
    await page.getByRole("link", { name: "New job link" }).click();
    await expect(page.locator("form[data-ready=true]")).toBeAttached();
    await page.getByLabel("Company", { exact: true }).fill("Acme");
    await page.getByLabel("Role title", { exact: true }).fill("Graduate Data Analyst");
    await page
      .getByLabel("Job description", { exact: true })
      .fill("We are hiring a graduate data analyst to write SQL, build time series forecasts and keep our Excel reporting up to date.");
    await page.getByRole("radio", { name: /^Clean/ }).check();
    await page.getByRole("button", { name: "Pick my exhbts" }).click();
    await page.waitForURL(/\/job-links\/[0-9a-f-]{36}$/);
  }

  test("stays noindex, has no canonical or JSON-LD, and is not in the sitemap", async ({ page, baseURL }) => {
    const name = unique("seojob");
    await makeJobLink(page, name);
    const res = await page.goto(`${(baseURL ?? "").replace("//localhost", `//${name}.localhost`)}/acme`);
    expect(res?.status()).toBe(200);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
    await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(0);

    const xml = await (await page.request.get(`/p/${name}/sitemap.xml`)).text();
    expect(xml).not.toContain("/acme");
    expect([...xml.matchAll(/<loc>/g)]).toHaveLength(3);
  });
});

test.describe("helpers", () => {
  test("jobTitleFrom keeps a title and drops a sentence or a status", () => {
    expect(jobTitleFrom("Data analyst, health and public services")).toBe("Data analyst, health and public services");
    expect(jobTitleFrom("UX researcher")).toBe("UX researcher");
    expect(jobTitleFrom("I like turning messy data into plain answers")).toBeNull();
    expect(jobTitleFrom("Final-year student")).toBeNull();
    expect(jobTitleFrom("Looking for a graduate role in data")).toBeNull();
    expect(jobTitleFrom("Data analyst.")).toBeNull();
    expect(jobTitleFrom("")).toBeNull();
    expect(jobTitleFrom(null)).toBeNull();
  });

  test("JSON-LD can't close its own script tag", () => {
    const text = serialiseJsonLd({ name: "</script><script>alert(1)</script>", other: "a\u2028b" });
    expect(text).not.toContain("<");
    expect(text).not.toContain("\u2028");
    expect(JSON.parse(text)).toEqual({ name: "</script><script>alert(1)</script>", other: "a\u2028b" });
  });

  test("a sitemap escapes its addresses", () => {
    const xml = sitemapXml([{ url: "https://a.exhbt.co.uk/x?a=1&b=<2>", lastmod: "2026-11-17" }]);
    expect(xml).toContain("<loc>https://a.exhbt.co.uk/x?a=1&amp;b=&lt;2&gt;</loc><lastmod>2026-11-17</lastmod>");
  });
});
