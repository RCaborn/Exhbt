import { NextResponse, type NextRequest } from "next/server";
import { isPortfolioKind, PORTFOLIO_KIND_COOKIE } from "@/lib/portfolio-kind";
import { isSupabaseConfigured } from "@/lib/store";

export const dynamic = "force-dynamic";

/**
 * Development only: stands in for the runtime variable EXHBT_PORTFOLIO, for this browser alone, so each
 * browser test has its own setting and a failed test cannot leave one behind for the next.
 *   /dev/portfolio-kind?kind=page      as if EXHBT_PORTFOLIO were "page"
 *   /dev/portfolio-kind?kind=steps     as if it were "steps"
 *   /dev/portfolio-kind?kind=default   as if it were not set, so DEFAULT_PORTFOLIO decides
 * It sets the cookie lib/portfolio-kind.ts reads in development and sends the browser to /portfolio.
 * Disabled with Supabase or in production, like /dev/editor.
 */
export async function GET(req: NextRequest) {
  if (isSupabaseConfigured() || process.env.NODE_ENV === "production") return new NextResponse("Not found", { status: 404 });
  const kind = req.nextUrl.searchParams.get("kind");
  if (!isPortfolioKind(kind) && kind !== "default") return new NextResponse("Say kind=page, kind=steps or kind=default", { status: 400 });
  const res = NextResponse.redirect(new URL("/portfolio", req.url), 307);
  res.cookies.set(PORTFOLIO_KIND_COOKIE, kind, { path: "/", sameSite: "lax" });
  return res;
}
