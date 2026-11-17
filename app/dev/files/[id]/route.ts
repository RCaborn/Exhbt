import { NextResponse } from "next/server";
import { devBlobs, devStorageEnabled } from "@/lib/files";
import { getStore } from "@/lib/store";

/**
 * Development only: serves a file uploaded through /dev/upload, as signedFileUrl links to it
 * (lib/files.ts), so portfolio pages show images and evidence locally. 404 otherwise.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!devStorageEnabled()) return new NextResponse("Not found", { status: 404 });
  const id = (await params).id;
  const file = await getStore().getFile(id);
  const bytes = devBlobs().get(id);
  if (!file || !bytes) return new NextResponse("Not found", { status: 404 });
  const name = file.path.split("/").pop() ?? "file";
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": file.mime,
      "Content-Length": String(bytes.length),
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
      // Images show inline; anything else downloads, as with the signed Storage links.
      "Content-Disposition": `${file.mime.startsWith("image/") ? "inline" : "attachment"}; filename="${name}"`,
    },
  });
}
