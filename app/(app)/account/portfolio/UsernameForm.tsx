"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { portfolioHost, usernameProblem } from "@/lib/hosts";
import { Button } from "@/components/ui/Button";
import { claimUsernameAction, type UsernameState } from "./actions";

type Remote = { name: string; ok: boolean; reason?: string };

/**
 * Claim or change the username, with a live check: the format rule straight away (after a short
 * pause in typing), then whether it's free, from /api/username/check.
 */
export function UsernameForm({ current }: { current: string | null }) {
  const [state, action] = useActionState<UsernameState, FormData>(claimUsernameAction, undefined);
  const [value, setValue] = useState(current ?? "");
  const [settled, setSettled] = useState(value);
  const [remote, setRemote] = useState<Remote | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setSettled(value), 350);
    return () => clearTimeout(t);
  }, [value]);

  useEffect(() => {
    if (!settled || settled === current || usernameProblem(settled)) return;
    const ctrl = new AbortController();
    fetch(`/api/username/check?name=${encodeURIComponent(settled)}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { ok: boolean; reason?: string } | null) => {
        if (j) setRemote({ name: settled, ok: j.ok, reason: j.reason });
      })
      .catch(() => {});
    return () => ctrl.abort();
  }, [settled, current]);

  // What to say under the field. A server answer wins while the field still holds what was sent.
  let message: { text: string; ok: boolean } | null = null;
  if (state?.name === value && state.error) message = { text: state.error, ok: false };
  else if (state?.name === value && state.saved && value === current) message = { text: "Saved.", ok: true };
  else if (value && value === settled) {
    const problem = usernameProblem(value);
    if (value === current) message = null;
    else if (problem) message = { text: problem, ok: false };
    else if (remote?.name === value) message = remote.ok ? { text: "Available.", ok: true } : { text: remote.reason ?? "That name can't be used.", ok: false };
    else message = { text: "Checking…", ok: true };
  }

  const preview = value && !usernameProblem(value) ? portfolioHost(value) : null;

  return (
    <form action={action} noValidate className="mt-5 max-w-[32rem]">
      <label htmlFor="username" className="label">Username</label>
      <input
        id="username"
        name="username"
        value={value}
        onChange={(e) => setValue(e.target.value.toLowerCase())}
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        maxLength={30}
        aria-describedby="username-hint username-status"
        aria-invalid={message ? !message.ok : undefined}
        className="field"
      />
      <p id="username-hint" className="hint mt-1.5">
        {preview ? <>Your address: <span className="font-semibold text-graphite">{preview}</span></> : "Lower-case letters, numbers and single hyphens."}
      </p>
      <p id="username-status" className={`mt-1 min-h-5 text-sm ${message?.ok ? "text-jade" : "text-error"}`} aria-live="polite">
        {message?.text}
      </p>
      {current && <p className="mt-2 text-sm text-graphite">If you change it, your old address redirects to the new one for 30 days.</p>}
      <div className="mt-4">
        <Submit label={current ? "Change username" : "Claim username"} />
      </div>
    </form>
  );
}

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="secondary" loading={pending} label={label}>
      {label}
    </Button>
  );
}
