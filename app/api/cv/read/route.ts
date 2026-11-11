import { NextResponse } from "next/server";
import { transcribeCv, type CvMediaType } from "@/lib/ai/cv";
import { callerIpHash } from "@/lib/access";
import { checkCvText, cleanCvText } from "@/lib/cv-quality";
import { getStore } from "@/lib/store";

/**
 * Reads a CV the browser couldn't (a scanned PDF, a photo) by asking the AI to transcribe it.
 * Called only after the visitor agrees to send the file. The file is not stored: it goes to
 * the model and is dropped, and only the text comes back.
 */

const MAX_BYTES = 5 * 1024 * 1024;
/** Each read costs an AI call, so one connection gets a few a day. Real visitors need one or two. */
const PER_IP_PER_DAY = (process.env.NODE_ENV !== "production" && Number(process.env.EXHBT_CV_READS_PER_DAY)) || 6;

function mediaTypeOf(b: Uint8Array): CvMediaType | null {
  const at = (sig: number[], from = 0) => sig.every((v, i) => b[from + i] === v);
  if (at([0x25, 0x50, 0x44, 0x46])) return "application/pdf";
  if (at([0x89, 0x50, 0x4e, 0x47])) return "image/png";
  if (at([0xff, 0xd8, 0xff])) return "image/jpeg";
  if (at([0x47, 0x49, 0x46, 0x38])) return "image/gif";
  if (at([0x52, 0x49, 0x46, 0x46]) && at([0x57, 0x45, 0x42, 0x50], 8)) return "image/webp";
  // Some PDFs carry junk before the header; the format allows it within the first 1 KB.
  const head = new TextDecoder("latin1").decode(b.subarray(0, 1024));
  return head.includes("%PDF-") ? "application/pdf" : null;
}

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

export async function POST(req: Request) {
  let file: FormDataEntryValue | null;
  try {
    file = (await req.formData()).get("file");
  } catch {
    return fail("We couldn't receive that file. Try again, or paste the text.", 400);
  }
  if (!(file instanceof File) || file.size === 0) return fail("No file arrived. Try again, or paste the text.", 400);
  if (file.size > MAX_BYTES) return fail("That file is over 5 MB. Try a smaller file, or paste the text.", 413);

  const bytes = new Uint8Array(await file.arrayBuffer());
  const mediaType = mediaTypeOf(bytes);
  if (!mediaType) return fail("We can only read PDFs and images this way. Paste the text instead.", 415);

  const store = getStore();
  const ipHash = await callerIpHash();
  if ((await store.countRecentEvents("cv_read_ai", ipHash, 24)) >= PER_IP_PER_DAY) {
    return fail("You've reached today's limit for reading scanned CVs. Paste the text instead.", 429);
  }
  // Counted before the call, so failed attempts count towards the limit too.
  await store.logEvent("cv_read_ai", null, { ipHash, mediaType, bytes: file.size });

  try {
    const result = await transcribeCv(bytes, mediaType);
    await store.logAICall({
      userId: null,
      step: "cv_read",
      model: result.model,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      costUsd: result.costUsd,
    });
    const text = cleanCvText(result.text);
    if (!checkCvText(text).ok) {
      await store.logEvent("cv_read_failed", null, { reason: "unreadable", mediaType });
      return fail("We couldn't find CV text in that file. Check it's the right file, or paste the text.", 422);
    }
    return NextResponse.json({ text });
  } catch (e) {
    console.error("cv read failed", (e as Error).message);
    await store.logEvent("cv_read_failed", null, { reason: "error", message: (e as Error).message.slice(0, 200) });
    return fail("We couldn't read that file just now. Try again in a moment, or paste the text.", 502);
  }
}
