"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { login, type LoginState } from "./actions";
import { Button } from "@/components/ui/Button";

export function LoginForm({ next }: { next: string }) {
  const [state, action] = useActionState<LoginState, FormData>(login, undefined);
  return (
    <form action={action} className="space-y-5" noValidate>
      <input type="hidden" name="next" value={next} />
      <div>
        <label htmlFor="email" className="label">Email address</label>
        <input id="email" name="email" type="email" autoComplete="email" required className="field" aria-describedby="login-error" />
        <p id="login-error" className="mt-1.5 text-sm text-error" aria-live="polite">{state?.error}</p>
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
