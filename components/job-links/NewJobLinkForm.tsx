"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/Button";
import { createJobLink, type JobLinkFormState } from "@/app/(app)/job-links/actions";

export function NewJobLinkForm() {
  const [state, action] = useActionState<JobLinkFormState | undefined, FormData>(createJobLink, undefined);
  return (
    <form action={action} className="space-y-5">
      <div>
        <label htmlFor="company" className="label">Company</label>
        <input id="company" name="company" required maxLength={120} className="field" autoComplete="organization" />
      </div>
      <div>
        <label htmlFor="role" className="label">Role</label>
        <input id="role" name="role" required maxLength={120} className="field" />
      </div>
      <div>
        <label htmlFor="description" className="label">Job description</label>
        <textarea id="description" name="description" required rows={10} maxLength={20000} className="field" />
        <p className="mt-1.5 text-sm text-graphite">Paste the description. A link to the advert isn&rsquo;t fetched.</p>
      </div>
      <fieldset className="space-y-2">
        <legend className="label">Address</legend>
        <label className="flex items-start gap-3">
          <input type="radio" name="slugStyle" value="suffix" defaultChecked className="mt-1.5" />
          <span>Company name plus a short code, so the address can&rsquo;t be guessed. This is the usual choice.</span>
        </label>
        <label className="flex items-start gap-3">
          <input type="radio" name="slugStyle" value="clean" className="mt-1.5" />
          <span>A short address. Someone could guess it by trying company names.</span>
        </label>
        <label htmlFor="slug" className="label mt-3">Change the company part</label>
        <input id="slug" name="slug" className="field" placeholder="Leave blank to use the company name" />
      </fieldset>
      {state?.error && (
        <p className="text-sm text-error" role="alert">{state.error}</p>
      )}
      <Submit />
    </form>
  );
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" loading={pending}>
      {pending ? "Making the link…" : "Make the link"}
    </Button>
  );
}
