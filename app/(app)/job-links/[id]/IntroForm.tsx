"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useHydrated } from "@/lib/use-hydrated";

/**
 * The intro field. Controlled and set once from the saved value; read-only until the page has
 * hydrated, so text typed early can't be merged with the saved intro.
 */
export function IntroForm({
  action,
  initial,
  words,
  maxChars,
  canEdit,
  saved,
}: {
  action: (formData: FormData) => void | Promise<void>;
  initial: string;
  words: number;
  maxChars: number;
  canEdit: boolean;
  saved: boolean;
}) {
  const ready = useHydrated();
  const [intro, setIntro] = useState(initial);
  return (
    <form action={action} data-ready={ready ? "true" : undefined} className="mt-2">
      <label htmlFor="intro" className="hint block">
        A line or two to the employer, in your words. About {words} words. We suggested this from the advert and your exhbts.
      </label>
      <textarea
        id="intro"
        name="intro"
        rows={3}
        maxLength={maxChars}
        value={intro}
        onChange={(e) => setIntro(e.target.value)}
        readOnly={!ready}
        disabled={!canEdit}
        className="field mt-2"
      />
      <div className="mt-3 flex flex-wrap items-center gap-3">
        {canEdit && (
          <Button type="submit" size="sm" disabled={!ready}>
            Save intro
          </Button>
        )}
        {saved && (
          <span role="status" className="text-sm font-semibold">
            Saved
          </span>
        )}
      </div>
    </form>
  );
}
