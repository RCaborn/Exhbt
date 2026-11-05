import { NextResponse, type NextRequest } from "next/server";
import { DEV_USER_COOKIE, safeNext } from "@/lib/auth";
import { getStore, isSupabaseConfigured } from "@/lib/store";

/** Local development stand-in for the magic link. Disabled whenever Supabase is configured or in production. */
export async function GET(req: NextRequest) {
  if (isSupabaseConfigured() || process.env.NODE_ENV === "production") {
    return new NextResponse("Not found", { status: 404 });
  }
  const url = new URL(req.url);
  const email = (url.searchParams.get("email") ?? "").toLowerCase();
  if (!email.includes("@")) return new NextResponse("Bad request", { status: 400 });

  await getStore().claimPendingRoadmaps(email, `dev-${email}`);
  const res = NextResponse.redirect(new URL(safeNext(url.searchParams.get("next")), url.origin));
  res.cookies.set(DEV_USER_COOKIE, email, { httpOnly: true, sameSite: "lax", path: "/" });
  return res;
}
