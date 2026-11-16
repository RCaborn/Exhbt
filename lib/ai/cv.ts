import "server-only";
import { transcribe, type MediaType, type TranscribeResult } from "./transcribe";

/**
 * The last-resort CV reader: a scanned PDF or a photo of a CV to plain text. A wrapper over
 * lib/ai/transcribe.ts, which holds the prompt (copy only, add nothing).
 */

export type CvMediaType = MediaType;
export type CvReadResult = TranscribeResult;

export function transcribeCv(data: Uint8Array, mediaType: CvMediaType): Promise<CvReadResult> {
  return transcribe(data, mediaType, "cv");
}
