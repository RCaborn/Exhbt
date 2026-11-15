import { NextResponse, type NextRequest } from "next/server";
import type { Plan } from "@/lib/entitlements";
import { normaliseDoc, type ExhbtDoc } from "@/lib/exhbt/blocks";
import { sampleSeeds } from "@/lib/exhbt/sample";
import { usernameProblem } from "@/lib/hosts";
import { getStore, isSupabaseConfigured, setPlanForDevelopment, setStoredCopiesForDevelopment } from "@/lib/store";

const PLANS: Plan[] = ["free", "premium", "max", "institutional"];

/**
 * Development only: makes a fictional portfolio so the pages can be seen and tested before the
 * editor exists. /dev/portfolio?username=amara&plan=premium&count=2 → /p/amara.
 * The user is the dev sign-in user for `<username>@example.com` (app/auth/dev), so signing in
 * as that address later edits the same portfolio. Disabled with Supabase or in production.
 *
 * The GP sample is stored in the layout from before sections (lib/exhbt/sample.ts, decision
 * 0015), in both copies, so the path old exhbts take is what the pages show. `layout=sections`
 * stores it already read into sections instead, to compare the two.
 */
export async function GET(req: NextRequest) {
  if (isSupabaseConfigured() || process.env.NODE_ENV === "production") return new NextResponse("Not found", { status: 404 });
  const q = new URL(req.url).searchParams;
  const username = (q.get("username") ?? "amara").toLowerCase();
  const planParam = q.get("plan") ?? "premium";
  const plan = planParam as Plan;
  const count = Math.max(0, Math.min(sampleSeeds.length, Number(q.get("count") ?? sampleSeeds.length)));
  const converted = q.get("layout") === "sections";
  if (usernameProblem(username)) return new NextResponse(usernameProblem(username), { status: 400 });
  if (planParam !== "subscription" && !PLANS.includes(plan)) return new NextResponse("Unknown plan", { status: 400 });

  const store = getStore();
  const userId = `dev-${username}@example.com`;
  if ((await store.claimUsername(userId, username)) === "taken") return new NextResponse("Username taken", { status: 409 });
  if (planParam !== "subscription") setPlanForDevelopment(userId, plan);
  await store.updatePortfolioProfile(userId, {
    name: "Amara Okafor",
    headline: "Data analyst, health and public services",
    bio: "Final-year Data Science student. I like problems where a small change saves real time or money.",
    linkedin: "https://www.linkedin.com/in/example",
  });
  for (const e of await store.listExhbts(userId)) await store.deleteExhbt(e.id, userId);
  for (const [i, seed] of sampleSeeds.slice(0, count).entries()) {
    const id = await store.createExhbt(userId, normaliseDoc(seed));
    await store.publishExhbt(id, userId, i === 0 ? "gp-reminders" : "library-footfall");
    // As stored before sections, both copies (createExhbt and publishing write the current shape).
    if (!converted && (seed as ExhbtDoc).sections === undefined) setStoredCopiesForDevelopment(id, { doc: seed, published: seed });
  }
  return NextResponse.redirect(new URL(`/p/${username}`, req.url));
}
