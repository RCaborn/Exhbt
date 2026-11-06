"use server";

import { z } from "zod/v4";
import { getStore, type WaitlistInterest } from "@/lib/store";

export type WaitlistState = { ok?: boolean; error?: string } | undefined;

export async function joinWaitlist(_prev: WaitlistState, form: FormData): Promise<WaitlistState> {
  if (String(form.get("website") ?? "")) return { ok: true }; // honeypot: bots fill hidden fields
  const email = z.email().safeParse(String(form.get("email") ?? "").trim().toLowerCase());
  if (!email.success) return { error: "Enter a valid email address." };
  const interest: WaitlistInterest = form.get("interest") === "university" ? "university" : "premium";
  const source = String(form.get("source") ?? "site").slice(0, 40);
  try {
    const store = getStore();
    await store.joinWaitlist({ email: email.data, interest, source });
    await store.logEvent("waitlist_joined", null, { interest, source });
  } catch {
    return { error: "Something went wrong. Please try again in a minute." };
  }
  return { ok: true };
}
