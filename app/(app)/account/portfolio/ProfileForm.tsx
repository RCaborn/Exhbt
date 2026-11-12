"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/Button";
import { saveProfileAction, type ProfileState } from "./actions";
import { BIO_MAX_WORDS, countWords, HEADLINE_MAX_WORDS, NAME_MAX_CHARS } from "./rules";

export type ProfileValues = { name: string; headline: string; bio: string; linkedin: string; hideFromSearch: boolean };

/**
 * The portfolio header: name, headline, bio, LinkedIn, and whether search engines may list it.
 * Controlled fields, so an error doesn't wipe what was typed. The photo comes later, with uploads.
 */
export function ProfileForm({ initial }: { initial: ProfileValues }) {
  const [state, action] = useActionState<ProfileState, FormData>(saveProfileAction, undefined);
  const [v, setV] = useState(initial);
  const [dirty, setDirty] = useState(false);
  const set = <K extends keyof ProfileValues>(k: K, value: ProfileValues[K]) => {
    setV((prev) => ({ ...prev, [k]: value }));
    setDirty(true);
  };
  const errors = state?.fieldErrors ?? {};
  const headlineWords = countWords(v.headline);
  const bioWords = countWords(v.bio);

  return (
    <form action={(fd) => { setDirty(false); return action(fd); }} noValidate className="mt-5 max-w-[32rem] space-y-5">
      <Field id="profile-name" label="Name" error={errors.name}>
        <input id="profile-name" name="name" value={v.name} onChange={(e) => set("name", e.target.value)} autoComplete="name" maxLength={NAME_MAX_CHARS + 20} aria-describedby="profile-name-error" className="field" />
      </Field>

      <Field id="profile-headline" label="Headline" optional error={errors.headline} count={`${headlineWords} of ${HEADLINE_MAX_WORDS} words`} over={headlineWords > HEADLINE_MAX_WORDS}>
        <input
          id="profile-headline"
          name="headline"
          value={v.headline}
          onChange={(e) => set("headline", e.target.value)}
          maxLength={200}
          placeholder="Data analyst, health and public services"
          aria-describedby="profile-headline-count profile-headline-error"
          className="field"
        />
      </Field>

      <Field id="profile-bio" label="Bio" optional error={errors.bio} count={`${bioWords} of ${BIO_MAX_WORDS} words`} over={bioWords > BIO_MAX_WORDS}>
        <textarea
          id="profile-bio"
          name="bio"
          value={v.bio}
          onChange={(e) => set("bio", e.target.value)}
          rows={4}
          maxLength={600}
          aria-describedby="profile-bio-count profile-bio-error"
          className="field"
        />
      </Field>

      <Field id="profile-linkedin" label="LinkedIn" optional error={errors.linkedin}>
        <input
          id="profile-linkedin"
          name="linkedin"
          value={v.linkedin}
          onChange={(e) => set("linkedin", e.target.value)}
          autoComplete="url"
          inputMode="url"
          maxLength={200}
          placeholder="linkedin.com/in/your-name"
          aria-describedby="profile-linkedin-error"
          className="field"
        />
      </Field>

      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          name="hideFromSearch"
          value="yes"
          checked={v.hideFromSearch}
          onChange={(e) => set("hideFromSearch", e.target.checked)}
          className="mt-1 size-5 shrink-0 accent-[var(--color-jade)]"
        />
        <span>Hide my portfolio from search engines</span>
      </label>

      {state?.error && (
        <p role="alert" className="rounded-[var(--radius)] border border-error/40 bg-surface px-4 py-3 text-error">
          {state.error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-4 pt-1">
        <Submit />
        <p role="status" className="text-sm text-jade">{state?.saved && !dirty ? "Saved." : ""}</p>
      </div>
    </form>
  );
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" loading={pending} label="Save profile">
      Save profile
    </Button>
  );
}

function Field({
  id,
  label,
  optional,
  error,
  count,
  over,
  children,
}: {
  id: string;
  label: string;
  optional?: boolean;
  error?: string;
  count?: string;
  over?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="label">
        {label} {optional && <span className="font-normal text-graphite">(optional)</span>}
      </label>
      {children}
      {count && (
        <p id={`${id}-count`} className={`hint mt-1.5 ${over ? "text-error" : ""}`}>
          {count}
        </p>
      )}
      <p id={`${id}-error`} className="mt-1.5 min-h-5 text-sm text-error" aria-live="polite">
        {error}
      </p>
    </div>
  );
}
