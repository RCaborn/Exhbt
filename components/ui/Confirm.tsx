"use client";

import { useState } from "react";
import { AlertDialog } from "@astryxdesign/core/AlertDialog";

/** Astryx AlertDialog for something that cannot be undone. The confirm button is the only destructive button on the screen. */
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
  return (
    <AlertDialog
      isOpen={open}
      onOpenChange={onOpenChange}
      title={title}
      description={body ?? ""}
      actionLabel={confirmLabel}
      isActionLoading={busy}
      onAction={async () => {
        setBusy(true);
        try {
          await onConfirm();
          onOpenChange(false);
        } finally {
          setBusy(false);
        }
      }}
    />
  );
}
