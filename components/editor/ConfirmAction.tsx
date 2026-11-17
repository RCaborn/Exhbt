"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

/**
 * A button that asks once before it acts (delete, unpublish). The second step is a plain
 * question beside the button, not a pop-up, so it works the same for keyboards and readers.
 */
export function ConfirmAction({
  label,
  question,
  confirmLabel,
  action,
  variant = "secondary",
  accessibleLabel,
}: {
  label: string;
  question: string;
  confirmLabel: string;
  action: () => void | Promise<void>;
  variant?: "secondary" | "danger";
  /** When the visible label needs more context for a screen reader, e.g. which exhbt. */
  accessibleLabel?: string;
}) {
  const [asking, setAsking] = useState(false);
  const [pending, setPending] = useState(false);
  if (!asking) {
    return (
      <Button size="sm" variant={variant} label={accessibleLabel ?? label} onClick={() => setAsking(true)}>
        {label}
      </Button>
    );
  }
  return (
    <span role="group" aria-label={question} className="inline-flex flex-wrap items-center gap-2">
      <span className="text-sm font-semibold">{question}</span>
      <Button
        size="sm"
        variant="danger"
        loading={pending}
        disabled={pending}
        label={confirmLabel}
        onClick={async () => {
          setPending(true);
          try {
            await action();
          } finally {
            setPending(false);
            setAsking(false);
          }
        }}
      >
        {confirmLabel}
      </Button>
      <Button size="sm" onClick={() => setAsking(false)}>
        Cancel
      </Button>
    </span>
  );
}
