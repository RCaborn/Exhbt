import type { RoadmapInput } from "./ai/schemas";

/**
 * Version of the roadmap output shape. Bump it when the output gains fields, so cached
 * outputs from before the change aren't reused for new requests. 2: added skillMap.
 * 3: level anchors in the skillMap prompt (docs/decisions/0023-skill-radar.md).
 */
const OUTPUT_VERSION = 3;

/** SHA-256 as 64 lower-case hex characters: of a file's bytes, or of a string's UTF-8. */
export async function sha256Hex(data: Uint8Array | string): Promise<string> {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  const digest = await crypto.subtle.digest("SHA-256", bytes as Uint8Array<ArrayBuffer>);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Stable SHA-256 of normalised inputs, used to reuse output for identical requests. */
export async function hashInput(input: RoadmapInput): Promise<string> {
  const norm = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();
  const key = JSON.stringify([
    OUTPUT_VERSION,
    norm(input.targetRole),
    input.situation,
    norm(input.situationDetail),
    norm(input.education),
    norm(input.skills),
    norm(input.cvText),
  ]);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
