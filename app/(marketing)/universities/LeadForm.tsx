"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { submitLead, type LeadState } from "./actions";
import { Button } from "@/components/ui/Button";

export function LeadForm() {
  const [state, action] = useActionState<LeadState, FormData>(submitLead, undefined);
  if (state?.ok) {
    return (
      <p role="status" className="rounded border border-line bg-surface px-5 py-4">
        Thanks. We will be in touch within two working days.
      </p>
    );
  }
  const err = state?.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-6" noValidate>
      {/* Honeypot: hidden from people, filled in by bots. */}
      <div aria-hidden className="absolute left-[-9999px]">
        <label>Leave this empty<input name="website" tabIndex={-1} autoComplete="off" /></label>
      </div>
      <Field id="name" label="Your name" error={err.name} autoComplete="name" />
      <Field id="email" label="Work email" type="email" error={err.email} autoComplete="email" />
      <Field id="institution" label="University or college" error={err.institution} autoComplete="organization" />
      <div>
        <label htmlFor="message" className="label">
          Anything we should know <span className="font-normal text-graphite">(optional)</span>
        </label>
        <textarea id="message" name="message" rows={4} maxLength={2000} className="field" placeholder="Cohort size, timing, questions" />
      </div>
      {state?.error && <p role="alert" className="text-error">{state.error}</p>}
      <Submit />
    </form>
  );
}

function Field({
  id,
  label,
  type = "text",
  error,
  autoComplete,
}: {
  id: string;
  label: string;
  type?: string;
  error?: string;
  autoComplete?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="label">{label}</label>
      <input id={id} name={id} type={type} required maxLength={200} autoComplete={autoComplete} aria-describedby={`${id}-error`} className="field" />
      <p id={`${id}-error`} className="mt-1.5 text-sm text-error" aria-live="polite">{error}</p>
    </div>
  );
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" label="Send" loading={pending}>
      {pending ? "Sending…" : "Send"}
    </Button>
  );
}
