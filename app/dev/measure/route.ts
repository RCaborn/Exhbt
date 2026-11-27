import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { outbox } from "@/lib/email/send";
import type { Plan } from "@/lib/entitlements";
import { afterPublish } from "@/lib/publish-follow-up";
import { emptyDoc, text } from "@/lib/exhbt/blocks";
import { getStore, isSupabaseConfigured, memorySnapshot } from "@/lib/store";

/**
 * Development and tests only (no Supabase, not production), for the publish numbers and the first-publish email:
 *   /dev/measure?events=<name>   the signed-in person's events of that name, with their props
 *   /dev/measure?gate=<plan>&tag=<tag>  runs the after-publish step (the event and the email) for a new person's first exhbt on
 *                                that plan, which the publish action never reaches on Free: how many exhbt_published events
 *                                and first-publish emails came of it
 *   /dev/measure?claim=<tag>     asks for the first-publish claim ten times at once for one new person: how many won
 *   /dev/measure?seed=<tag>      four accounts: one with a draft only, one with one exhbt published, one with two published,
 *                                and one with an exhbt published then unpublished beside a draft; returns the addresses
 * The e2e reads N1 and N2 before and after, because the in-memory store is shared by the whole run.
 */
export async function GET(req: NextRequest) {
  if (isSupabaseConfigured() || process.env.NODE_ENV === "production") return new NextResponse("Not found", { status: 404 });
  const url = new URL(req.url);
  const store = getStore();

  const name = url.searchParams.get("events");
  if (name) {
    const user = await getCurrentUser();
    if (!user) return new NextResponse("Sign in first", { status: 401 });
    const mine = (memorySnapshot()?.events ?? []).filter((e) => e.name === name && e.userId === user.id);
    return NextResponse.json({ events: mine.map((e) => ({ name: e.name, props: e.props })) });
  }

  const gate = url.searchParams.get("gate") as Plan | null;
  if (gate) {
    const clean = (url.searchParams.get("tag") ?? "x").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 24) || "x";
    const email = `gate-${gate}-${clean}@example.com`;
    const userId = `dev-${email}`;
    const id = await store.createExhbt(userId, { ...emptyDoc(), title: "Gate check", gap: text("A question") });
    await store.publishExhbt(id, userId, "gate-check", { unchecked: true });
    await afterPublish({ userId, email, exhbtId: id, slug: "gate-check", portfolioBase: "http://localhost/p/gate", plan: gate, before: [], origin: "http://localhost" });
    const events = (memorySnapshot()?.events ?? []).filter((e) => e.userId === userId);
    return NextResponse.json({
      published: events.filter((e) => e.name === "exhbt_published").length,
      claims: events.filter((e) => e.name === "first_publish_emailed").length,
      emails: outbox().filter((m) => m.to === email).length,
    });
  }

  const claimTag = url.searchParams.get("claim");
  if (claimTag) {
    const userId = `dev-claim-${claimTag.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 24)}@example.com`;
    const results = await Promise.all(Array.from({ length: 10 }, () => store.claimEventOnce("first_publish_emailed", userId)));
    return NextResponse.json({ winners: results.filter(Boolean).length });
  }

  const tag = url.searchParams.get("seed");
  if (!tag) return new NextResponse("Say events=<name> or seed=<tag>", { status: 400 });
  const clean = tag.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 24) || "x";
  const emails = ["none", "one", "two", "gone"].map((k) => `pub-${clean}-${k}@example.com`);
  const [none, one, two, gone] = emails.map((e) => `dev-${e}`) as [string, string, string, string];
  const make = async (userId: string, title: string, publish: boolean) => {
    const id = await store.createExhbt(userId, { ...emptyDoc(), title, gap: text("A question") });
    if (publish) await store.publishExhbt(id, userId, `s-${id.slice(0, 8)}`, { unchecked: true });
    return id;
  };
  await store.logEvent("signup_completed", none, { via: "seed" });
  await make(none, "Draft only", false);
  await make(one, "Published once", true);
  await make(two, "First of two", true);
  await make(two, "Second of two", true);
  // Published, then taken down: it still counts, and so does the person.
  const down = await make(gone, "Taken down", true);
  await store.unpublishExhbt(down, gone);
  await make(gone, "Never published", false);
  return NextResponse.json({ ok: true, emails });
}
