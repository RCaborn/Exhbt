import { NextResponse, type NextRequest } from "next/server";
import type { Plan } from "@/lib/entitlements";
import { sampleDocs } from "@/lib/exhbt/sample";
import { usernameProblem } from "@/lib/hosts";
import { normaliseLayout } from "@/lib/portfolio-layout";
import { getStore, isSupabaseConfigured, setPlanForDevelopment } from "@/lib/store";

const PLANS: Plan[] = ["free", "premium", "max", "institutional"];

/** Titles for copies of a sample exhbt, so `count` can go past the samples (to try the customiser with several tiles). */
const MORE_TITLES = [
  "Planning staff rotas for a campus cafe",
  "Mapping late buses on a student route",
  "Tracking recycling across a halls site",
  "Costing a society's events budget",
  "Measuring noise around a library",
  "Comparing study spaces by how often they are used",
];
const MAX_COUNT = sampleDocs.length + MORE_TITLES.length;

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
  const planParam = q.get("plan") ?? "premium";
  const plan = planParam as Plan;
  const count = Math.max(0, Math.min(MAX_COUNT, Number(q.get("count") ?? sampleDocs.length)));
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
  // A fresh arrangement too: the default layout, nothing hidden or featured.
  await store.savePortfolioLayout(userId, { layout: normaliseLayout(null), featuredExhbtId: null, hiddenIds: [], order: [] });
  for (let i = 0; i < count; i++) {
    const base = sampleDocs[i % sampleDocs.length]!;
    const doc = i < sampleDocs.length ? base : { ...base, title: MORE_TITLES[i - sampleDocs.length]! };
    const id = await store.createExhbt(userId, doc);
    await store.publishExhbt(id, userId, i === 0 ? "gp-reminders" : i === 1 ? "library-footfall" : `project-${i + 1}`);
  }
  return NextResponse.redirect(new URL(`/p/${username}`, req.url));
}
