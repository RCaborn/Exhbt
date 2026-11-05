import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { canView } from "@/lib/access";
import { getStore } from "@/lib/store";
import { ensureRoadmap, GenerationError } from "@/lib/roadmap-service";

/** Called by the "Building your roadmap" screen. Idempotent. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  const record = await getStore().getRoadmap(id);
  if (!record || !(await canView(record, user))) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  try {
    await ensureRoadmap(record, user?.id ?? null);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof GenerationError) {
      return NextResponse.json({ error: "generation_failed" }, { status: 502 });
    }
    throw e;
  }
}
