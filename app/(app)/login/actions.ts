"use server";

import { redirect } from "next/navigation";
import { z } from "zod/v4";
import { callerIpHash } from "@/lib/access";
import { safeNext } from "@/lib/auth";
import { createAccount, saveNewPassword, sendPasswordReset, signInWithIdentifier } from "@/lib/password-auth";
import { loginIdentifierProblem, passwordProblem } from "@/lib/passwords";
import { getStore, type EventName } from "@/lib/store";

/**
 * Attempts per connection per hour. Real people mistype; this slows guessing.
 * Tests raise EXHBT_LOGINS_PER_HOUR. Production ignores that override.
 */
const ATTEMPTS_PER_HOUR = (process.env.NODE_ENV !== "production" && Number(process.env.EXHBT_LOGINS_PER_HOUR)) || 20;
/** Confirmation and password-reset emails. Lower, because each one lands in an inbox. */
const EMAILS_PER_HOUR = (process.env.NODE_ENV !== "production" && Number(process.env.EXHBT_LOGINS_PER_HOUR)) || 5;

const LATER = "We could not finish that just now. Please try again in a minute.";

/** Development sign-in is a route, so the cookie is set on a normal response and kept. */
function devLoginUrl(email: string, next: string) {
  return `/auth/dev?email=${encodeURIComponent(email)}&next=${encodeURIComponent(next)}`;
}

export type FormState = { error?: string; continueTo?: string } | undefined;

async function tooMany(name: EventName, cap: number, message: string): Promise<string | null> {
  const ipHash = await callerIpHash();
  const store = getStore();
  if ((await store.countRecentEvents(name, ipHash, 1)) >= cap) return message;
  await store.logEvent(name, null, { ipHash });
  return null;
}

export async function login(_prev: FormState, form: FormData): Promise<FormState> {
  const identifier = String(form.get("identifier") ?? "");
  const shape = loginIdentifierProblem(identifier);
  if (shape) return { error: shape };
  const password = String(form.get("password") ?? "");
  if (!password) return { error: "Enter your password." };
  const blocked = await tooMany("login_attempt", ATTEMPTS_PER_HOUR, "Too many attempts from this connection. Please try again in an hour.");
  if (blocked) return { error: blocked };
  const next = safeNext(String(form.get("next") ?? ""));
  let devLogin: string | undefined;
  try {
    const result = await signInWithIdentifier(identifier, password);
    if (!result.ok) return { error: result.error };
    devLogin = result.devLogin;
  } catch (e) {
    console.error("sign in failed", (e as Error).message);
    return { error: LATER };
  }
  return { continueTo: devLogin ? devLoginUrl(devLogin, next) : next };
}

export async function signup(_prev: FormState, form: FormData): Promise<FormState> {
  const email = z.email().safeParse(String(form.get("email") ?? "").trim().toLowerCase());
  if (!email.success) return { error: "Enter a valid email address." };
  const password = String(form.get("password") ?? "");
  const confirm = String(form.get("confirm") ?? "");
  if (password !== confirm) return { error: "Those passwords don't match." };
  const problem = passwordProblem(password, email.data);
  if (problem) return { error: problem };
  const blocked = await tooMany("login_attempt", ATTEMPTS_PER_HOUR, "Too many attempts from this connection. Please try again in an hour.");
  if (blocked) return { error: blocked };
  const next = safeNext(String(form.get("next") ?? ""), "/account");
  let pending = false;
  let devLogin: string | undefined;
  try {
    const result = await createAccount(email.data, password, next);
    if (!result.ok) return { error: result.error };
    pending = result.pending;
    devLogin = result.devLogin;
  } catch (e) {
    console.error("create account failed", (e as Error).message);
    return { error: LATER };
  }
  if (pending) redirect(`/check-email?${new URLSearchParams({ email: email.data, kind: "confirm" })}`);
  return { continueTo: devLogin ? devLoginUrl(devLogin, next) : next };
}

export async function requestReset(_prev: FormState, form: FormData): Promise<FormState> {
  const email = z.email().safeParse(String(form.get("email") ?? "").trim().toLowerCase());
  if (!email.success) return { error: "Enter a valid email address." };
  const blocked = await tooMany("login_link_sent", EMAILS_PER_HOUR, "Too many emails from this connection. Please try again in an hour.");
  if (blocked) return { error: blocked };
  let devLink: string | undefined;
  try {
    const result = await sendPasswordReset(email.data);
    if (!result.ok) return { error: result.error };
    devLink = result.devLink;
  } catch (e) {
    console.error("password reset failed", (e as Error).message);
    return { error: LATER };
  }
  const q = new URLSearchParams({ sent: "1" });
  if (devLink) q.set("dev", devLink);
  redirect(`/login/reset?${q}`);
}

export async function savePassword(_prev: FormState, form: FormData): Promise<FormState> {
  const password = String(form.get("password") ?? "");
  const confirm = String(form.get("confirm") ?? "");
  if (password !== confirm) return { error: "Those passwords don't match." };
  const blocked = await tooMany("login_attempt", ATTEMPTS_PER_HOUR, "Too many attempts from this connection. Please try again in an hour.");
  if (blocked) return { error: blocked };
  const token = String(form.get("token") ?? "") || null;
  let devLogin: string | undefined;
  try {
    const result = await saveNewPassword(password, token);
    if (!result.ok) return { error: result.error };
    devLogin = result.devLogin;
  } catch (e) {
    console.error("save password failed", (e as Error).message);
    return { error: LATER };
  }
  if (devLogin) return { continueTo: devLoginUrl(devLogin, "/account") };
  return { continueTo: "/account" };
}
