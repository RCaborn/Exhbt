import { NextResponse, type NextRequest } from "next/server";
import { isAdmin } from "@/lib/admin";
import { getCurrentUser } from "@/lib/auth";
import { isPortfolioKind, PORTFOLIO_OWN_COOKIE } from "@/lib/portfolio-kind";
import { isPhase2Enabled } from "@/lib/site";

const YEAR = 60 * 60 * 24 * 365;

/**
 * An admin's own choice of structure (lib/portfolio-kind.ts; decision 0031, "The switch"): stores it in a
 * cookie in this browser. Only for a signed-in admin, recognised as /admin recognises one. Anyone else gets
 * the plain 404 of a route that was never there, and no cookie. The cookie decides nothing by itself: the
 * app counts it only while the person signed in is an admin.
 *
 * A form post with `kind`, "page" or "steps". It answers by sending the browser to /portfolio.
 */
export async function POST(req: NextRequest) {
  if (!isPhase2Enabled() || !(await isAdmin(await getCurrentUser()))) return new NextResponse("Not found", { status: 404 });
  const form = await req.formData().catch(() => null);
  const kind = form?.get("kind");
  if (!isPortfolioKind(kind)) return new NextResponse("Say kind=page or kind=steps", { status: 400 });
  const res = NextResponse.redirect(new URL("/portfolio", req.url), 303);
  res.cookies.set(PORTFOLIO_OWN_COOKIE, kind, { path: "/", httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: YEAR });
  return res;
}
