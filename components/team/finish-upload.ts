/**
 * Browser side of "the upload has landed": tells the server, which fingerprints the stored file
 * (app/api/files/[id]/complete). If the same file is on someone else's exhbt, it raises
 * MATCH_EVENT for <MatchPrompt>, which asks whether they worked on it together. Never throws and
 * never holds up the upload: a missed fingerprint only means no match is looked for.
 */

export const MATCH_EVENT = "exhbt:file-match";

export type MatchDetail = { matchId: string; fileName: string; name: string };

export async function finishUpload(fileId: string, fileName: string): Promise<void> {
  try {
    const res = await fetch(`/api/files/${fileId}/complete`, { method: "POST" });
    if (!res.ok) return;
    const data = (await res.json().catch(() => ({}))) as { match?: { id: string; name: string } | null };
    if (data.match) {
      const detail: MatchDetail = { matchId: data.match.id, fileName, name: data.match.name };
      window.dispatchEvent(new CustomEvent<MatchDetail>(MATCH_EVENT, { detail }));
    }
  } catch {
    // Offline or the server is busy: the file is stored; it just isn't checked.
  }
}
