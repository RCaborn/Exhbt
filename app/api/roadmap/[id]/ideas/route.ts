import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { canView } from "@/lib/access";
import { getStore } from "@/lib/store";
import { ideasState, startIdeas } from "@/lib/roadmap/ideas";

/**
 * The project ideas' progress, for the Projects page (docs/decisions/0019).
 * GET only reads. POST makes sure the ideas have been started (idempotent: the store lets one
 * caller through) and answers straight away; `{ "retry": true }` is the "Try again" button, which
 * may restart a failed run, up to a fixed number of tries per roadmap.
 */
async function viewable(id: string) {
  const record = await getStore().getRoadmap(id);
  if (!record || !(await canView(record, await getCurrentUser()))) return null;
  return record;
}

const noStore = { headers: { "cache-control": "no-store" } };

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const record = await viewable((await params).id);
  if (!record?.output) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const { status } = await ideasState(record);
  return NextResponse.json({ status }, noStore);
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const record = await viewable(id);
  if (!record?.output) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const body = (await req.json().catch(() => null)) as { retry?: unknown } | null;
  const status = await startIdeas(id, { retry: body?.retry === true });
  return NextResponse.json({ status }, noStore);
}
