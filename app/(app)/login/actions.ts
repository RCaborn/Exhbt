"use server";

import { redirect } from "next/navigation";
import { z } from "zod/v4";
import { safeNext, sendMagicLink } from "@/lib/auth";
import { callerIpHash } from "@/lib/access";
import { getStore } from "@/lib/store";

/** Sign-in emails per connection per hour. Real people need one or two; this stops mail bombing. */
const PER_IP_PER_HOUR = (process.env.NODE_ENV !== "production" && Number(process.env.EXHBT_LOGINS_PER_HOUR)) || 5;

export type LoginState = { error?: string } | undefined;

export async function login(_prev: LoginState, form: FormData): Promise<LoginState> {
  const email = z.email().safeParse(String(form.get("email") ?? "").trim().toLowerCase());
  if (!email.success) return { error: "Enter a valid email address." };
  const next = safeNext(String(form.get("next") ?? ""));
  const store = getStore();
  const ipHash = await callerIpHash();
  if ((await store.countRecentEvents("login_link_sent", ipHash, 1)) >= PER_IP_PER_HOUR) {
    return { error: "Too many sign-in emails from this connection. Please try again in an hour." };
  }
  let devLink: string | undefined;
  try {
    ({ devLink } = await sendMagicLink(email.data, next));
    await store.logEvent("login_link_sent", null, { ipHash });
  } catch (e) {
    console.error("sign-in email failed", (e as Error).message);
    return { error: "We could not send the email just now. Please try again in a minute." };
  }
  const q = new URLSearchParams({ email: email.data });
  if (devLink) q.set("dev", devLink);
  redirect(`/check-email?${q}`);
}
