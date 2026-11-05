import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { safeNext, supabaseServer } from "@/lib/auth";
import { getStore, isSupabaseConfigured } from "@/lib/store";

/**
 * Landing for sign-in links we put in our own emails (see signInLinkFor).
 * Verifies the hashed token, starts the session, attaches the visitor's roadmaps.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const tokenHash = url.searchParams.get("token_hash");
  const type = (url.searchParams.get("type") ?? "magiclink") as EmailOtpType;
  const next = safeNext(url.searchParams.get("next"));
  const fail = NextResponse.redirect(new URL("/login?error=link", url.origin));
  if (!isSupabaseConfigured() || !tokenHash) return fail;

  const sb = await supabaseServer();
  const { data, error } = await sb.auth.verifyOtp({ type, token_hash: tokenHash });
  if (error || !data.user?.email) return fail;

  const store = getStore();
  await store.claimPendingRoadmaps(data.user.email, data.user.id);
  await store.logEvent("signup_completed", data.user.id, { via: "roadmap_email" });
  return NextResponse.redirect(new URL(next, url.origin));
}
