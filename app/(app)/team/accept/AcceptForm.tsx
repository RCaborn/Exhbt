"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { acceptAction, type FormState } from "@/app/(app)/team/actions";
import { Button } from "@/components/ui/Button";
import { useHydrated } from "@/lib/use-hydrated";

/** Joins the team as the signed-in person, with the name that shows on the project. */
export function AcceptForm({ token, name: initial }: { token: string; name: string }) {
  const [state, action] = useActionState<FormState, FormData>(acceptAction.bind(null, token), undefined);
  const ready = useHydrated();
  const [name, setName] = useState(initial);
  return (
    <form action={action} noValidate data-ready={ready ? "true" : undefined} className="mt-6 space-y-4">
      <div>
        <label htmlFor="accept-name" className="label">
          Your name, as it shows on the project
        </label>
        <p id="accept-name-hint" className="hint mt-1">
          It&apos;s your Exhbt name, so your own portfolio uses it too.
        </p>
        <input
          id="accept-name"
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
          maxLength={80}
          required
          readOnly={!ready}
          aria-describedby="accept-name-hint accept-error"
          className="field mt-2"
        />
      </div>
      <Submit />
      <p id="accept-error" aria-live="polite" className="text-sm text-error">
        {state?.error}
      </p>
    </form>
  );
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" label="Join the team" loading={pending} disabled={pending}>
      {pending ? "Joining…" : "Join the team"}
    </Button>
  );
}
