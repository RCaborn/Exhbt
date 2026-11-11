"use server";

import { redirect } from "next/navigation";
import { z } from "zod/v4";
import { safeNext, sendMagicLink } from "@/lib/auth";
import { HOUR, rateLimited } from "@/lib/rate-limit";

export type LoginState = { error?: string } | undefined;

const LOGIN_PER_IP_PER_HOUR = 5;
const LOGIN_PER_EMAIL_PER_HOUR = 3;

export async function login(_prev: LoginState, form: FormData): Promise<LoginState> {
  const email = z.email().safeParse(String(form.get("email") ?? "").trim().toLowerCase());
  if (!email.success) return { error: "Enter a valid email address." };
  if (await rateLimited("login-ip", LOGIN_PER_IP_PER_HOUR, HOUR)) {
    return { error: "Too many sign-in emails from this network. Try again in an hour." };
  }
  if (await rateLimited("login-email", LOGIN_PER_EMAIL_PER_HOUR, HOUR, email.data)) {
    return { error: "Too many sign-in emails to that address. Try again in an hour." };
  }
  const next = safeNext(String(form.get("next") ?? ""));
  let devLink: string | undefined;
  try {
    ({ devLink } = await sendMagicLink(email.data, next));
  } catch {
    return { error: "We could not send the email just now. Please try again in a minute." };
  }
  const q = new URLSearchParams({ email: email.data });
  if (devLink) q.set("dev", devLink);
  redirect(`/check-email?${q}`);
}
