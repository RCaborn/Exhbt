"use client";

import { forgetBrowserCopies } from "@/components/editor/useAutosave";
import { Button } from "@/components/ui/Button";

/**
 * Delete account, a plain form to POST /api/account/delete. As it goes, every copy the editor kept in this browser
 * (each exhbt's unsent changes) and the editor's own keys are taken out of storage (the review's security-2): the
 * account and its exhbts are going, and the browser may be a shared one.
 */
export function DeleteAccountForm() {
  return (
    <form action="/api/account/delete" method="post" className="mt-4 space-y-4" onSubmit={() => void forgetBrowserCopies()}>
      <label className="flex items-start gap-3">
        <input type="checkbox" name="confirm" value="yes" required className="mt-1.5 size-4 accent-error" />
        <span>I understand this deletes everything.</span>
      </label>
      <Button type="submit" variant="danger">
        Delete my account
      </Button>
    </form>
  );
}
