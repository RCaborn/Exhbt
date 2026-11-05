import { NextResponse, type NextRequest } from "next/server";
import { safeNext, supabaseServer } from "@/lib/auth";
import { getStore } from "@/lib/store";

/** Supabase magic-link landing: exchange the code, attach any pending roadmap, continue. */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const next = safeNext(url.searchParams.get("next"));
  if (!code) return NextResponse.redirect(new URL("/login?error=link", url.origin));

  const sb = await supabaseServer();
  const { data, error } = await sb.auth.exchangeCodeForSession(code);
  if (error || !data.user?.email) return NextResponse.redirect(new URL("/login?error=link", url.origin));

  const store = getStore();
  await store.claimPendingRoadmaps(data.user.email, data.user.id);
  await store.logEvent("signup_completed", data.user.id);
  return NextResponse.redirect(new URL(next, url.origin));
}
