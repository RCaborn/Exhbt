"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { startRoadmapForJob, type NewJobState } from "./actions";
import { UpgradePrompt } from "@/components/site/UpgradePrompt";
import { Button } from "@/components/ui/Button";

/** Just the job. The rest of the details come from the person's newest roadmap (startRoadmapForJob). */
export function NewJobForm() {
  const [state, action] = useActionState<NewJobState, FormData>(startRoadmapForJob, undefined);
  // Marks the form once the page is interactive (tests wait for it). The button is never disabled:
  // a greyed-out label is hard to read, and the browser's own "required" check explains an empty field.
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  return (
    <form action={action} data-ready={ready ? "true" : undefined} className="mt-6">
      <label htmlFor="newJob" className="label">
        The new job you want
      </label>
      <div className="flex flex-wrap items-start gap-3">
        <input
          id="newJob"
          name="targetRole"
          required
          minLength={2}
          maxLength={300}
          placeholder="e.g. Product manager"
          aria-invalid={state?.fieldError ? true : undefined}
          aria-describedby={state?.fieldError ? "newJob-error" : undefined}
          className="field min-w-[14rem] flex-1"
        />
        <Submit />
      </div>
      {state?.fieldError && (
        <p id="newJob-error" className="mt-2 text-sm text-error">
          {state.fieldError}
        </p>
      )}
      {state?.limit ? (
        <UpgradePrompt reason={state.error ?? ""} upgradeTo={state.limit.upgradeTo} tone="alert" className="mt-4" />
      ) : (
        state?.error && (
          <p role="alert" className="mt-4 text-error">
            {state.error}
          </p>
        )
      )}
    </form>
  );
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" loading={pending}>
      {pending ? "Starting…" : "Build this roadmap"}
    </Button>
  );
}
