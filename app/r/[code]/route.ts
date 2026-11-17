import { NextResponse, type NextRequest } from "next/server";
import { getStore } from "@/lib/store";
import { REFERRAL_CODE_RE, REFERRAL_COOKIE, referralCookieOptions, referralCookieValue, referralsLive } from "@/lib/referrals";

export const dynamic = "force-dynamic";

/**
 * A referral link, /r/<code> (decision 0020). Sets the first-party cookie exhbt_ref (httpOnly,
 * 30 days, signed) and goes to /start. A code nobody has, or referrals being off, just goes to the
 * home page with no cookie. Never says whether a code exists.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const clean = code.toLowerCase();
  const known = referralsLive() && REFERRAL_CODE_RE.test(clean) && (await getStore().findUserByReferralCode(clean));
  if (!known) return NextResponse.redirect(new URL("/", req.url), 307);
  const res = NextResponse.redirect(new URL("/start", req.url), 307);
  res.cookies.set(REFERRAL_COOKIE, await referralCookieValue(clean), referralCookieOptions(req.headers.get("host")));
  res.headers.set("cache-control", "no-store");
  return res;
}
