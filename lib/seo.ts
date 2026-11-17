import type { Metadata } from "next";
import { BILLING_PERIOD, PLAN_NAMES, PRICES } from "./entitlements";
import { MARKETING_HOST, portfolioHost } from "./hosts";
import { LEGAL_UPDATED } from "./legal";

/**
 * How the public pages appear in search results and link previews. One table for the marketing
 * pages (address, title, description, preview-image words), helpers that build the full metadata
 * (Next replaces `openGraph` and `twitter` wholesale for each page, so every page gets the whole
 * set from here), and the structured data (JSON-LD). Hosts come from lib/hosts.ts; plan figures
 * from lib/entitlements.ts. Nothing here claims more than is built (lib/jobs/claim.ts).
 */

/** https://www.exhbt.co.uk */
export const SITE_ORIGIN = `https://${MARKETING_HOST}`;
export const SITE_NAME = "Exhbt";

/** Every marketing page that is for search engines. */
export type MarketingKey =
  | "home"
  | "what-is-an-exhbt"
  | "pricing"
  | "universities"
  | "how-to-read-an-exhbt"
  | "demo"
  | "legal-privacy"
  | "legal-terms"
  | "legal-cookies";

type MarketingPage = {
  path: string;
  /** The page's own words; the site template adds "· Exhbt". Home sets the whole title. */
  title: string;
  description: string;
  /** What the link-preview image says: the headline and one short line under it. */
  card: { headline: string; sub: string };
  /** ISO date the page last changed, where one is recorded. */
  lastmod?: string;
};

export const HOME_TITLE = "Exhbt: your own website, built from your projects";

export const MARKETING_PAGES: Record<MarketingKey, MarketingPage> = {
  home: {
    path: "/",
    title: HOME_TITLE,
    description:
      "Get a free skills-gap roadmap for the job you want, then turn your projects into exhbts: short, checked write-ups on a website at your own address.",
    card: { headline: "Your own website, built from your projects", sub: "A free skills-gap roadmap, then checked exhbts for employers" },
  },
  "what-is-an-exhbt": {
    path: "/what-is-an-exhbt",
    title: "What is an exhbt?",
    description:
      "An exhbt is one project on a single page: the method, the findings and the work behind them, so an employer can check it. A few make your portfolio.",
    card: { headline: "What is an exhbt?", sub: "One project, one page, with the work behind it" },
  },
  pricing: {
    path: "/pricing",
    title: "Pricing",
    description: "", // pricingDescription() builds it: it depends on whether plans are on sale
    card: { headline: "Pricing", sub: "The roadmap is free. Employers never pay." },
  },
  universities: {
    path: "/universities",
    title: "For universities",
    description: `A university licence gives every student ${PLAN_NAMES.max}: a skills roadmap for the job they want and a portfolio of exhbts. Get in touch to ask about one.`,
    card: { headline: "Exhbt for universities", sub: "A roadmap and a portfolio for every student" },
  },
  "how-to-read-an-exhbt": {
    path: "/how-to-read-an-exhbt",
    title: "How to read an exhbt",
    description: "A short guide for hiring managers and careers staff: what each part of an exhbt shows and how to read it. Free, no account needed.",
    card: { headline: "How to read an exhbt", sub: "A guide for hiring managers and careers staff" },
  },
  demo: {
    path: "/demo",
    title: "Demo portfolio",
    description: "A fictional graduate's portfolio, to show what an employer sees. The person, the address and the projects are made up.",
    card: { headline: "A demo portfolio", sub: "What an employer sees. The person is fictional." },
  },
  "legal-privacy": {
    path: "/legal/privacy",
    title: "Privacy policy",
    description: "What Exhbt collects when you use the site, what we use it for, who it goes to and how long we keep it.",
    card: { headline: "Privacy policy", sub: "What we collect, why, and for how long" },
    lastmod: LEGAL_UPDATED.privacy,
  },
  "legal-terms": {
    path: "/legal/terms",
    title: "Terms of use",
    description: "The terms for using Exhbt: your account, the work you add, plans and payments.",
    card: { headline: "Terms of use", sub: "The rules for using Exhbt" },
    lastmod: LEGAL_UPDATED.terms,
  },
  "legal-cookies": {
    path: "/legal/cookies",
    title: "Cookie policy",
    description: "Which cookies Exhbt sets, what each one is for, and how visits are counted without tracking you.",
    card: { headline: "Cookie policy", sub: "What we set, and what we don't" },
    lastmod: LEGAL_UPDATED.cookies,
  },
};

/** The absolute address of a marketing path, with no trailing slash on the home page. */
export const marketingUrl = (path: string) => `${SITE_ORIGIN}${path === "/" ? "" : path}`;

/** The link-preview image for a marketing page (app/(marketing)/og/[key]/route.tsx). */
export const marketingImage = (key: MarketingKey) => ({
  url: `${SITE_ORIGIN}/og/${key}.png`,
  width: 1200,
  height: 630,
  type: "image/png",
  alt: MARKETING_PAGES[key].card.headline,
});

/** Pricing's description: prices only while the plans are on sale, otherwise the waitlist wording. */
export function pricingDescription(sell: boolean, maxExtra: string): string {
  if (!sell) return `Free includes the roadmap and an exhbt to try. ${PLAN_NAMES.premium} puts your exhbts on your own link, and ${PLAN_NAMES.max} ${maxExtra}. Employers never pay.`;
  const price = (p: "premium" | "max") => `${PRICES[p]} a ${BILLING_PERIOD}`;
  return `Free includes the roadmap and an exhbt to try. ${PLAN_NAMES.premium} is ${price("premium")} and puts your exhbts on your own link. ${PLAN_NAMES.max} is ${price("max")} and ${maxExtra}. Employers never pay.`;
}

/**
 * The full metadata for a marketing page: canonical, description, Open Graph and Twitter card.
 * `over` replaces the table's words (a dynamic description) or the address (a page under one entry).
 */
export function marketingMetadata(key: MarketingKey, over: { title?: string; description?: string; path?: string } = {}): Metadata {
  const page = MARKETING_PAGES[key];
  const url = marketingUrl(over.path ?? page.path);
  const description = over.description ?? page.description;
  const bare = over.title ?? page.title;
  const shown = key === "home" ? bare : `${bare} · ${SITE_NAME}`;
  const image = marketingImage(key);
  return {
    title: key === "home" ? { absolute: bare } : bare,
    description,
    alternates: { canonical: url },
    openGraph: { type: "website", url, siteName: SITE_NAME, locale: "en_GB", title: shown, description, images: [image] },
    twitter: { card: "summary_large_image", title: shown, description, images: [image] },
  };
}

/** The sitemap entries for the marketing pages (app/sitemap.ts adds the demo exhbts). */
export const marketingSitemapPages = () =>
  (Object.values(MARKETING_PAGES) as MarketingPage[]).map((p) => ({ url: marketingUrl(p.path), ...(p.lastmod ? { lastModified: p.lastmod } : {}) }));

/* ---------- portfolios ---------- */

/** A person's address, always on their own host and https, wherever the request came in (localhost, /p/name). */
export const portfolioOrigin = (username: string) => `https://${portfolioHost(username)}`;

/** The canonical address of a portfolio page: "" for the home page, "/<slug>" for an exhbt. */
export const portfolioCanonical = (username: string, path = "") => `${portfolioOrigin(username)}${path}`;

/**
 * The headline as a job title, or null when it doesn't read as one. People write the headline in their
 * own words ("Data analyst, health and public services" or "Final-year student who likes charts");
 * only the first kind is a `jobTitle`. Short, no sentence marks, no "I" or "my", and not a status.
 */
export function jobTitleFrom(headline: string | null | undefined): string | null {
  const h = (headline ?? "").trim();
  if (!h || h.length > 60 || h.split(/\s+/).length > 6) return null;
  if (/[.!?;:@/\\|()\d]/.test(h)) return null;
  if (/\b(i|i'm|i’m|me|my|we|our|you|your|looking|seeking|aspiring|passionate|student|graduate|graduating|undergraduate|studying)\b/i.test(h)) return null;
  return h;
}

/** `Person` for a portfolio home page. Only what the person entered. */
export function personLd(p: { name: string; username: string; headline: string | null; linkedin: string | null; github: string | null }) {
  const sameAs = [p.linkedin, p.github].filter((x): x is string => Boolean(x));
  const jobTitle = jobTitleFrom(p.headline);
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    name: p.name,
    url: portfolioCanonical(p.username),
    ...(jobTitle ? { jobTitle } : {}),
    ...(sameAs.length > 0 ? { sameAs } : {}),
  };
}

/** `CreativeWork` for an exhbt page: the title, its author and when it was last published. */
export function creativeWorkLd(w: {
  title: string;
  description?: string;
  username: string;
  slug: string;
  authorName: string;
  modified: string | null;
  skills: string[];
  image: string;
}) {
  const modified = w.modified && !Number.isNaN(Date.parse(w.modified)) ? new Date(w.modified).toISOString() : null;
  return {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    name: w.title,
    url: portfolioCanonical(w.username, `/${w.slug}`),
    author: { "@type": "Person", name: w.authorName, url: portfolioCanonical(w.username) },
    ...(w.description ? { description: w.description } : {}),
    ...(modified ? { dateModified: modified } : {}),
    ...(w.skills.length > 0 ? { keywords: w.skills.join(", ") } : {}),
    image: w.image,
    inLanguage: "en-GB",
  };
}

/** `Organization` and `WebSite` for the marketing site. */
export function siteLd() {
  return [
    { "@context": "https://schema.org", "@type": "Organization", name: SITE_NAME, url: SITE_ORIGIN, logo: `${SITE_ORIGIN}/brand/exhbt-mark.png` },
    { "@context": "https://schema.org", "@type": "WebSite", name: SITE_NAME, url: SITE_ORIGIN, inLanguage: "en-GB" },
  ];
}

/** JSON for a `<script type="application/ld+json">`: `<` and the line separators escaped so the text can't close the tag. */
export const serialiseJsonLd = (data: unknown): string =>
  JSON.stringify(data).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");

/** XML text: the five characters that matter. */
export const xmlEscape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

/** A sitemap document. An empty list is a valid, empty urlset. */
export function sitemapXml(entries: { url: string; lastmod?: string | null }[]): string {
  const rows = entries.map((e) => `  <url><loc>${xmlEscape(e.url)}</loc>${e.lastmod ? `<lastmod>${xmlEscape(e.lastmod)}</lastmod>` : ""}</url>`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${rows.join("\n")}${rows.length ? "\n" : ""}</urlset>\n`;
}
