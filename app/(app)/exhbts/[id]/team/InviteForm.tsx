"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { inviteAction, type FormState } from "@/app/(app)/team/actions";
import { Button } from "@/components/ui/Button";
import { ROLE_MAX_CHARS } from "@/lib/team-rules";
import { useHydrated } from "@/lib/use-hydrated";

/** Invite a teammate by email, with a short role. The server checks everything again (lib/team.ts). */
export function InviteForm({ exhbtId }: { exhbtId: string }) {
  const [state, action] = useActionState<FormState, FormData>(inviteAction.bind(null, exhbtId), undefined);
  const ready = useHydrated();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  useEffect(() => {
    if (state?.ok) {
      setEmail("");
      setRole("");
    }
  }, [state]);

  return (
    <form action={action} noValidate data-ready={ready ? "true" : undefined} className="mt-4 max-w-[30rem] space-y-4">
      <div>
        <label htmlFor="invite-email" className="label">
          Their email address
        </label>
        <input
          id="invite-email"
          name="email"
          type="email"
          autoComplete="off"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          readOnly={!ready}
          aria-describedby="invite-result"
          className="field"
        />
      </div>
      <div>
        <label htmlFor="invite-role" className="label">
          What they did <span className="font-normal text-graphite">(optional)</span>
        </label>
        <input
          id="invite-role"
          name="role"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          maxLength={ROLE_MAX_CHARS}
          placeholder="Built the model"
          readOnly={!ready}
          aria-describedby="invite-role-count"
          className="field"
        />
        <p id="invite-role-count" className="hint mt-1">
          {role.length} of {ROLE_MAX_CHARS} characters
        </p>
      </div>
      <Submit />
      <p id="invite-result" aria-live="polite" className={state?.error ? "text-sm text-error" : "text-sm text-graphite"}>
        {state?.error ?? state?.message}
      </p>
    </form>
  );
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" label="Send invite" loading={pending} disabled={pending}>
      {pending ? "Sending…" : "Send invite"}
    </Button>
  );
}
