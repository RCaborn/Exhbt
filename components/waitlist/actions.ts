"use server";

import { z } from "zod/v4";
import { HOUR, rateLimited } from "@/lib/rate-limit";
import { getStore, type WaitlistInterest } from "@/lib/store";

export type WaitlistState = { ok?: boolean; error?: string } | undefined;

const WAITLIST_PER_IP_PER_HOUR = 10;

export async function joinWaitlist(_prev: WaitlistState, form: FormData): Promise<WaitlistState> {
  if (String(form.get("website") ?? "")) return { ok: true }; // honeypot: bots fill hidden fields
  if (await rateLimited("waitlist", WAITLIST_PER_IP_PER_HOUR, HOUR)) {
    return { error: "Too many attempts from this network. Try again in an hour." };
  }
  const email = z.email().safeParse(String(form.get("email") ?? "").trim().toLowerCase());
  if (!email.success) return { error: "Enter a valid email address." };
  const raw = String(form.get("interest") ?? "");
  const interest: WaitlistInterest = raw === "plus" || raw === "university" ? raw : "premium";
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
