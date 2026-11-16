import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { getCurrentUser } from "@/lib/auth";
import { isPhase2Enabled } from "@/lib/site";
import { getStore } from "@/lib/store";
import { UPLOAD_KINDS, createUpload } from "@/lib/uploads";

/**
 * A signed URL to upload one file straight to Storage (lib/uploads.ts). Signed in only.
 * Body: { name, mime, bytes, kind?, exhbtId? } → { fileId, uploadUrl, headers }.
 */

const Body = z.object({
  name: z.string().min(1).max(200),
  mime: z.string().max(200).default(""),
  bytes: z.number().int().positive(),
  kind: z.enum(UPLOAD_KINDS).default("source"),
  exhbtId: z.string().max(64).optional(),
});

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

export async function POST(req: Request) {
  if (!isPhase2Enabled()) return fail("Not found", 404);
  const user = await getCurrentUser();
  if (!user) return fail("Sign in to upload files.", 401);

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("That upload request wasn't complete. Try again.", 400);
  const { exhbtId, ...file } = parsed.data;
  if (exhbtId && (await getStore().getExhbt(exhbtId))?.userId !== user.id) return fail("That exhbt isn't yours.", 403);

  const res = await createUpload(user.id, { ...file, exhbtId });
  if (!res.ok) return fail(res.reason, res.status);
  return NextResponse.json({ fileId: res.fileId, uploadUrl: res.uploadUrl, headers: res.headers });
}
