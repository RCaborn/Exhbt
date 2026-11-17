import { NextResponse } from "next/server";
import { transcribe, mediaTypeOf } from "@/lib/ai/transcribe";
import { callerIpHash } from "@/lib/access";
import { getCurrentUser } from "@/lib/auth";
import { MAX_DOC_CHARS, cleanCvText } from "@/lib/cv-quality";
import { getPlan, limitsFor } from "@/lib/plan";
import { isPhase2Enabled } from "@/lib/site";
import { getStore } from "@/lib/store";

/**
 * Reads project material the browser couldn't (a scanned PDF, a photo of notes or a
 * whiteboard) by asking the AI to transcribe it. Called only after the person agrees to send
 * the file (the consent prompt on /exhbts/new). The file goes to the model and is dropped here;
 * only the text comes back. Uploading it for keeps is a separate step (/api/files/upload-url).
 */

const MB = 1024 * 1024;
/** The model takes images up to 5 MB each. */
const MAX_IMAGE_BYTES = 5 * MB;
/** Each read costs an AI call, so one connection gets a handful a day, as for CV reads. */
const PER_IP_PER_DAY = (process.env.NODE_ENV !== "production" && Number(process.env.EXHBT_FILE_READS_PER_DAY)) || 12;

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

export async function POST(req: Request) {
  if (!isPhase2Enabled()) return fail("Not found", 404);
  const user = await getCurrentUser();
  if (!user) return fail("Sign in to read files.", 401);

  let file: FormDataEntryValue | null;
  try {
    file = (await req.formData()).get("file");
  } catch {
    return fail("We couldn't receive that file. Try again, or type the text into your notes.", 400);
  }
  if (!(file instanceof File) || file.size === 0) return fail("No file arrived. Try again.", 400);
  const capMb = limitsFor(await getPlan(user.id)).uploadMbPerFile;
  if (file.size > capMb * MB) return fail(`That file is over ${capMb} MB, the limit for each file on your plan.`, 413);

  const bytes = new Uint8Array(await file.arrayBuffer());
  const mediaType = mediaTypeOf(bytes);
  if (!mediaType) return fail("We can only read PDFs and images this way. Type the text into your notes instead.", 415);
  if (mediaType !== "application/pdf" && file.size > MAX_IMAGE_BYTES) {
    return fail("Photos over 5 MB can't be read. Take a smaller photo or a screenshot.", 413);
  }

  const store = getStore();
  const ipHash = await callerIpHash();
  if ((await store.countRecentEvents("file_read_ai", ipHash, 24)) >= PER_IP_PER_DAY) {
    return fail("You've reached today's limit for reading scans and photos. Type the text into your notes instead.", 429);
  }
  // Counted before the call, so failed attempts count towards the limit too.
  await store.logEvent("file_read_ai", user.id, { ipHash, mediaType, bytes: file.size });

  try {
    const result = await transcribe(bytes, mediaType, "project");
    // Its own step, so reading files is costed apart from drafting. ai_call_logs only accepts
    // 'file_transcribe' once supabase/migrations/20261115000000_billing_and_files.sql is applied:
    // apply that migration before this code reaches a Supabase database.
    await store.logAICall({
      userId: user.id,
      step: "file_transcribe",
      model: result.model,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      costUsd: result.costUsd,
    });
    const text = cleanCvText(result.text, MAX_DOC_CHARS);
    if (text.length < 20) return fail("We couldn't find any text in that file. Type what matters into your notes instead.", 422);
    return NextResponse.json({ text });
  } catch (e) {
    console.error("file read failed", (e as Error).message);
    return fail("We couldn't read that file just now. Try again in a moment, or type the text into your notes.", 502);
  }
}
