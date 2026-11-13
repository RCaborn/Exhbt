"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { login, type FormState } from "./actions";
import { useContinue } from "./useContinue";
import { Button } from "@/components/ui/Button";

export function LoginForm({ next }: { next: string }) {
  const [state, action] = useActionState<FormState, FormData>(login, undefined);
  useContinue(state?.continueTo);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  return (
    <form action={action} className="space-y-5" noValidate>
      <input type="hidden" name="next" value={next} />
      <div>
        <label htmlFor="identifier" className="label">Email or username</label>
        <input
          id="identifier"
          name="identifier"
          type="text"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          className="field"
          aria-describedby="login-error"
        />
      </div>
      <div>
        <label htmlFor="password" className="label">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="field"
          aria-describedby="login-error"
        />
      </div>
      <p id="login-error" className="text-sm text-error" aria-live="polite">{state?.error}</p>
      <Submit />
    </form>
  );
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" label="Log in" loading={pending} className="w-full">
      {pending ? "Logging in…" : "Log in"}
    </Button>
  );
}
