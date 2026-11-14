"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { askToJoin, decideJoinRequest, markMine } from "@/lib/duplicates";
import { isPhase2Enabled } from "@/lib/site";
import { acceptInvite, cancelInvite, inviteTeammate, leaveTeam, makeOwnExhbt, removeTeammate, resendInvite } from "@/lib/team";

/**
 * Every team action (decision 0013): invites, accepting, removing and leaving, a teammate's own
 * exhbt, and the answers to a file match. The rules are in lib/team.ts and lib/duplicates.ts,
 * checked on the server; these only read the form and say what happened.
 */

async function signedIn(next: string) {
  if (!isPhase2Enabled()) notFound();
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  return user;
}

const teamPage = (exhbtId: string) => `/exhbts/${exhbtId}/team`;

export type FormState = { ok?: boolean; message?: string; error?: string } | undefined;

/* ---------------- The owner's team page ---------------- */

export async function inviteAction(exhbtId: string, _prev: FormState, form: FormData): Promise<FormState> {
  const user = await signedIn(teamPage(exhbtId));
  const res = await inviteTeammate(user, exhbtId, String(form.get("email") ?? ""), String(form.get("role") ?? ""));
  revalidatePath(teamPage(exhbtId));
  return res.ok ? { ok: true, message: res.message } : { error: res.reason };
}

/** The team page reads `?said=` to show what happened, as a status line. */
const back = (exhbtId: string, said: string) => redirect(`${teamPage(exhbtId)}?said=${said}`);

export async function resendInviteAction(exhbtId: string, inviteId: string) {
  const user = await signedIn(teamPage(exhbtId));
  const res = await resendInvite(user, exhbtId, inviteId);
  back(exhbtId, res.ok ? "resent" : "not-sent");
}

export async function cancelInviteAction(exhbtId: string, inviteId: string) {
  const user = await signedIn(teamPage(exhbtId));
  await cancelInvite(user.id, exhbtId, inviteId);
  back(exhbtId, "cancelled");
}

export async function removeTeammateAction(exhbtId: string, memberId: string) {
  const user = await signedIn(teamPage(exhbtId));
  await removeTeammate(user.id, exhbtId, memberId);
  back(exhbtId, "removed");
}

export async function decideAction(exhbtId: string, matchId: string, approve: boolean) {
  const user = await signedIn(teamPage(exhbtId));
  const res = await decideJoinRequest(user.id, matchId, approve);
  revalidatePath("/exhbts");
  back(exhbtId, !res.ok ? "full" : approve ? "approved" : "declined");
}

/* ---------------- Accepting an invite ---------------- */

export async function acceptAction(token: string, _prev: FormState, form: FormData): Promise<FormState> {
  const user = await signedIn(`/team/accept?token=${encodeURIComponent(token)}`);
  const res = await acceptInvite(user, token, String(form.get("name") ?? ""));
  if (!res.ok) return { error: res.reason };
  revalidatePath("/exhbts");
  redirect("/exhbts?joined=1#team-projects");
}

/* ---------------- A teammate's side ---------------- */

export async function leaveAction(exhbtId: string) {
  const user = await signedIn("/exhbts");
  await leaveTeam(user.id, exhbtId);
  revalidatePath("/exhbts");
  redirect("/exhbts?left=1#team-projects");
}

export async function makeOwnAction(rootId: string) {
  const user = await signedIn("/exhbts");
  const res = await makeOwnExhbt(user.id, rootId);
  // Refused: the list shows the plan's reason and the upgrade offer beside the project.
  if (!res.ok) redirect(`/exhbts?full=1#team-projects`);
  redirect(`/exhbts/${res.id}/edit${res.skipped ? `?skipped=${res.skipped}` : ""}`);
}

/* ---------------- Answering a file match (MatchPrompt) ---------------- */

export async function askToJoinAction(matchId: string, name: string, role: string): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user || !isPhase2Enabled()) return { error: "Sign in again to answer." };
  const res = await askToJoin(user, matchId, name, role);
  return res.ok ? { ok: true } : { error: res.reason };
}

export async function notTogetherAction(matchId: string): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user || !isPhase2Enabled()) return { error: "Sign in again to answer." };
  const res = await markMine(user, matchId);
  return res.ok ? { ok: true } : { error: res.reason };
}
