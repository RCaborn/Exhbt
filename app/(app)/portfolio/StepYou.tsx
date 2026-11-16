"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { countWords, PROFILE_LIMITS, type ProfileDraft, type ProfileField } from "@/lib/portfolio-profile";
import { suggestIntroAction } from "./actions";
import { PhotoField } from "./PhotoField";

/**
 * Step 1, You: who they are, in their words. Everything applies to the preview as it is typed and
 * saves itself (the builder's autosave). The intro can start from "Suggest an intro", which drafts
 * one from what they've already told us; it fills the field and they edit it.
 */
export function StepYou({
  profile,
  problems,
  set,
  showLinkedin,
  setShowLinkedin,
  photo,
  ready,
}: {
  profile: ProfileDraft;
  problems: Partial<Record<ProfileField, string>>;
  set: <K extends keyof ProfileDraft>(key: K, value: ProfileDraft[K], undo?: string) => void;
  showLinkedin: boolean;
  setShowLinkedin: (on: boolean) => void;
  photo: { url: string | null; maxMb: number };
  ready: boolean;
}) {
  const [suggesting, setSuggesting] = useState(false);
  const [suggestNote, setSuggestNote] = useState<{ text: string; error: boolean } | null>(null);
  const introWords = countWords(profile.bio);

  async function suggest() {
    setSuggesting(true);
    setSuggestNote(null);
    const r = await suggestIntroAction(profile).catch(() => ({ ok: false as const, error: "We couldn't reach the server. Check your connection and try again." }));
    setSuggesting(false);
    if (!r.ok) return setSuggestNote({ text: r.error, error: true });
    set("bio", r.intro, "Suggested an intro");
    setSuggestNote({ text: "Here’s a start, written only from what you’ve told us. Change anything that isn’t how you’d say it.", error: false });
  }

  const input = (key: Exclude<ProfileField, "bio">, { "aria-describedby": more, ...extra }: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <input
      id={`you-${key}`}
      value={profile[key]}
      onChange={(e) => set(key, e.target.value)}
      readOnly={!ready}
      aria-invalid={problems[key] ? true : undefined}
      aria-describedby={more ? `${more} you-${key}-error` : `you-${key}-error`}
      className="field"
      {...extra}
    />
  );

  return (
    <div className="space-y-10">
      <section aria-labelledby="you-photo-heading">
        <h2 id="you-photo-heading" className="text-[1.0625rem] font-sans font-semibold tracking-normal">
          Photo
        </h2>
        <PhotoField name={profile.name || "You"} photoUrl={photo.url} maxMb={photo.maxMb} />
      </section>

      <div className="space-y-6">
        <Field id="you-name" label="Name" error={problems.name}>
          {input("name", { autoComplete: "name", maxLength: PROFILE_LIMITS.nameChars + 20 })}
        </Field>
        <Field
          id="you-headline"
          label="Headline"
          optional
          hint="What you do or want to do, in a line."
          error={problems.headline}
          count={`${countWords(profile.headline)} of ${PROFILE_LIMITS.headlineWords} words`}
          over={countWords(profile.headline) > PROFILE_LIMITS.headlineWords}
        >
          {input("headline", { maxLength: 200, placeholder: "Data analyst, health and public services", "aria-describedby": "you-headline-hint you-headline-count" })}
        </Field>

        <Field
          id="you-bio"
          label="Your intro"
          optional
          hint="The first thing visitors read. A few lines in your own words."
          error={problems.bio}
          count={`${introWords} of ${PROFILE_LIMITS.introWords} words`}
          over={introWords > PROFILE_LIMITS.introWords}
        >
          <textarea
            id="you-bio"
            value={profile.bio}
            onChange={(e) => set("bio", e.target.value)}
            rows={5}
            maxLength={PROFILE_LIMITS.introChars + 200}
            readOnly={!ready}
            aria-invalid={problems.bio ? true : undefined}
            aria-describedby="you-bio-hint you-bio-count you-bio-error"
            className="field"
          />
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
            <Button size="sm" onClick={suggest} loading={suggesting} disabled={!ready || suggesting} label="Suggest an intro">
              <Sparkles aria-hidden size={15} strokeWidth={2} /> Suggest an intro
            </Button>
            <p role="status" className={`text-sm ${suggestNote?.error ? "text-error" : "text-graphite"}`}>
              {suggestNote?.text}
            </p>
          </div>
        </Field>
      </div>

      <section aria-labelledby="you-where-heading" className="space-y-6">
        <h2 id="you-where-heading" className="text-[1.0625rem] font-sans font-semibold tracking-normal">
          Where you are and what you want
        </h2>
        <Field id="you-location" label="Where you’re based" optional error={problems.location}>
          {input("location", { autoComplete: "address-level2", maxLength: PROFILE_LIMITS.locationChars + 20, placeholder: "Leeds" })}
        </Field>
        <Field id="you-lookingFor" label="What you’re looking for" optional hint="Shown as “Looking for …”." error={problems.lookingFor}>
          {input("lookingFor", { maxLength: PROFILE_LIMITS.lookingForChars + 20, placeholder: "Graduate data roles from September 2027", "aria-describedby": "you-lookingFor-hint" })}
        </Field>
      </section>

      <section aria-labelledby="you-links-heading" className="space-y-6">
        <h2 id="you-links-heading" className="text-[1.0625rem] font-sans font-semibold tracking-normal">
          How to reach you
        </h2>
        <Field id="you-linkedin" label="LinkedIn" optional error={problems.linkedin}>
          {input("linkedin", { autoComplete: "url", inputMode: "url", maxLength: 200, placeholder: "linkedin.com/in/your-name" })}
          <label className="mt-2 flex items-center gap-2.5 text-sm">
            <input
              type="checkbox"
              checked={showLinkedin}
              disabled={!ready}
              onChange={(e) => setShowLinkedin(e.target.checked)}
              className="size-4.5 shrink-0 accent-[var(--color-jade)]"
            />
            Show it on my page
          </label>
        </Field>
        <Field id="you-github" label="GitHub" optional error={problems.github}>
          {input("github", { inputMode: "url", maxLength: 200, placeholder: "github.com/your-name" })}
        </Field>
        <Field id="you-website" label="Website" optional error={problems.website}>
          {input("website", { inputMode: "url", maxLength: 200, placeholder: "your-name.co.uk" })}
        </Field>
        <Field id="you-contactEmail" label="Email" optional hint="Shown as text, not a link, so it’s harder to scrape." error={problems.contactEmail}>
          {input("contactEmail", { type: "email", autoComplete: "email", maxLength: 140, "aria-describedby": "you-contactEmail-hint" })}
        </Field>
      </section>
    </div>
  );
}

function Field({
  id,
  label,
  optional,
  hint,
  error,
  count,
  over,
  children,
}: {
  id: string;
  label: string;
  optional?: boolean;
  hint?: string;
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
      {hint && (
        <p id={`${id}-hint`} className="-mt-1 mb-2 text-sm text-graphite">
          {hint}
        </p>
      )}
      {children}
      <div className="mt-1.5 flex flex-wrap justify-between gap-x-4">
        <p id={`${id}-error`} className="text-sm text-error" aria-live="polite">
          {error}
        </p>
        {count && (
          <p id={`${id}-count`} className={`hint ${over ? "text-error" : ""}`}>
            {count}
          </p>
        )}
      </div>
    </div>
  );
}
