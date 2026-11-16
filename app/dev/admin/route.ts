import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser, safeNext } from "@/lib/auth";
import { getStore, isSupabaseConfigured, setAdminForDevelopment } from "@/lib/store";

/**
 * Development and tests only (no Supabase, not production). The in-memory store has no profiles.role,
 * so this stands in for it:
 *   /dev/admin?role=admin[&next=/admin]  makes the signed-in dev user an exhbt_admin (role=user takes it back)
 *   /dev/admin?seed=<tag>                adds a known set of accounts, roadmaps, events, AI calls and leads
 * The seed is 3 accounts (seed-<tag>-1..3@example.com) with 1, 2 and 3 roadmaps, two failed roadmaps,
 * one cached and one fresh completion, one failed ideas run, two swaps, one AI draft, AI calls costing
 * $0.75 in all, one comp Max subscription (account 1), one waitlist entry and one lead. The e2e reads the overview
 * before and after, so it works on a store the other specs have already filled.
 */
export async function GET(req: NextRequest) {
  if (isSupabaseConfigured() || process.env.NODE_ENV === "production") return new NextResponse("Not found", { status: 404 });
  const url = new URL(req.url);
  const store = getStore();

  const tag = url.searchParams.get("seed");
  if (tag) {
    const clean = tag.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 24) || "x";
    const emails = [1, 2, 3].map((i) => `seed-${clean}-${i}@example.com`);
    for (const [i, email] of emails.entries()) {
      const userId = `dev-${email}`;
      await store.logEvent("signup_completed", userId, { via: "seed" });
      for (let n = 0; n <= i; n++) {
        await store.createRoadmap({ email, input: { targetRole: "Seeded role" } as never, inputHash: `seed-${clean}-${i}-${n}`, ipHash: "seed" });
      }
      await store.claimPendingRoadmaps(email, userId);
    }
    const first = `dev-${emails[0]}`;
    await store.logEvent("roadmap_completed", first, { cached: true });
    await store.logEvent("roadmap_completed", first, { cached: false });
    await store.logEvent("roadmap_failed", first, { message: "seed" });
    await store.logEvent("roadmap_failed", first, { message: "seed" });
    await store.logEvent("ideas_failed", first, { attempt: 1 });
    await store.logEvent("project_swapped", first, { round: 1 });
    await store.logEvent("project_swapped", first, { round: 2 });
    await store.logEvent("exhbt_drafted", first, {});
    await store.logAICall({ userId: first, step: "roadmap", model: "seed", inputTokens: 1000, outputTokens: 500, costUsd: 0.5 });
    await store.logAICall({ userId: first, step: "project_ideas", model: "seed", inputTokens: 400, outputTokens: 200, costUsd: 0.25 });
    await store.upsertSubscription({ userId: first, plan: "max", status: "active", customerId: null, subscriptionId: `comp_${clean}`, renewsAt: null });
    await store.joinWaitlist({ email: `waiting-${clean}@example.com`, interest: "premium", source: "seed" });
    await store.createLead({ name: "Seed Lead", email: `lead-${clean}@example.com`, institution: `Seed University ${clean}`, message: "" });
    return NextResponse.json({ ok: true, emails });
  }

  const role = url.searchParams.get("role");
  if (role !== "admin" && role !== "user") return new NextResponse("Say role=admin, role=user or seed=<tag>", { status: 400 });
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Sign in first", { status: 401 });
  setAdminForDevelopment(user.id, role === "admin");
  const next = url.searchParams.get("next");
  if (next) return NextResponse.redirect(new URL(safeNext(next, "/admin"), url.origin));
  return NextResponse.json({ ok: true, userId: user.id, role });
}
