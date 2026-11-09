"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Check } from "lucide-react";
import { joinWaitlist, type WaitlistState } from "./actions";
import { Button } from "@/components/ui/Button";

type Props = {
  /** Where the form sits, for analytics (e.g. "pricing", "roadmap-next"). */
  source: string;
  interest?: "plus" | "premium" | "university";
  defaultEmail?: string;
  /** "dark" for use on the navy band. */
  tone?: "light" | "dark";
};

export function WaitlistForm({ source, interest = "premium", defaultEmail = "", tone = "light" }: Props) {
  const [state, action] = useActionState<WaitlistState, FormData>(joinWaitlist, undefined);
  const id = `waitlist-${source}`;

  if (state?.ok) {
    return (
      <p role="status" className="inline-flex items-center gap-2 font-semibold">
        <span className="inline-flex size-5 items-center justify-center rounded-full border border-ink bg-mint text-ink">
          <Check aria-hidden size={12} strokeWidth={3} />
        </span>
        You&rsquo;re on the list. We&rsquo;ll email you when it opens.
      </p>
    );
  }

  return (
    <form action={action} noValidate className="w-full max-w-[30rem]">
      <input type="hidden" name="interest" value={interest} />
      <input type="hidden" name="source" value={source} />
      <div aria-hidden className="absolute left-[-9999px]">
        <label>
          Leave this empty
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <label htmlFor={id} className="sr-only">Email address</label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id={id}
          name="email"
          type="email"
          autoComplete="email"
          defaultValue={defaultEmail}
          placeholder="Your email"
          aria-describedby={`${id}-error`}
          className="field min-h-12 flex-1 rounded-full px-5"
        />
        <Submit />
      </div>
      <p id={`${id}-error`} className={`mt-1.5 min-h-5 text-sm ${tone === "dark" ? "text-[#ffb4a9]" : "text-error"}`} aria-live="polite">
        {state?.error}
      </p>
    </form>
  );
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" size="lg" label="Join the waitlist" loading={pending}>
      {pending ? "Joining…" : "Join the waitlist"}
    </Button>
  );
}
