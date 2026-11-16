import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { usernameProblem } from "@/lib/hosts";
import { isPhase2Enabled } from "@/lib/site";
import { getStore } from "@/lib/store";

export type UsernameCheck = { ok: boolean; reason?: string };

const reply = (body: UsernameCheck | { error: string }, status = 200) =>
  NextResponse.json(body, { status, headers: { "cache-control": "no-store" } });

/**
 * The live availability check on /account/portfolio. Signed in only. The person's own current
 * name, and their old name while it still redirects to them, count as available.
 */
export async function GET(req: NextRequest) {
  if (!isPhase2Enabled()) return reply({ error: "Not found" }, 404);
  const user = await getCurrentUser();
  if (!user) return reply({ error: "Not signed in" }, 401);

  const name = (req.nextUrl.searchParams.get("name") ?? "").trim().toLowerCase();
  const problem = usernameProblem(name);
  if (problem) return reply({ ok: false, reason: problem });

  const store = getStore();
  const found = await store.lookupUsername(name);
  if (!found) return reply({ ok: true });
  if ("userId" in found) return reply(found.userId === user.id ? { ok: true } : { ok: false, reason: "That name is taken. Try another." });
  // A name in its 30-day redirect: free only to the person it still points to.
  const mine = (await store.getPortfolioProfile(user.id)).username;
  return reply(found.redirectTo === mine ? { ok: true } : { ok: false, reason: "That name is taken. Try another." });
}
