import "server-only";
import { z } from "zod/v4";
import { sign, verify } from "./access";
import { siteOrigin, type SessionUser } from "./auth";
import { isDraftHelperFile } from "./draft-tools";
import { sendEmail } from "./email/send";
import { teamInviteEmail } from "./email/templates/team";
import type { Plan } from "./entitlements";
import { emptyDoc, wordCount } from "./exhbt/blocks";
import { signedFileUrl } from "./files";
import { sha256Hex } from "./hash";
import { canCreateExhbt, getPlan, limitsFor, visibleOnPortfolio } from "./plan";
import { portfolioHref } from "./portfolio-links";
import { getStore, type ExhbtRecord, type StoredFile, type TeamInvite } from "./store";
import { INVITE_DAYS, INVITES_PER_HOUR, TEAMMATES_PER_EXHBT, cleanRole, roleProblem, type Teammate } from "./team-rules";
import { copyStoredObject } from "./uploads";

/**
 * Teammates on an exhbt (docs/decisions/0013-teammates-and-duplicate-files.md).
 *
 * - The owner invites people by email with a short role. The link carries a signed token
 *   (lib/access.ts `sign`); the store keeps only its SHA-256, and the link stops working after
 *   INVITE_DAYS or when it is resent or cancelled.
 * - Accepting needs the person signed in (the usual magic link) with the address the invite
 *   went to. Accepted teammates show on the exhbt's public page and its portfolio tile.
 * - A teammate can make their own exhbt from the project: a new, empty draft that points at the
 *   original (team_of), with their own copies of its project files to draft from.
 *
 * Every rule is checked here, on the server. TEAMMATES_PER_EXHBT counts accepted teammates and
 * open invites together.
 */

export type TeamResult = { ok: true; message?: string } | { ok: false; reason: string; upgradeTo?: Plan };
export type { Teammate };

const NAME_MAX_CHARS = 80;
const DAY_MS = 86_400_000;
const refuse = (reason: string, upgradeTo?: Plan): TeamResult => ({ ok: false, reason, upgradeTo });
const expiry = () => new Date(Date.now() + INVITE_DAYS * DAY_MS).toISOString();

/** The name to show for a person: their profile name, else their username, else a plain word. */
export async function displayNameFor(userId: string, fallback = "Teammate"): Promise<string> {
  const p = await getStore().getPortfolioProfile(userId);
  return p.name?.trim() || p.username || fallback;
}

/** The title to show for an exhbt in the app: the live title if it's published, else the working one. */
export const titleOf = (e: ExhbtRecord) => (e.published?.title ?? e.doc.title).trim() || "Untitled exhbt";

/* ---------------- Invites ---------------- */

/** A new token for an invite: `sign("invite:<id>:<nonce>")`, and the hash the store keeps. */
async function newToken(inviteId: string): Promise<{ token: string; tokenHash: string }> {
  const nonce = Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString("base64url");
  const token = await sign(`invite:${inviteId}:${nonce}`);
  return { token, tokenHash: await sha256Hex(token) };
}

export type InviteView =
  | { state: "invalid" }
  | { state: "ok" | "expired" | "used" | "cancelled"; invite: TeamInvite; exhbt: ExhbtRecord; ownerName: string };

/** What an invite link points at, and whether it can still be used. Never trusts the token's id without its hash. */
export async function readInvite(token: string | undefined): Promise<InviteView> {
  const payload = await verify(token);
  if (!token || !payload?.startsWith("invite:")) return { state: "invalid" };
  const store = getStore();
  const invite = await store.getInvite(payload.split(":")[1] ?? "");
  if (!invite || invite.tokenHash !== (await sha256Hex(token))) return { state: "invalid" };
  const exhbt = await store.getExhbt(invite.exhbtId);
  if (!exhbt) return { state: "invalid" };
  const ownerName = await displayNameFor(exhbt.userId, "Someone");
  const state = invite.cancelledAt ? "cancelled" : invite.acceptedAt ? "used" : Date.parse(invite.expiresAt) < Date.now() ? "expired" : "ok";
  return { state, invite, exhbt, ownerName };
}

/** Teammates plus open invites: what TEAMMATES_PER_EXHBT counts. */
export async function slotsUsed(exhbtId: string): Promise<number> {
  const store = getStore();
  const [members, invites] = await Promise.all([store.listMembers(exhbtId), store.listInvites(exhbtId)]);
  return members.length + invites.length;
}

const fullReason = () =>
  `An exhbt can have ${TEAMMATES_PER_EXHBT} teammates, counting invites still open. Cancel an invite or remove someone first.`;

async function ownedExhbt(ownerId: string, exhbtId: string): Promise<ExhbtRecord | null> {
  const e = await getStore().getExhbt(exhbtId);
  return e && e.userId === ownerId ? e : null;
}

async function overInviteLimit(ownerId: string): Promise<boolean> {
  return (await getStore().countRecentEventsForUser("teammate_invited", ownerId, 1)) >= INVITES_PER_HOUR;
}

async function sendInvite(owner: SessionUser, exhbt: ExhbtRecord, email: string, role: string, token: string): Promise<boolean> {
  const origin = await siteOrigin();
  const ownerName = await displayNameFor(owner.id, owner.email);
  const content = teamInviteEmail({
    ownerName,
    title: titleOf(exhbt),
    role,
    acceptUrl: `${origin}/team/accept?token=${encodeURIComponent(token)}`,
    privacyUrl: `${origin}/legal/privacy`,
    logoUrl: `${origin}/brand/exhbt-mark.png`,
  });
  try {
    await sendEmail({ to: email, ...content });
    return true;
  } catch (e) {
    console.error("team invite email failed", (e as Error).message);
    return false;
  }
}

const NOT_SENT = "The invite is saved, but the email didn't go just now. Try Resend in a minute.";

/** Invites someone by email. Inviting an address that already has an open invite sends that one again. */
export async function inviteTeammate(owner: SessionUser, exhbtId: string, rawEmail: string, rawRole: string): Promise<TeamResult> {
  const store = getStore();
  const exhbt = await ownedExhbt(owner.id, exhbtId);
  if (!exhbt) return refuse("This exhbt isn't yours.");
  const parsed = z.email().safeParse(rawEmail.trim().toLowerCase());
  if (!parsed.success) return refuse("Enter a valid email address.");
  const email = parsed.data;
  const role = cleanRole(rawRole);
  const problem = roleProblem(role);
  if (problem) return refuse(problem);
  if (email === owner.email.toLowerCase()) return refuse("That's your own address. Invite the people you worked with.");
  if (await overInviteLimit(owner.id)) return refuse("You've sent a lot of invites in the last hour. Try again later.");

  const open = (await store.listInvites(exhbtId)).find((i) => i.email.toLowerCase() === email);
  if (open) {
    const res = await resendInvite(owner, exhbtId, open.id);
    return res.ok ? { ok: true, message: `${email} already had an invite, so we sent it again.` } : res;
  }
  for (const m of await store.listMembers(exhbtId)) {
    if ((await store.emailFor(m.userId))?.toLowerCase() === email) return refuse(`${email} is already on this exhbt.`);
  }
  if ((await slotsUsed(exhbtId)) >= TEAMMATES_PER_EXHBT) return refuse(fullReason());

  const id = crypto.randomUUID();
  const { token, tokenHash } = await newToken(id);
  await store.createInvite({ id, exhbtId, email, role, tokenHash, expiresAt: expiry() });
  // Two invites at once can both pass the count above: look again now this one exists.
  if ((await slotsUsed(exhbtId)) > TEAMMATES_PER_EXHBT) {
    await store.cancelInvite(id, exhbtId);
    return refuse(fullReason());
  }
  await store.logEvent("teammate_invited", owner.id, { exhbtId });
  if (!(await sendInvite(owner, exhbt, email, role, token))) return refuse(NOT_SENT);
  return { ok: true, message: `Invite sent to ${email}.` };
}

/** Sends an open invite again with a fresh link (the old one stops working) and a new expiry. */
export async function resendInvite(owner: SessionUser, exhbtId: string, inviteId: string): Promise<TeamResult> {
  const store = getStore();
  const exhbt = await ownedExhbt(owner.id, exhbtId);
  const invite = exhbt ? await store.getInvite(inviteId) : null;
  if (!exhbt || !invite || invite.exhbtId !== exhbtId || invite.acceptedAt || invite.cancelledAt) return refuse("That invite has gone.");
  if (await overInviteLimit(owner.id)) return refuse("You've sent a lot of invites in the last hour. Try again later.");
  const { token, tokenHash } = await newToken(invite.id);
  if (!(await store.renewInvite(invite.id, exhbtId, tokenHash, expiry()))) return refuse("That invite has gone.");
  await store.logEvent("teammate_invited", owner.id, { exhbtId, resent: true });
  if (!(await sendInvite(owner, exhbt, invite.email, invite.role, token))) return refuse(NOT_SENT);
  return { ok: true, message: `Invite sent to ${invite.email} again.` };
}

export async function cancelInvite(ownerId: string, exhbtId: string, inviteId: string): Promise<boolean> {
  if (!(await ownedExhbt(ownerId, exhbtId))) return false;
  return getStore().cancelInvite(inviteId, exhbtId);
}

/** Accepts an invite as the signed-in person, who must be signed in with the address it went to. */
export async function acceptInvite(user: SessionUser, token: string, rawName: string): Promise<TeamResult & { exhbtId?: string }> {
  const view = await readInvite(token);
  if (view.state === "invalid") return refuse("This invite link doesn't work. Ask whoever invited you to send it again.");
  if (view.state === "cancelled") return refuse("This invite was cancelled.");
  if (view.state === "expired") return refuse("This invite has expired. Ask whoever invited you to send it again.");
  const store = getStore();
  const members = await store.listMembers(view.exhbt.id);
  if (view.state === "used") {
    return members.some((m) => m.userId === user.id) ? { ok: true, exhbtId: view.exhbt.id } : refuse("This invite has already been used.");
  }
  if (view.invite.email.toLowerCase() !== user.email.toLowerCase()) return refuse("This invite was sent to a different email address.");
  if (view.exhbt.userId === user.id) return refuse("This is your own exhbt.");
  const name = rawName.replace(/\s+/g, " ").trim();
  if (!name) return refuse("Add your name, so it can show on the project.");
  if (name.length > NAME_MAX_CHARS) return refuse(`Keep your name to ${NAME_MAX_CHARS} characters.`);
  if (!members.some((m) => m.userId === user.id) && members.length >= TEAMMATES_PER_EXHBT) return refuse(fullReason());

  if (!(await store.markInviteAccepted(view.invite.id))) return refuse("This invite has already been used.");
  await store.addMember({ exhbtId: view.exhbt.id, userId: user.id, role: view.invite.role });
  const profile = await store.getPortfolioProfile(user.id);
  if (profile.name?.trim() !== name) await store.updatePortfolioProfile(user.id, { name });
  await store.logEvent("teammate_joined", user.id, { exhbtId: view.exhbt.id, via: "invite" });
  return { ok: true, exhbtId: view.exhbt.id };
}

/* ---------------- Membership ---------------- */

/** The owner takes someone off their exhbt. */
export async function removeTeammate(ownerId: string, exhbtId: string, memberId: string): Promise<boolean> {
  if (!(await ownedExhbt(ownerId, exhbtId))) return false;
  return getStore().removeMember(exhbtId, memberId);
}

/** A teammate takes themselves off someone's exhbt. Their own exhbt made from it stays theirs, without the link. */
export async function leaveTeam(userId: string, exhbtId: string): Promise<boolean> {
  return getStore().removeMember(exhbtId, userId);
}

export type MakeOwnResult = { ok: true; id: string; copied: number; skipped: number } | { ok: false; reason: string; upgradeTo?: Plan };

/** Kinds of file a teammate is given: what was uploaded for the project, never the profile photo or helper files. */
const SHARED_KINDS: StoredFile["kind"][] = ["source", "evidence", "image"];

/**
 * "Make my own exhbt from this project": a new, empty draft for the teammate, pointing at the
 * original (team_of). It copies nothing written. The original's uploaded project files are
 * copied into the teammate's own storage and attached to the new draft, so they can draft from
 * them, and so deleting the original (or the owner's account) never breaks theirs. Copies count
 * towards the teammate's storage; a file their plan couldn't hold is left out and counted.
 * The new exhbt counts against the teammate's own plan (canCreateExhbt).
 */
export async function makeOwnExhbt(userId: string, rootId: string): Promise<MakeOwnResult> {
  const store = getStore();
  const root = await store.getExhbt(rootId);
  if (!root || !(await store.listMembers(rootId)).some((m) => m.userId === userId)) return { ok: false, reason: "You're not on this project." };
  const existing = (await store.listTeamVersions(rootId)).find((e) => e.userId === userId);
  if (existing) return { ok: true, id: existing.id, copied: 0, skipped: 0 };

  const plan = await getPlan(userId);
  const room = canCreateExhbt(plan, await store.listExhbts(userId));
  if (!room.ok) return { ok: false, reason: room.reason, upgradeTo: room.upgradeTo };
  const id = await store.createExhbt(userId, emptyDoc(), { teamOf: rootId });
  // Two quick clicks can both pass the check above; look again now this one exists.
  const after = canCreateExhbt(await getPlan(userId), (await store.listExhbts(userId)).filter((e) => e.id !== id));
  if (!after.ok) {
    await store.deleteExhbt(id, userId);
    return { ok: false, reason: after.reason, upgradeTo: after.upgradeTo };
  }

  const caps = limitsFor(plan);
  const MB = 1024 * 1024;
  let used = await store.storageBytesUsed(userId);
  let copied = 0;
  let skipped = 0;
  const shared = (await store.listFiles(root.userId, rootId)).filter((f) => SHARED_KINDS.includes(f.kind) && !isDraftHelperFile(f));
  for (const f of shared) {
    if (f.bytes > caps.uploadMbPerFile * MB || used + f.bytes > caps.storageMbTotal * MB) {
      skipped++;
      continue;
    }
    const fileId = crypto.randomUUID();
    const path = `${userId}/${fileId}/${f.path.split("/").pop() ?? "file"}`;
    // The record first, so the storage total counts it (as uploads do); removed again if the copy fails.
    await store.createFile({ id: fileId, userId, bucket: f.bucket, path, mime: f.mime, bytes: f.bytes, kind: f.kind, sha256: f.sha256 ?? null, exhbtId: id });
    if (await copyStoredObject(f, path, fileId)) {
      used += f.bytes;
      copied++;
    } else {
      await store.deleteFile(fileId, userId);
      skipped++;
    }
  }
  await store.logEvent("teammate_joined", userId, { exhbtId: rootId, via: "own_exhbt", copied, skipped });
  return { ok: true, id, copied, skipped };
}

/* ---------------- Who shows on an exhbt ---------------- */

/** A person as a teammate: name, photo and a link to their portfolio if they have a public one. */
async function describe(userId: string, role: string, host: string | null | undefined): Promise<Teammate> {
  const store = getStore();
  const [profile, plan] = await Promise.all([store.getPortfolioProfile(userId), store.planFor(userId)]);
  const hasPortfolio = Boolean(profile.username) && visibleOnPortfolio(plan, await store.listExhbts(userId)).length > 0;
  return {
    userId,
    name: profile.name?.trim() || profile.username || "Teammate",
    role,
    photoUrl: await signedFileUrl(profile.photoFileId, userId),
    href: hasPortfolio ? portfolioHref(profile.username!, host) : null,
  };
}

/**
 * Everyone on an exhbt's team except its author, earliest first. For the original: its
 * teammates. For a teammate's own exhbt: the original's author and the other teammates, but only
 * while the author of this one is still on the team. Empty when it isn't a team project.
 */
export async function teamFor(e: Pick<ExhbtRecord, "id" | "userId" | "teamOf">, host?: string | null): Promise<Teammate[]> {
  const store = getStore();
  const root = e.teamOf ? await store.getExhbt(e.teamOf) : e;
  if (!root) return [];
  const members = await store.listMembers(root.id);
  if (e.teamOf && !members.some((m) => m.userId === e.userId)) return [];
  // A teammate's own exhbt can have teammates of its own too; each person shows once.
  const own = e.teamOf ? await store.listMembers(e.id) : [];
  const people = new Map<string, string>();
  if (root.userId !== e.userId) people.set(root.userId, "");
  for (const m of [...members, ...own]) if (m.userId !== e.userId && !people.has(m.userId)) people.set(m.userId, m.role);
  return Promise.all([...people].map(([userId, role]) => describe(userId, role, host)));
}

/** An exhbt's own accepted teammates, for its team page. */
export async function membersOf(exhbtId: string, host?: string | null): Promise<Teammate[]> {
  return Promise.all((await getStore().listMembers(exhbtId)).map((m) => describe(m.userId, m.role, host)));
}

/** A team project someone is on, for their list at /exhbts. */
export type Membership = {
  rootId: string;
  title: string;
  ownerName: string;
  role: string;
  /** Their own exhbt made from it, if they've made one. */
  ownId: string | null;
  /** The original's public page, if it's live. */
  liveHref: string | null;
};

export async function membershipsFor(userId: string, host?: string | null): Promise<Membership[]> {
  const store = getStore();
  const out: Membership[] = [];
  for (const m of await store.listMembershipsFor(userId)) {
    const root = await store.getExhbt(m.exhbtId);
    if (!root) continue;
    const [ownerProfile, ownerPlan, ownerExhbts, versions] = await Promise.all([
      store.getPortfolioProfile(root.userId),
      store.planFor(root.userId),
      store.listExhbts(root.userId),
      store.listTeamVersions(root.id),
    ]);
    const live = ownerProfile.username && visibleOnPortfolio(ownerPlan, ownerExhbts).some((x) => x.id === root.id) ? root.slug : null;
    out.push({
      rootId: root.id,
      title: titleOf(root),
      ownerName: ownerProfile.name?.trim() || ownerProfile.username || "Someone",
      role: m.role,
      ownId: versions.find((v) => v.userId === userId)?.id ?? null,
      liveHref: live ? `${portfolioHref(ownerProfile.username!, host)}/${live}` : null,
    });
  }
  return out;
}

/**
 * Whether an exhbt can be drafted into (app/api/exhbts/draft `into`): a teammate's own exhbt
 * made from a team project, while it's theirs, unpublished and still empty, so a draft never
 * writes over their words.
 */
export function canDraftInto(e: ExhbtRecord | null, userId: string): e is ExhbtRecord {
  return Boolean(e && e.userId === userId && e.teamOf && !e.published && e.status === "draft" && wordCount(e.doc) === 0);
}

/** The project files a teammate was given on their own exhbt, for "Draft from these files". */
export async function teamFilesFor(userId: string, exhbtId: string): Promise<StoredFile[]> {
  return (await getStore().listFiles(userId, exhbtId)).filter((f) => SHARED_KINDS.includes(f.kind) && !isDraftHelperFile(f));
}
