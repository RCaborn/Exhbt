"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { ArrowRight } from "lucide-react";
import { unlockProjects, type GateState } from "@/app/(app)/roadmap/[id]/actions";
import type { Contact } from "@/lib/cv-contact";
import { Button } from "@/components/ui/Button";

/**
 * The details asked for before the project ideas (docs/decisions/0004). Prefilled from the
 * CV where it could be read, and always editable. Controlled fields, so a validation error
 * doesn't wipe what was typed.
 */
export function ProjectsGate({ id, prefill, signedInEmail }: { id: string; prefill: Contact; signedInEmail: string | null }) {
  const [state, action] = useActionState<GateState, FormData>(unlockProjects.bind(null, id), undefined);
  const [name, setName] = useState(prefill.name ?? "");
  const [email, setEmail] = useState(signedInEmail ?? prefill.email ?? "");
  const [linkedin, setLinkedin] = useState(prefill.linkedin ?? "");
  const fromCv = Boolean(prefill.name || prefill.email || prefill.linkedin);
  const errors = state?.fieldErrors ?? {};

  return (
    <form action={action} noValidate className="mt-8 max-w-[32rem] space-y-5">
      <input type="hidden" name="prefilled" value={fromCv ? "yes" : "no"} />
      {fromCv && <p className="rounded-[var(--radius)] bg-mist px-4 py-3 text-[0.95rem]">From your CV. Change anything that&rsquo;s wrong.</p>}

      <GateField id="gate-name" label="Name" error={errors.name}>
        <input
          id="gate-name"
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
          maxLength={100}
          aria-describedby="gate-name-error"
          className="field"
        />
      </GateField>

      <GateField id="gate-email" label="Email" error={errors.email}>
        <input
          id="gate-email"
          name="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          readOnly={Boolean(signedInEmail)}
          autoComplete="email"
          aria-describedby="gate-email-error"
          className="field"
        />
      </GateField>

      <GateField id="gate-linkedin" label="LinkedIn" optional error={errors.linkedin}>
        <input
          id="gate-linkedin"
          name="linkedin"
          value={linkedin}
          onChange={(e) => setLinkedin(e.target.value)}
          autoComplete="url"
          inputMode="url"
          maxLength={200}
          placeholder="linkedin.com/in/your-name"
          aria-describedby="gate-linkedin-error"
          className="field"
        />
      </GateField>

      <label className="flex items-start gap-3">
        <input type="checkbox" name="marketingOptIn" value="yes" className="mt-1 size-5 shrink-0 accent-[var(--color-jade)]" />
        <span>Email me about new features.</span>
      </label>

      {state?.error && (
        <p role="alert" className="rounded-[var(--radius)] border border-error/40 bg-surface px-4 py-3 text-error">
          {state.error}{" "}
          {state.error.includes("waitlist") && (
            <Link href="/pricing#premium" className="link font-semibold">Go to pricing</Link>
          )}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
        <p className="hint">
          By continuing you agree to the <Link href="/legal/terms" className="link">terms</Link> and{" "}
          <Link href="/legal/privacy" className="link">privacy policy</Link>.
        </p>
        <Submit />
      </div>
    </form>
  );
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" size="lg" label="Show my projects" loading={pending}>
      {pending ? "Opening…" : "Show my projects"} <ArrowRight aria-hidden size={18} strokeWidth={2.5} />
    </Button>
  );
}

function GateField({
  id,
  label,
  optional,
  error,
  children,
}: {
  id: string;
  label: string;
  optional?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="label">
        {label} {optional && <span className="font-normal text-graphite">(optional)</span>}
      </label>
      {children}
      <p id={`${id}-error`} className="mt-1.5 min-h-5 text-sm text-error" aria-live="polite">
        {error}
      </p>
    </div>
  );
}
