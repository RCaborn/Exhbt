import "server-only";
import { z } from "zod/v4";
import { getCurrentUser, signInLinkFor, siteOrigin, supabaseServer } from "./auth";
import {
  consumeDevReset,
  devPassword,
  hashPassword,
  issueDevReset,
  passwordMatches,
  passwordProblem,
  peekDevReset,
  setDevPassword,
} from "./passwords";
import { getStore, isSupabaseConfigured } from "./store";

const MISMATCH = "Those details don't match.";
const EXISTS =
  "An account with that email already exists. Log in, or set a password if you have only used a sign-in link.";
const LATER = "We could not finish that just now. Please try again in a minute.";

/** Password hashes in memory are for local development and tests. Production uses Supabase. */
function devPasswordsAllowed() {
  return !isSupabaseConfigured() && process.env.NODE_ENV !== "production";
}

type Ok = { ok: true; devLogin?: string };
type Created = { ok: true; pending: boolean; devLogin?: string };
type Fail = { ok: false; error: string };

async function sendAccountEmail(kind: "confirm" | "reset", email: string, url: string): Promise<void> {
  const origin = await siteOrigin();
  const { sendEmail } = await import("./email/send");
  const { accountEmail } = await import("./email/templates/account");
  const content = accountEmail({
    kind,
    url,
    privacyUrl: `${origin}/legal/privacy`,
    logoUrl: `${origin}/brand/exhbt-mark.png`,
  });
  await sendEmail({ to: email, ...content });
}

/** One email to prove the address. The password is already stored; the link only confirms it. */
async function sendConfirmLink(email: string, next: string): Promise<Ok | Fail> {
  try {
    await sendAccountEmail("confirm", email, await signInLinkFor(email, next, "signup"));
    return { ok: true };
  } catch (e) {
    console.error("confirm email failed", (e as Error).message);
    return { ok: false, error: LATER };
  }
}

/**
 * Creates an account with a password.
 * With Supabase, the address is confirmed by one email before the password will sign them in.
 * Without it (local development and tests), they're signed in straight away.
 */
export async function createAccount(
  email: string,
  password: string,
  next: string,
): Promise<Created | Fail> {
  const problem = passwordProblem(password, email);
  if (problem) return { ok: false, error: problem };

  if (!isSupabaseConfigured()) {
    if (process.env.NODE_ENV === "production") return { ok: false, error: LATER };
    if (devPassword(email)) return { ok: false, error: EXISTS };
    setDevPassword(email, await hashPassword(password));
    await getStore().claimPendingRoadmaps(email, `dev-${email}`);
    await getStore().logEvent("signup_completed", `dev-${email}`, { via: "password" });
    // The session cookie is set by /auth/dev. Setting it inside this action does not survive the next page.
    return { ok: true, pending: false, devLogin: email };
  }

  const { supabaseAdmin } = await import("./store");
  const admin = supabaseAdmin().auth.admin;
  const created = await admin.createUser({ email, password, email_confirm: false });
  if (!created.error) {
    const sent = await sendConfirmLink(email, next);
    if (!sent.ok) return sent;
    return { ok: true, pending: true };
  }
  if (!/already|registered|exists/i.test(created.error.message)) {
    if (/password/i.test(created.error.message)) return { ok: false, error: "Choose a password of at least 8 characters." };
    console.error("create account failed", created.error.message);
    return { ok: false, error: LATER };
  }

  // The address is already an account. Sign in if this is the right password.
  // If the address was never confirmed, send the link again and leave the password as it was.
  const sb = await supabaseServer();
  const signed = await sb.auth.signInWithPassword({ email, password });
  if (!signed.error && signed.data.user?.email) {
    await getStore().claimPendingRoadmaps(signed.data.user.email, signed.data.user.id);
    return { ok: true, pending: false };
  }
  if (signed.error && /not confirmed/i.test(signed.error.message)) {
    const sent = await sendConfirmLink(email, next);
    if (!sent.ok) return sent;
    return { ok: true, pending: true };
  }
  return { ok: false, error: EXISTS };
}

/** Email or username, then the password. One failure message for a bad email, an unknown name, or a wrong password. */
export async function signInWithIdentifier(raw: string, password: string): Promise<Ok | Fail> {
  const s = raw.trim().toLowerCase();
  let email = s;
  if (s.includes("@")) {
    const parsed = z.email().safeParse(s);
    if (!parsed.success) return { ok: false, error: "Enter a valid email address, or your username." };
    email = parsed.data;
  } else {
    const found = await getStore().loginEmailForUsername(s);
    if (!found) return { ok: false, error: MISMATCH };
    email = found;
  }
  if (password.length < 8 || new TextEncoder().encode(password).length > 72) return { ok: false, error: MISMATCH };

  if (!isSupabaseConfigured()) {
    if (process.env.NODE_ENV === "production") return { ok: false, error: MISMATCH };
    if (!(await passwordMatches(password, devPassword(email)))) return { ok: false, error: MISMATCH };
    await getStore().claimPendingRoadmaps(email, `dev-${email}`);
    return { ok: true, devLogin: email };
  }

  const sb = await supabaseServer();
  const { error, data } = await sb.auth.signInWithPassword({ email, password });
  if (error || !data.user?.email) return { ok: false, error: MISMATCH };
  await getStore().claimPendingRoadmaps(data.user.email, data.user.id);
  return { ok: true };
}

/**
 * Emails a one-time link to choose a password. An address with no account gets the same
 * outcome as one that has one, so the page doesn't say which is which.
 * Development returns a link instead of sending mail.
 */
export async function sendPasswordReset(email: string): Promise<{ ok: true; devLink?: string } | Fail> {
  if (devPasswordsAllowed()) {
    return { ok: true, devLink: `/login/password?token=${issueDevReset(email)}` };
  }
  if (!isSupabaseConfigured()) return { ok: false, error: LATER };
  try {
    const { supabaseAdmin } = await import("./store");
    const res = await supabaseAdmin().auth.admin.generateLink({ type: "recovery", email });
    const props = res.data?.properties;
    if (res.error || !props?.hashed_token) {
      console.error("password reset not sent", res.error?.message ?? "no token");
      if ((res.error?.status ?? 0) >= 500) return { ok: false, error: LATER };
      return { ok: true };
    }
    const origin = await siteOrigin();
    const type = props.verification_type ?? "recovery";
    const url = `${origin}/auth/confirm?token_hash=${encodeURIComponent(props.hashed_token)}&type=${encodeURIComponent(type)}&next=${encodeURIComponent("/login/password")}&via=password`;
    await sendAccountEmail("reset", email, url);
    return { ok: true };
  } catch (e) {
    console.error("password reset failed", (e as Error).message);
    return { ok: false, error: LATER };
  }
}

/**
 * Sets the password on the signed-in account, or (development only) on the account
 * named by a reset token. Then the password is what they log in with.
 */
export async function saveNewPassword(password: string, token?: string | null): Promise<Ok | Fail> {
  const problem = passwordProblem(password);
  if (problem) return { ok: false, error: problem };

  if (!isSupabaseConfigured()) {
    if (process.env.NODE_ENV === "production") return { ok: false, error: LATER };
    const fromToken = token ? peekDevReset(token) : null;
    const email = fromToken ?? (await getCurrentUser())?.email ?? null;
    if (!email) {
      return {
        ok: false,
        error: token ? "That link has expired. Ask for another one." : "Open the link from your email, then choose a password.",
      };
    }
    setDevPassword(email, await hashPassword(password));
    if (token && fromToken) consumeDevReset(token);
    await getStore().claimPendingRoadmaps(email, `dev-${email}`);
    return { ok: true, devLogin: email };
  }

  const sb = await supabaseServer();
  const { data } = await sb.auth.getUser();
  if (!data.user?.email) return { ok: false, error: "Open the link from your email, then choose a password." };
  const { error } = await sb.auth.updateUser({ password });
  if (error) {
    console.error("update password failed", error.message);
    return { ok: false, error: "We could not save that password. Please try again." };
  }
  // The recovery session can be dropped when the password changes. Sign in with the new one.
  const signed = await sb.auth.signInWithPassword({ email: data.user.email, password });
  if (signed.error) console.error("sign in after password change failed", signed.error.message);
  return { ok: true };
}
