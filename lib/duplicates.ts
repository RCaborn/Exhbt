import "server-only";
import { siteOrigin, type SessionUser } from "./auth";
import { sendEmail } from "./email/send";
import { joinApprovedEmail, joinRequestEmail } from "./email/templates/team";
import { sha256Hex } from "./hash";
import { getStore, type StoredFile } from "./store";
import { displayNameFor, slotsUsed, titleOf, type TeamResult } from "./team";
import { TEAMMATES_PER_EXHBT, cleanRole, roleProblem } from "./team-rules";
import { deleteFile, readStoredObject } from "./uploads";

/**
 * Private matching of identical files (docs/decisions/0013-teammates-and-duplicate-files.md).
 *
 * Every upload's SHA-256 is worked out here, on the server, from the stored bytes once the
 * browser says the upload has finished. If the same fingerprint is on a file attached to another
 * account's exhbt, and the two people aren't already on that project together, the uploader is
 * asked whether they worked on it together. They never learn whose exhbt it is unless its owner
 * adds them. Every match is kept in duplicate_matches for an admin to review; nothing about a
 * match is ever shown on a public page.
 *
 * An exact hash catches identical files only: one changed byte, a re-saved PDF or a screenshot
 * of the same chart gives a different fingerprint. It is a nudge to connect teammates, not an
 * originality check (that is still "coming soon").
 */

/** Kinds of upload that are matched. Profile photos are fingerprinted but never matched. */
const MATCHED_KINDS: StoredFile["kind"][] = ["source", "evidence", "image"];

export type CompleteResult =
  | { ok: true; match: { id: string; name: string } | null }
  | { ok: false; status: number; reason: string };

/**
 * The browser has finished putting the bytes in Storage: fingerprint them and look for a match.
 * Safe to call twice (the second call does nothing). `match.name` is the uploader's own profile
 * name, so the prompt can ask for one when it's missing.
 */
export async function completeUpload(userId: string, fileId: string): Promise<CompleteResult> {
  const store = getStore();
  const file = await store.getFile(fileId);
  if (!file || file.userId !== userId) return { ok: false, status: 404, reason: "File not found." };
  if (file.sha256) return { ok: true, match: null };
  const bytes = await readStoredObject(file);
  if (!bytes) return { ok: false, status: 409, reason: "That upload hasn't finished." };
  // The record was made for the size the browser declared, which the plan's caps were checked against.
  if (bytes.length > file.bytes) {
    await deleteFile(userId, fileId);
    return { ok: false, status: 413, reason: "That file was bigger than the upload said. Upload it again." };
  }
  const sha256 = await sha256Hex(bytes);
  await store.setFileHash(fileId, userId, sha256);
  if (!MATCHED_KINDS.includes(file.kind)) return { ok: true, match: null };
  const matchId = await findMatch(userId, file, sha256);
  if (!matchId) return { ok: true, match: null };
  return { ok: true, match: { id: matchId, name: (await store.getPortfolioProfile(userId)).name?.trim() ?? "" } };
}

/**
 * Whether this person is already on the project an exhbt belongs to: they wrote the original or
 * their own version of it, or they're a teammate on any of those.
 */
export async function onSameTeam(userId: string, exhbtId: string): Promise<boolean> {
  const store = getStore();
  const e = await store.getExhbt(exhbtId);
  if (!e) return false;
  const root = e.teamOf ? await store.getExhbt(e.teamOf) : e;
  const family = [...(root ? [root] : []), ...(root ? await store.listTeamVersions(root.id) : []), e];
  if (family.some((x) => x.userId === userId)) return true;
  for (const x of family) if ((await store.listMembers(x.id)).some((m) => m.userId === userId)) return true;
  return false;
}

/**
 * Logs a match against the oldest file with this fingerprint on someone else's exhbt, and returns
 * its id if the uploader should be asked. A repeat (the same uploader and exhbt again, after
 * they or the owner have answered) is logged as "repeat" and asks nothing.
 */
async function findMatch(userId: string, file: StoredFile, sha256: string): Promise<string | null> {
  const store = getStore();
  const checked = new Set<string>();
  for (const c of await store.findFilesByHash(sha256, userId)) {
    if (checked.has(c.exhbtId)) continue;
    checked.add(c.exhbtId);
    if (await onSameTeam(userId, c.exhbtId)) continue;
    const last = await store.latestDuplicateMatch(userId, c.exhbtId);
    const repeat = Boolean(last && last.outcome !== "shown");
    const id = await store.createDuplicateMatch({
      sha256,
      uploaderId: userId,
      uploaderFileId: file.id,
      ownerId: c.file.userId,
      ownerFileId: c.file.id,
      ownerExhbtId: c.exhbtId,
      outcome: repeat ? "repeat" : "shown",
    });
    await store.logEvent("file_matched", userId, { repeat });
    return repeat ? null : id;
  }
  return null;
}

/**
 * "Ask to join": tells the owner, by email and on their exhbts page, who is asking and what they
 * say they did. The uploader still sees nothing about the owner. `name` is saved to the
 * uploader's profile if it has none, so the owner sees a name.
 */
export async function askToJoin(user: SessionUser, matchId: string, rawName: string, rawRole: string): Promise<TeamResult> {
  const store = getStore();
  const match = await store.getDuplicateMatch(matchId);
  if (!match || match.uploaderId !== user.id) return { ok: false, reason: "That request has gone. Upload the file again to start over." };
  if (match.outcome !== "shown") return { ok: true };
  if (!match.ownerExhbtId) return { ok: false, reason: "That project has been taken down, so there's nobody to ask." };
  const role = cleanRole(rawRole);
  const problem = roleProblem(role);
  if (problem) return { ok: false, reason: problem };
  const profile = await store.getPortfolioProfile(user.id);
  const name = profile.name?.trim() || rawName.replace(/\s+/g, " ").trim().slice(0, 80);
  if (!name) return { ok: false, reason: "Add your name, so the owner knows who's asking." };
  if (!profile.name?.trim()) await store.updatePortfolioProfile(user.id, { name });
  if (!(await store.updateDuplicateMatch(matchId, "shown", "asked", role || null))) return { ok: true };

  const [exhbt, ownerEmail, origin] = await Promise.all([store.getExhbt(match.ownerExhbtId), store.emailFor(match.ownerId), siteOrigin()]);
  if (exhbt && ownerEmail) {
    const content = joinRequestEmail({
      requesterName: name,
      requesterEmail: user.email,
      role: role || null,
      title: titleOf(exhbt),
      reviewUrl: `${origin}/exhbts/${exhbt.id}/team`,
      privacyUrl: `${origin}/legal/privacy`,
      logoUrl: `${origin}/brand/exhbt-mark.png`,
    });
    // The request also waits on the owner's exhbts page, so a failed email doesn't lose it.
    await sendEmail({ to: ownerEmail, ...content }).catch((e: Error) => console.error("join request email failed", e.message));
  }
  return { ok: true };
}

/** "No, it's mine": logged for review, nothing else happens. */
export async function markMine(user: SessionUser, matchId: string): Promise<TeamResult> {
  const store = getStore();
  const match = await store.getDuplicateMatch(matchId);
  if (!match || match.uploaderId !== user.id) return { ok: false, reason: "That request has gone." };
  await store.updateDuplicateMatch(matchId, "shown", "mine");
  return { ok: true };
}

/** The owner's answer to a request to join. Yes adds the uploader as a teammate and tells them; no changes nothing. */
export async function decideJoinRequest(ownerId: string, matchId: string, approve: boolean): Promise<TeamResult> {
  const store = getStore();
  const match = await store.getDuplicateMatch(matchId);
  if (!match || match.ownerId !== ownerId || match.outcome !== "asked") return { ok: false, reason: "That request has already been answered." };
  if (!approve) {
    await store.updateDuplicateMatch(matchId, "asked", "declined");
    return { ok: true, message: "Declined. Nothing changes on your exhbt." };
  }
  const exhbt = match.ownerExhbtId ? await store.getExhbt(match.ownerExhbtId) : null;
  if (!exhbt || exhbt.userId !== ownerId) return { ok: false, reason: "That exhbt has gone." };
  if ((await slotsUsed(exhbt.id)) >= TEAMMATES_PER_EXHBT) {
    return { ok: false, reason: `An exhbt can have ${TEAMMATES_PER_EXHBT} teammates, counting invites still open. Remove someone first.` };
  }
  if (!(await store.updateDuplicateMatch(matchId, "asked", "approved"))) return { ok: false, reason: "That request has already been answered." };
  await store.addMember({ exhbtId: exhbt.id, userId: match.uploaderId, role: match.role ?? "" });
  await store.logEvent("teammate_joined", match.uploaderId, { exhbtId: exhbt.id, via: "match" });

  const [to, origin, ownerName] = await Promise.all([store.emailFor(match.uploaderId), siteOrigin(), displayNameFor(ownerId, "The owner")]);
  if (to) {
    const content = joinApprovedEmail({
      ownerName,
      title: titleOf(exhbt),
      url: `${origin}/exhbts#team-projects`,
      privacyUrl: `${origin}/legal/privacy`,
      logoUrl: `${origin}/brand/exhbt-mark.png`,
    });
    await sendEmail({ to, ...content }).catch((e: Error) => console.error("join approved email failed", e.message));
  }
  return { ok: true, message: "Added. They'll get an email to say so." };
}

/** A request to join, as the owner sees it: who is asking, about which exhbt, and what they say they did. */
export type JoinRequest = { id: string; exhbtId: string; title: string; name: string; email: string | null; role: string | null };

export async function joinRequestsFor(ownerId: string, exhbtId?: string): Promise<JoinRequest[]> {
  const store = getStore();
  const out: JoinRequest[] = [];
  for (const m of await store.listJoinRequests(ownerId, exhbtId)) {
    const exhbt = m.ownerExhbtId ? await store.getExhbt(m.ownerExhbtId) : null;
    if (!exhbt) continue;
    out.push({
      id: m.id,
      exhbtId: exhbt.id,
      title: titleOf(exhbt),
      name: await displayNameFor(m.uploaderId, "Someone"),
      email: await store.emailFor(m.uploaderId),
      role: m.role,
    });
  }
  return out;
}
