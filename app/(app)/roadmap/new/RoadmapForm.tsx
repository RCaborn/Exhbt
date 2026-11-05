"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { startRoadmap, type FormState } from "../actions";

export function RoadmapForm({ signedInEmail, defaultRole = "" }: { signedInEmail: string | null; defaultRole?: string }) {
  const [state, action] = useActionState<FormState, FormData>(startRoadmap, undefined);
  const [mode, setMode] = useState<"upload" | "paste">("upload");
  const err = state?.fieldErrors ?? {};

  return (
    <form action={action} className="space-y-9" noValidate>
      {state?.error && (
        <p role="alert" className="rounded border border-error/40 bg-surface px-4 py-3 text-error">
          {state.error}
        </p>
      )}

      <fieldset>
        <legend className="label">Your CV</legend>
        <div className="mb-3 inline-flex rounded border border-rule bg-surface p-0.5 text-sm" role="radiogroup" aria-label="How to add your CV">
          {(["upload", "paste"] as const).map((m) => (
            <label
              key={m}
              className={`cursor-pointer rounded-sm px-3 py-1.5 has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-solid has-[:focus-visible]:outline-blue-edge ${
                mode === m ? "bg-ink text-white" : "text-ink-2 hover:text-ink"
              }`}
            >
              <input
                type="radio"
                name="cvMode"
                value={m}
                checked={mode === m}
                onChange={() => setMode(m)}
                className="sr-only"
              />
              {m === "upload" ? "Upload a file" : "Paste the text"}
            </label>
          ))}
        </div>

        {mode === "upload" ? (
          <div>
            <label htmlFor="cvFile" className="sr-only">CV file</label>
            <input
              id="cvFile"
              name="cvFile"
              type="file"
              // Arriving from the home page with a role: the CV is the next thing to do.
              autoFocus={Boolean(defaultRole)}
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              aria-describedby="cv-hint cv-error"
              className="field file:mr-4 file:rounded-sm file:border-0 file:bg-sky file:px-3 file:py-1.5 file:font-medium"
            />
            <p id="cv-hint" className="hint mt-1.5">PDF or Word (.docx), up to 5 MB. We read the text only.</p>
          </div>
        ) : (
          <div>
            <label htmlFor="cvText" className="sr-only">CV text</label>
            <textarea
              id="cvText"
              name="cvText"
              rows={10}
              aria-describedby="cv-error"
              className="field font-[inherit]"
              placeholder="Paste your CV here"
            />
          </div>
        )}
        <FieldError id="cv-error" message={err.cv} />
      </fieldset>

      <div>
        <label htmlFor="targetRole" className="label">Role you are aiming for</label>
        <input
          id="targetRole"
          name="targetRole"
          defaultValue={defaultRole}
          required
          maxLength={120}
          aria-describedby="targetRole-error"
          className="field"
          placeholder="e.g. Junior data analyst in the NHS"
        />
        <FieldError id="targetRole-error" message={err.targetRole} />
      </div>

      <div>
        <label htmlFor="skills" className="label">
          Skills you would add <span className="font-normal text-ink-2">(optional)</span>
        </label>
        <textarea id="skills" name="skills" rows={2} maxLength={1000} className="field" placeholder="Anything your CV leaves out" />
      </div>

      <div>
        <label htmlFor="ambitions" className="label">
          What you want from the next two years <span className="font-normal text-ink-2">(optional)</span>
        </label>
        <textarea id="ambitions" name="ambitions" rows={3} maxLength={1000} className="field" />
      </div>

      {signedInEmail ? (
        <p className="hint">Signed in as {signedInEmail}.</p>
      ) : (
        <div>
          <label htmlFor="email" className="label">Email address</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            aria-describedby="email-hint email-error"
            className="field"
          />
          <p id="email-hint" className="hint mt-1.5">
            We send a sign-in link here, and your roadmap opens when you click it. No password needed.
          </p>
          <FieldError id="email-error" message={err.email} />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 border-t border-rule pt-7">
        <Submit />
        <p className="hint">
          By continuing you agree to the <Link href="/legal/terms" className="link">terms</Link> and{" "}
          <Link href="/legal/privacy" className="link">privacy policy</Link>.
        </p>
      </div>
    </form>
  );
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primary" disabled={pending} aria-disabled={pending}>
      {pending ? "Reading your CV…" : "Build my roadmap"}
    </button>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  return (
    <p id={id} className="mt-1.5 text-sm text-error" aria-live="polite">
      {message}
    </p>
  );
}
