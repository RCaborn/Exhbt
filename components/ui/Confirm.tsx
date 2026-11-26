"use client";

import { useState } from "react";
import { AlertDialog } from "@astryxdesign/core/AlertDialog";

const DEFAULT_BODY = "This cannot be undone.";
const FAILED = "That did not work, so nothing is confirmed. Try again, or close this.";

/** Astryx AlertDialog for something that cannot be undone. The confirm button is the only destructive button on the screen. If `onConfirm` throws, the dialog stays open and says so. */
export function Confirm({
  open,
  onOpenChange,
  title,
  body,
  confirmLabel,
  onConfirm,
}: {
  open: boolean;
  onOpenChange(open: boolean): void;
  title: string;
  body?: string;
  confirmLabel: string;
  onConfirm(): void | Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  return (
    <AlertDialog
      isOpen={open}
      onOpenChange={(next) => {
        if (!next) setFailed(false);
        onOpenChange(next);
      }}
      title={title}
      // Astryx needs a description to tie to the dialog. A failure replaces it, so it is what is read out.
      description={failed ? FAILED : (body ?? DEFAULT_BODY)}
      actionLabel={confirmLabel}
      isActionLoading={busy}
      onAction={async () => {
        setBusy(true);
        setFailed(false);
        try {
          await onConfirm();
          onOpenChange(false);
        } catch {
          // Stay open, so nothing looks done when it was not.
          setFailed(true);
        } finally {
          setBusy(false);
        }
      }}
    />
  );
}
