"use client";

import type { ReactNode } from "react";
import { Undo2 } from "lucide-react";
import { useAtom } from "@/components/exhbt-editor/atom";
import { Button } from "@/components/ui/Button";
import { useRuntime } from "../runtime";

/** The bar's heading: where the focus goes after an Undo that leaves nothing more to undo. */
export const HEADING_ID = "pe-heading";
/** Undo's own id: the focus stays here while Undo can still be pressed. */
export const UNDO_ID = "pe-undo";

/**
 * Undo, named for what it undoes ("Undo: removed Experience"), for the bar (decision 0031, "Undo"). It
 * is aria-disabled, not disabled, when there is nothing to undo, so it keeps the focus. Typing is never
 * a step: within a field the browser's own undo works. Ctrl or Cmd and Z does the same outside a text
 * field (PortfolioEditor.tsx). An Astryx Button, through the site's own.
 */
export function UndoButton(): ReactNode {
  const rt = useRuntime();
  const label = useAtom(rt.undo, (u) => u.label);
  const name = label ? `Undo: ${label}` : "Undo";
  return (
    <Button id={UNDO_ID} size="sm" className="pe-undo" label={name} {...(label ? {} : ({ "aria-disabled": true } as object))} onClick={() => rt.undoLast()}>
      <Undo2 aria-hidden size={16} strokeWidth={2.25} className="shrink-0" />
      <span>
        Undo
        {label && <span className="pe-undo-for">: {label}</span>}
      </span>
    </Button>
  );
}
