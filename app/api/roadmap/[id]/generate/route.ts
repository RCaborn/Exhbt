import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { canView, callerIpHash } from "@/lib/access";
import { HOUR, rateLimited } from "@/lib/rate-limit";
import { getStore } from "@/lib/store";
import { ensureRoadmap, GenerationBusyError, GenerationError } from "@/lib/roadmap-service";

/** Cap how often one browser/IP can poke generate (locks still prevent parallel AI calls). */
const GENERATE_PER_IP_PER_HOUR = 30;

/** Called by the "Building your roadmap" screen. Idempotent once output exists. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  const store = getStore();
  const record = await store.getRoadmap(id);
  if (!record || !(await canView(record, user))) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (!record.output) {
    const ip = await callerIpHash();
    if (await rateLimited("roadmap-generate", GENERATE_PER_IP_PER_HOUR, HOUR, id)) {
      return NextResponse.json({ error: "rate_limited" }, { status: 429 });
    }
    // Also key a short per-roadmap burst so retries from one tab don't stack calls before the lock settles.
    if (!(await store.takeRateLimit(`gen-burst:${id}:${ip}`, 6, 60))) {
      return NextResponse.json({ error: "busy" }, { status: 409 });
    }
  }
  try {
    await ensureRoadmap(record, user?.id ?? null);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof GenerationBusyError) {
      return NextResponse.json({ error: "busy" }, { status: 409 });
    }
    if (e instanceof GenerationError) {
      return NextResponse.json({ error: "generation_failed" }, { status: 502 });
    }
    throw e;
  }
}
