import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { fileIdsIn } from "@/lib/exhbt/doc-files";
import { isPhase2Enabled } from "@/lib/site";
import { getStore } from "@/lib/store";
import { deleteFile } from "@/lib/uploads";

/**
 * Removes one of the signed-in person's files (the stored object and its record). A file any of
 * their exhbts still uses, in its working copy or its published copy, is kept, and the answer is
 * the same as if it had gone (decision 0026, "Saving, and what may delete a file"): two editors
 * open on one exhbt must never delete a picture the other, or the live page, still shows.
 */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isPhase2Enabled()) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const id = (await params).id;
  const inUse = (await getStore().listExhbts(user.id)).some((e) => fileIdsIn(e.doc).includes(id) || (e.published !== null && fileIdsIn(e.published).includes(id)));
  if (inUse) return new NextResponse(null, { status: 204 });
  const ok = await deleteFile(user.id, id);
  return ok ? new NextResponse(null, { status: 204 }) : NextResponse.json({ error: "File not found." }, { status: 404 });
}
