import { NextResponse, type NextRequest } from "next/server";
import { emptyDoc } from "@/lib/exhbt/blocks";
import { usernameProblem } from "@/lib/hosts";
import { getStore, isSupabaseConfigured } from "@/lib/store";

/**
 * Development only: asks the store to publish a doc as it is stored, to test that store.publishExhbt
 * checks the whole doc itself (a save that lands after the publish action's own check must not slip
 * past it). POST { username, doc } stores `doc` as a new working copy for that development user and
 * calls publishExhbt on it with no help from the caller; it answers { published, status, live }:
 * what publishExhbt returned, the stored status, and whether a live copy exists.
 *
 * Disabled with Supabase or in production, as app/dev/parity is.
 */
const off = () => isSupabaseConfigured() || process.env.NODE_ENV === "production";

export async function POST(req: NextRequest) {
  if (off()) return new NextResponse("Not found", { status: 404 });
  const body = (await req.json().catch(() => null)) as { username?: unknown; doc?: unknown } | null;
  const username = typeof body?.username === "string" ? body.username.toLowerCase() : "";
  if (!body || usernameProblem(username) || typeof body.doc !== "object" || body.doc === null) return new NextResponse("Send { username, doc }", { status: 400 });
  const store = getStore();
  const userId = `dev-${username}@example.com`;
  const id = await store.createExhbt(userId, emptyDoc());
  // Saved raw, as a save that raced the publish would have left it.
  await store.saveExhbtDraft(id, userId, body.doc as Parameters<typeof store.saveExhbtDraft>[2]);
  const published = await store.publishExhbt(id, userId, `check-${id.slice(0, 8)}`);
  const record = (await store.listExhbts(userId)).find((e) => e.id === id);
  return NextResponse.json({ published, status: record?.status ?? null, live: Boolean(record?.published) });
}
