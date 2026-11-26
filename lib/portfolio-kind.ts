/**
 * Which structure the app has: the one-page portfolio editor and the new nav ("page"), or today's step
 * builder and two nav items ("steps"). Decision 0031, "The switch".
 *
 * This file is the rule and nothing else. It reads no request, so the tests run it exactly as it ships
 * (e2e/portfolio-switch.spec.ts) and anyone can read what the one constant below does. What a request says
 * (its cookies, who is signed in) is read in lib/portfolio-kind-server.ts, which is server only.
 *
 * It is copied from lib/editor-kind.ts, which it never imports, because that file is deleted with the
 * classic exhbt editor.
 */
export type PortfolioKind = "page" | "steps";

/**
 * THE SWITCH for portfolio first: "steps" is today's app for everyone (the step builder, the two nav items,
 * today's landings after sign-in); "page" is the one-page editor and the new structure. Pinned by
 * e2e/portfolio-switch.spec.ts (SHIPPED_DEFAULT): change both in one commit. The runtime variable
 * EXHBT_PORTFOLIO overrides it for everyone without a deploy: "page" switches the new structure on,
 * "steps" forces today's (the emergency switch); deleted, or set to anything else, this line decides.
 */
export const DEFAULT_PORTFOLIO: PortfolioKind = "steps";

/**
 * An admin's own choice, remembered in their browser for a year. It is honoured only while the signed-in
 * person is an admin, which is checked on every request: the same cookie sent by anyone else is ignored.
 * Set by POST /api/portfolio/editor.
 */
export const PORTFOLIO_OWN_COOKIE = "exhbt-portfolio-own";

/**
 * Development only: stands in for the variable EXHBT_PORTFOLIO, for one browser (app/dev/portfolio-kind), so
 * each browser test has its own setting. "page" and "steps" are the variable's two values; "default" is the
 * variable not set at all. Never read in production.
 */
export const PORTFOLIO_KIND_COOKIE = "exhbt-portfolio-kind";

export const isPortfolioKind = (v: unknown): v is PortfolioKind => v === "page" || v === "steps";

/** What decides, all of it. */
export type PortfolioFacts = {
  /** The runtime variable EXHBT_PORTFOLIO as it is set, if it is. */
  variable: string | undefined;
  /** process.env.NODE_ENV is "production". */
  production: boolean;
  /** The development cookie (PORTFOLIO_KIND_COOKIE), if the browser sent one. */
  devCookie?: string;
  /** Whether the signed-in person is an admin, as /admin recognises one, checked on this request. */
  admin?: boolean;
  /** The admin's own cookie (PORTFOLIO_OWN_COOKIE), if the browser sent one. */
  own?: string;
};

/**
 * What an ordinary person gets, which is also what /api/health reports: EXHBT_PORTFOLIO when it is exactly
 * "page" or "steps", and DEFAULT_PORTFOLIO for anything else or nothing. In development the cookie stands in
 * for the variable when the browser has one.
 */
export function portfolioForEveryone({ variable, production, devCookie }: PortfolioFacts): PortfolioKind {
  const said = !production && (isPortfolioKind(devCookie) || devCookie === "default") ? devCookie : variable;
  return isPortfolioKind(said) ? said : DEFAULT_PORTFOLIO;
}

/**
 * What this person gets. An admin's own choice comes first, over the variable and the default, so an admin
 * can always look at either structure. Everyone else gets what everyone gets.
 */
export function decidePortfolio(facts: PortfolioFacts): PortfolioKind {
  return facts.admin && isPortfolioKind(facts.own) ? facts.own : portfolioForEveryone(facts);
}
