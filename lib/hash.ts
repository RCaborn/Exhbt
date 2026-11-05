import type { RoadmapInput } from "./ai/schemas";

/** Stable SHA-256 of normalised inputs, used to reuse output for identical requests. */
export async function hashInput(input: RoadmapInput): Promise<string> {
  const norm = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();
  const key = JSON.stringify([norm(input.cvText), norm(input.skills), norm(input.targetRole), norm(input.ambitions)]);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
