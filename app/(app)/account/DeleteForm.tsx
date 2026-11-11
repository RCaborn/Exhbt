"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { deleteAccount, type DeleteState } from "./actions";
import { Button } from "@/components/ui/Button";

export function DeleteForm() {
  const [state, action] = useActionState<DeleteState, FormData>(deleteAccount, undefined);
  return (
    <form action={action} className="mt-4 space-y-4">
      <label className="flex items-start gap-3">
        <input type="checkbox" name="confirm" value="yes" required className="mt-1.5 size-4 accent-error" />
        <span>I understand this deletes everything.</span>
      </label>
      {state?.error && (
        <p role="alert" className="text-error">
          {state.error}
        </p>
      )}
      <Submit />
    </form>
  );
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="danger" loading={pending}>
      {pending ? "Deleting…" : "Delete my account"}
    </Button>
  );
}
