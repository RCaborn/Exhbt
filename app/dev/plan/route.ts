import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser, safeNext } from "@/lib/auth";
import type { Plan } from "@/lib/entitlements";
import { isSupabaseConfigured, setPlanForDevelopment } from "@/lib/store";

const PLANS: Plan[] = ["free", "premium", "max", "institutional"];

/**
 * Development only: puts the signed-in dev user on a plan without Stripe, then goes back.
 * /dev/plan?plan=premium&next=/exhbts. Disabled with Supabase or in production.
 */
export async function GET(req: NextRequest) {
  if (isSupabaseConfigured() || process.env.NODE_ENV === "production") return new NextResponse("Not found", { status: 404 });
  const url = new URL(req.url);
  const plan = url.searchParams.get("plan") as Plan;
  if (!PLANS.includes(plan)) return new NextResponse("Unknown plan", { status: 400 });
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Sign in first", { status: 401 });
  setPlanForDevelopment(user.id, plan);
  const referer = req.headers.get("referer");
  const back = url.searchParams.get("next") ?? (referer && new URL(referer).origin === url.origin ? new URL(referer).pathname : null);
  return NextResponse.redirect(new URL(safeNext(back, "/exhbts"), url.origin));
}
