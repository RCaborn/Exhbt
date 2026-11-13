"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { saveIntro, saveSlug, type JobLinkFormState } from "@/app/(app)/job-links/actions";
import { INTRO_WORDS } from "@/lib/job-links";

export function IntroForm({ id, intro }: { id: string; intro: string }) {
  const [state, action] = useActionState<JobLinkFormState | undefined, FormData>(saveIntro, undefined);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      <label htmlFor="intro" className="label">Introduction</label>
      <textarea id="intro" name="intro" rows={4} defaultValue={intro} className="field" />
      <p className="text-sm text-graphite">At most {INTRO_WORDS} words. This is what an employer reads above the projects.</p>
      {state?.error && <p className="text-sm text-error" role="alert">{state.error}</p>}
      {!state?.error && state && <p className="text-sm text-graphite" role="status">Introduction saved.</p>}
      <Button type="submit" variant="secondary" size="sm">Save introduction</Button>
    </form>
  );
}

export function SlugForm({ id, slug, slugStyle }: { id: string; slug: string; slugStyle: "clean" | "suffix" }) {
  const [state, action] = useActionState<JobLinkFormState | undefined, FormData>(saveSlug, undefined);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      <label htmlFor="address" className="label">Address</label>
      <input id="address" name="slug" defaultValue={slug} required className="field font-mono" />
      <label className="flex items-start gap-3">
        <input type="radio" name="slugStyle" value="suffix" defaultChecked={slugStyle === "suffix"} className="mt-1" />
        <span>Harder to guess.</span>
      </label>
      <label className="flex items-start gap-3">
        <input type="radio" name="slugStyle" value="clean" defaultChecked={slugStyle === "clean"} className="mt-1" />
        <span>Short, and someone could guess it by trying company names.</span>
      </label>
      <p className="text-sm text-graphite">Changing this breaks the old address.</p>
      {state?.error && <p className="text-sm text-error" role="alert">{state.error}</p>}
      {!state?.error && state && <p className="text-sm text-graphite" role="status">Address saved.</p>}
      <Button type="submit" variant="secondary" size="sm">Save address</Button>
    </form>
  );
}
