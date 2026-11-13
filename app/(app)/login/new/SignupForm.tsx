"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { signup, type FormState } from "../actions";
import { useContinue } from "../useContinue";
import { Button } from "@/components/ui/Button";

export function SignupForm({ next }: { next: string }) {
  const [state, action] = useActionState<FormState, FormData>(signup, undefined);
  useContinue(state?.continueTo);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  return (
    <form action={action} className="space-y-5" noValidate>
      <input type="hidden" name="next" value={next} />
      <div>
        <label htmlFor="email" className="label">Email address</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="field"
          aria-describedby="signup-error"
        />
      </div>
      <div>
        <label htmlFor="password" className="label">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="field"
          aria-describedby="signup-error"
        />
        <p className="hint mt-1.5">At least 8 characters.</p>
      </div>
      <div>
        <label htmlFor="confirm" className="label">Confirm password</label>
        <input
          id="confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="field"
          aria-describedby="signup-error"
        />
      </div>
      <p id="signup-error" className="text-sm text-error" aria-live="polite">{state?.error}</p>
      <Submit />
    </form>
  );
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" label="Create account" loading={pending} className="w-full">
      {pending ? "Creating…" : "Create account"}
    </Button>
  );
}
