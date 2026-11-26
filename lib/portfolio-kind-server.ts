import "server-only";
import { cookies } from "next/headers";
import { isAdmin } from "./admin";
import { getCurrentUser } from "./auth";
import { decidePortfolio, isPortfolioKind, PORTFOLIO_KIND_COOKIE, PORTFOLIO_OWN_COOKIE, portfolioForEveryone, type PortfolioFacts, type PortfolioKind } from "./portfolio-kind";

/*
 * The request's side of the portfolio switch: what lib/portfolio-kind.ts decides from. It is a file of its
 * own, marked server only, because it reads the request's cookies (`next/headers`), which client code must
 * not import; the rule itself has no such need.
 *
 * EXHBT_PORTFOLIO is read on each request, so changing it in the Cloudflare dashboard takes effect without a
 * build. It is not in wrangler.jsonc, whose vars are reset on every deploy, and not in next.config.ts,
 * which is fixed at build.
 */
async function facts(): Promise<PortfolioFacts> {
  const jar = await cookies();
  return {
    variable: process.env.EXHBT_PORTFOLIO,
    production: process.env.NODE_ENV === "production",
    devCookie: jar.get(PORTFOLIO_KIND_COOKIE)?.value,
    own: jar.get(PORTFOLIO_OWN_COOKIE)?.value,
  };
}

/** What an ordinary person gets now. /api/health reports this, and the landings after sign-in follow it. */
export async function portfolioKindForEveryone(): Promise<PortfolioKind> {
  return portfolioForEveryone(await facts());
}

/** What the signed-in person gets. `admin` is isAdmin(user), checked on this request: only then does their own choice count. */
export async function portfolioKind(admin: boolean): Promise<PortfolioKind> {
  return decidePortfolio({ ...(await facts()), admin });
}

/**
 * The same, for code with no signed-in person to hand (the app layout's nav): it asks who is signed in, and
 * whether they are an admin, only when their own choice is there to count, since asking is a call to the
 * sign-in service on the live site.
 */
export async function portfolioServed(): Promise<PortfolioKind> {
  const f = await facts();
  if (!isPortfolioKind(f.own)) return portfolioForEveryone(f);
  return decidePortfolio({ ...f, admin: await isAdmin(await getCurrentUser()) });
}
