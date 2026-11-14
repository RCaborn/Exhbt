"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { savePassword, type FormState } from "../actions";
import { useContinue } from "../useContinue";
import { Button } from "@/components/ui/Button";

export function PasswordForm({ token }: { token?: string }) {
  const [state, action] = useActionState<FormState, FormData>(savePassword, undefined);
  useContinue(state?.continueTo);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  return (
    <form action={action} className="space-y-5" noValidate>
      {token && <input type="hidden" name="token" value={token} />}
      <div>
        <label htmlFor="password" className="label">New password</label>
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
          aria-describedby="password-error"
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
          aria-describedby="password-error"
        />
      </div>
      <p id="password-error" className="text-sm text-error" aria-live="polite">{state?.error}</p>
      <Submit />
    </form>
  );
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" label="Save password" loading={pending} className="w-full">
      {pending ? "Saving…" : "Save password"}
    </Button>
  );
}
