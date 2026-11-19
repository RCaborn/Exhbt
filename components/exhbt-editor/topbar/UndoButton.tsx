"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { Undo2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useUi } from "../context";
import { useStore, useStoreInternal } from "../store";

/** Where the cursor goes in a section brought back: the first thing in it that takes typing. */
const FIELD = 'textarea, input:not([type=file]):not([type=hidden]), [contenteditable]:not([contenteditable="false"]), [role=textbox]';

export const HEADING_ID = "xe-heading";

/**
 * Undo, named for what it undoes ("Undo: remove graph 1"). It is aria-disabled, not disabled, when there
 * is nothing to undo, so it keeps the focus. After an Undo the focus goes to the first field of the
 * section brought back or moved; with none, it stays here while Undo can still be pressed, and otherwise
 * goes to the heading (decision 0026, "Undo").
 */
export function UndoButton(): ReactNode {
  const store = useStore();
  const internal = useStoreInternal();
  const ui = useUi();
  const label = useSyncExternalStore(store.subscribe, store.undoLabel, store.undoLabel);
  const name = label ? `Undo: ${label}` : "Undo";

  function undo() {
    const was = store.undoLabel();
    if (!was) return;
    let subject: string | null = null;
    const off = internal.onUndone((s) => (subject = s));
    store.undo();
    off();
    ui.say(`Undone: ${was}.`);
    requestAnimationFrame(() => {
      const frame = subject ? document.querySelector<HTMLElement>(`[data-editor="page"] [data-section-id="${CSS.escape(subject)}"]`) : null;
      const target = frame?.querySelector<HTMLElement>(FIELD);
      if (target) return target.focus();
      if (frame) {
        if (!frame.hasAttribute("tabindex")) frame.tabIndex = -1;
        return frame.focus();
      }
      if (store.undoLabel()) document.getElementById("xe-undo")?.focus();
      else document.getElementById(HEADING_ID)?.focus();
    });
  }

  return (
    <Button
      id="xe-undo"
      size="sm"
      className="xe-tb"
      label={name}
      {...(label ? {} : ({ "aria-disabled": true } as object))}
      onClick={() => undo()}
    >
      <Undo2 aria-hidden size={16} strokeWidth={2.25} className="shrink-0" />
      <span className="xe-tb-text">Undo</span>
      {label && <span className="xe-undo-for">: {label}</span>}
    </Button>
  );
}
