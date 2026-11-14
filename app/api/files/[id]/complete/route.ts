import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { completeUpload } from "@/lib/duplicates";
import { isPhase2Enabled } from "@/lib/site";

/**
 * Called by the browser once it has PUT a file's bytes to Storage. The server reads the stored
 * object back and records its SHA-256 (lib/duplicates.ts), so the fingerprint is ours, not the
 * browser's. If the same file is on someone else's exhbt, `match` is an opaque id for the prompt:
 * it never says whose exhbt it is.
 * → { match: { id, name } | null }
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isPhase2Enabled()) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const res = await completeUpload(user.id, (await params).id);
  if (!res.ok) return NextResponse.json({ error: res.reason }, { status: res.status });
  return NextResponse.json({ match: res.match });
}
