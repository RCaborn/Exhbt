"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { requestReset, type FormState } from "../actions";
import { Button } from "@/components/ui/Button";

export function ResetForm() {
  const [state, action] = useActionState<FormState, FormData>(requestReset, undefined);
  return (
    <form action={action} className="space-y-5" noValidate>
      <div>
        <label htmlFor="email" className="label">Email address</label>
        <input id="email" name="email" type="email" autoComplete="email" required className="field" aria-describedby="reset-error" />
        <p id="reset-error" className="mt-1.5 text-sm text-error" aria-live="polite">{state?.error}</p>
      </div>
      <Submit />
    </form>
  );
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" label="Email me a link" loading={pending} className="w-full">
      {pending ? "Sending…" : "Email me a link"}
    </Button>
  );
}
