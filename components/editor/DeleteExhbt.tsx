"use client";

import { unstable_rethrow } from "next/navigation";
import { ConfirmAction } from "./ConfirmAction";
import { forgetBrowserCopies } from "./useAutosave";

/**
 * "Delete it for good?", asked once (ConfirmAction), for every place an exhbt is deleted from: the new editor's
 * menu, the classic editor and the list of exhbts. This browser's copy of the exhbt (the unsent-changes backup)
 * goes with it (the review's security-2). `action` is the server action, which sends the page to the list when the
 * delete works; if it fails instead, the copy is put back, so nothing unsent is lost.
 */
export function DeleteExhbt({ id, action, label = "Delete this exhbt", accessibleLabel }: { id: string; action: () => Promise<unknown>; label?: string; accessibleLabel?: string }) {
  return (
    <ConfirmAction
      label={label}
      accessibleLabel={accessibleLabel}
      variant="danger"
      question="Delete it for good?"
      confirmLabel="Yes, delete"
      action={async () => {
        const putBack = forgetBrowserCopies(id);
        try {
          await action();
        } catch (e) {
          // Next's redirect to the list means it worked: the copy stays gone.
          unstable_rethrow(e);
          putBack();
          throw e;
        }
      }}
    />
  );
}
