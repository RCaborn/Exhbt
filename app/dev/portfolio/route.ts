import { NextResponse, type NextRequest } from "next/server";
import type { Plan } from "@/lib/entitlements";
import { sampleDocs } from "@/lib/exhbt/sample";
import { usernameProblem } from "@/lib/hosts";
import { getStore, isSupabaseConfigured, setPlanForDevelopment } from "@/lib/store";

const PLANS: Plan[] = ["free", "premium", "max", "institutional"];

/**
 * Development only: makes a fictional portfolio so the pages can be seen and tested before the
 * editor exists. /dev/portfolio?username=amara&plan=premium&count=2 → /p/amara.
 * The user is the dev sign-in user for `<username>@example.com` (app/auth/dev), so signing in
 * as that address later edits the same portfolio. Disabled with Supabase or in production.
 */
export async function GET(req: NextRequest) {
  if (isSupabaseConfigured() || process.env.NODE_ENV === "production") return new NextResponse("Not found", { status: 404 });
  const q = new URL(req.url).searchParams;
  const username = (q.get("username") ?? "amara").toLowerCase();
  const plan = (q.get("plan") ?? "premium") as Plan;
  const count = Math.max(0, Math.min(sampleDocs.length, Number(q.get("count") ?? sampleDocs.length)));
  if (usernameProblem(username)) return new NextResponse(usernameProblem(username), { status: 400 });
  if (!PLANS.includes(plan)) return new NextResponse("Unknown plan", { status: 400 });

  const store = getStore();
  const userId = `dev-${username}@example.com`;
  if ((await store.claimUsername(userId, username)) === "taken") return new NextResponse("Username taken", { status: 409 });
  setPlanForDevelopment(userId, plan);
  await store.updatePortfolioProfile(userId, {
    name: "Amara Okafor",
    headline: "Data analyst, health and public services",
    bio: "Final-year Data Science student. I like problems where a small change saves real time or money.",
    linkedin: "https://www.linkedin.com/in/example",
  });
  for (const e of await store.listExhbts(userId)) await store.deleteExhbt(e.id, userId);
  for (const [i, doc] of sampleDocs.slice(0, count).entries()) {
    const id = await store.createExhbt(userId, doc);
    await store.publishExhbt(id, userId, i === 0 ? "gp-reminders" : "library-footfall");
  }
  return NextResponse.redirect(new URL(`/p/${username}`, req.url));
}
