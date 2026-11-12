import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { isPhase2Enabled } from "@/lib/site";
import { deleteFile } from "@/lib/uploads";

/** Removes one of the signed-in person's files (the stored object and its record). */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isPhase2Enabled()) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const ok = await deleteFile(user.id, (await params).id);
  return ok ? new NextResponse(null, { status: 204 }) : NextResponse.json({ error: "File not found." }, { status: 404 });
}
