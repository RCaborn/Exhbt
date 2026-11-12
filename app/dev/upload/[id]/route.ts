import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { devBlobs, devStorageEnabled } from "@/lib/files";
import { getStore } from "@/lib/store";

/**
 * Development only: stands in for a Supabase signed upload URL (lib/uploads.ts). Keeps the
 * bytes in memory, keyed by file id. 404 with Supabase configured or in production.
 */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!devStorageEnabled()) return new NextResponse("Not found", { status: 404 });
  const id = (await params).id;
  const [file, user] = await Promise.all([getStore().getFile(id), getCurrentUser()]);
  if (!file || !user || file.userId !== user.id) return new NextResponse("Not found", { status: 404 });
  const bytes = new Uint8Array(await req.arrayBuffer());
  // The record was made for a size the plan allows; a bigger body is refused, as Storage would.
  if (bytes.length === 0 || bytes.length > file.bytes) return new NextResponse("Wrong size", { status: 400 });
  devBlobs().set(id, bytes);
  return NextResponse.json({ Key: file.path });
}
