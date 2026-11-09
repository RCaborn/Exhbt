"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { RefreshCw } from "lucide-react";
import { keepPlan, swapIdea, type SwapState } from "@/app/(app)/roadmap/[id]/actions";
import { IdeaCard } from "@/components/roadmap/IdeaCard";
import type { ProjectIdea } from "@/lib/store";

/**
 * The plan of three, before it's settled (docs/decisions/0004): an optional note that steers
 * new ideas, a Swap button on each idea, and "Keep this plan". One form, so a Swap sends the
 * note with it.
 */
export function PlanEditor({ id, ideas, swapsLeft }: { id: string; ideas: ProjectIdea[]; swapsLeft: number }) {
  const [state, action] = useActionState<SwapState, FormData>(swapIdea.bind(null, id), undefined);
  const [note, setNote] = useState("");
  // A finished swap clears the note for the next one.
  useEffect(() => {
    if (state?.done) setNote("");
  }, [state?.done]);

  return (
    <form action={action} className="mt-8">
      <label htmlFor="note" className="label">
        Make some tweaks <span className="font-normal text-ink-2">(optional)</span>
      </label>
      <textarea
        id="note"
        name="note"
        rows={2}
        maxLength={300}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="e.g. Use more real data"
        aria-describedby="swap-status"
        className="field"
      />

      <ol aria-label="Project ideas" className="mt-6 space-y-4">
        {ideas.map((p) => (
          <li key={p.id}>
            <IdeaCard idea={p} control={<SwapButton ideaId={p.id} title={p.title} />} />
          </li>
        ))}
      </ol>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <p id="swap-status" className="text-sm text-ink-2" aria-live="polite">
          {state?.error ? (
            <span className="text-error">{state.error}</span>
          ) : (
            <>
              <span className="font-mono text-ink">{swapsLeft}</span> {swapsLeft === 1 ? "swap" : "swaps"} left
            </>
          )}
        </p>
        <KeepButton id={id} />
      </div>
    </form>
  );
}

function SwapButton({ ideaId, title }: { ideaId: string; title: string }) {
  const { pending, data } = useFormStatus();
  const mine = pending && data?.get("ideaId") === ideaId;
  return (
    <button
      type="submit"
      name="ideaId"
      value={ideaId}
      disabled={pending}
      aria-label={`Swap: ${title}`}
      className="btn btn-secondary min-h-10 px-4 text-sm"
    >
      <RefreshCw aria-hidden size={15} strokeWidth={2.25} className={mine ? "motion-safe:animate-spin" : undefined} />
      {mine ? "Swapping…" : "Swap"}
    </button>
  );
}

function KeepButton({ id }: { id: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" formAction={keepPlan.bind(null, id)} disabled={pending} className="btn btn-primary min-h-11 px-5 text-sm">
      Keep this plan
    </button>
  );
}
