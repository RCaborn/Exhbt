"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { Undo2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useUi } from "../context";
import { useStore } from "../store";

export const HEADING_ID = "xe-heading";

/**
 * Undo, named for what it undoes ("Undo: remove graph 1"). It is aria-disabled, not disabled, when there
 * is nothing to undo, so it keeps the focus. After an Undo the focus goes to the first field of the
 * section brought back or moved (a flowchart box's words for a box); with none, it stays here while Undo
 * can still be pressed, and otherwise goes to the heading (decision 0026, "Undo"). The shell moves it, in
 * the same frame, for this button and for Ctrl+Z alike (EditorShell.tsx, UndoKeys).
 */
export function UndoButton(): ReactNode {
  const store = useStore();
  const ui = useUi();
  const label = useSyncExternalStore(store.subscribe, store.undoLabel, store.undoLabel);
  const name = label ? `Undo: ${label}` : "Undo";

  function undo() {
    if (!store.undoLabel()) return;
    ui.say(store.undo().words);
  }

  return (
    <Button
      id="xe-undo"
      size="sm"
      className="xe-tb xe-undo-button"
      label={name}
      {...(label ? {} : ({ "aria-disabled": true } as object))}
      onClick={() => undo()}
    >
      <Undo2 aria-hidden size={16} strokeWidth={2.25} className="shrink-0" />
      <span className="xe-undo-text">
        <span className="xe-tb-text">Undo</span>
        {label && <span className="xe-undo-for">: {label}</span>}
      </span>
    </Button>
  );
}
