"use server";

import { redirect } from "next/navigation";
import { z } from "zod/v4";
import { safeNext, sendMagicLink } from "@/lib/auth";

export type LoginState = { error?: string } | undefined;

export async function login(_prev: LoginState, form: FormData): Promise<LoginState> {
  const email = z.email().safeParse(String(form.get("email") ?? "").trim().toLowerCase());
  if (!email.success) return { error: "Enter a valid email address." };
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
