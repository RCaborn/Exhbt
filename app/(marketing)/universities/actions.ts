"use server";

import { z } from "zod/v4";
import { getStore } from "@/lib/store";

export type LeadState = { ok?: boolean; error?: string; fieldErrors?: Record<string, string> } | undefined;

const Lead = z.object({
  name: z.string().trim().min(1, "Enter your name.").max(200),
  email: z.email("Enter a valid email address."),
  institution: z.string().trim().min(2, "Enter your institution.").max(200),
  message: z.string().trim().max(2000).default(""),
});

export async function submitLead(_prev: LeadState, form: FormData): Promise<LeadState> {
  if (String(form.get("website") ?? "")) return { ok: true }; // bot: pretend success
  const parsed = Lead.safeParse({
    name: form.get("name"),
    email: String(form.get("email") ?? "").trim().toLowerCase(),
    institution: form.get("institution"),
    message: form.get("message") ?? "",
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[String(i.path[0])] ??= i.message;
    return { fieldErrors };
  }
  try {
    const store = getStore();
    await store.createLead(parsed.data);
    await store.logEvent("lead_submitted", null, { institution: parsed.data.institution });
  } catch {
    return { error: "Something went wrong. Email us at hello@exhbt.co.uk instead." };
  }
  return { ok: true };
}
