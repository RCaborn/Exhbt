import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { referralsTestMode, stubbedCredits } from "@/lib/referrals";
import { getStore, isSupabaseConfigured } from "@/lib/store";

/**
 * Development and tests only (EXHBT_REFERRALS_TEST=1, no Supabase): the signed-in person's referral
 * code and records, and the balance credits the stand-in recorded instead of calling Stripe.
 */
export async function GET() {
  if (!referralsTestMode() || isSupabaseConfigured()) return new NextResponse("Not found", { status: 404 });
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Sign in first", { status: 401 });
  const store = getStore();
  return NextResponse.json({
    userId: user.id,
    code: await store.getReferralCode(user.id),
    asReferred: await store.getReferralByReferred(user.id),
    summary: await store.referralSummary(user.id),
    credits: stubbedCredits(),
  });
}
