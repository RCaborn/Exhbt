"use client";

import { useState, type ReactNode } from "react";
import { Notice } from "@/components/ui/Notice";
import { useEnv } from "../context";
import { HEADING_ID } from "./UndoButton";

/** What a first AI draft says, once (brief 5b). Also read out with the layout line (LayoutMenu.tsx, useDraftedLine). */
export const FIRST_DRAFT_TITLE = "Here's your first draft.";
export const FIRST_DRAFT_WORDS = "We wrote it from your files and nothing else. Click any part to change it, check each number, then press Review and publish.";

/**
 * Under the bar, once for each AI draft (decision 0033, "Every screen says what it is for and what happens next").
 * "Once" is kept with nothing stored: the draft page opens the editor with ?drafted=... on the address, the gate
 * passes it on as `env.drafted`, and useDraftedLine takes it off the address. A reload, or an exhbt opened from
 * the list, has none, so there is no notice. Closing it puts the focus on the bar's heading.
 * Chrome, not the page: it is drawn by the bar, outside the article, in the app's tokens through the kit's Notice.
 * It is not a live region (live="off"): its words are said once through the editor's own region, with the layout line.
 */
export function FirstDraftNotice(): ReactNode {
  const { drafted } = useEnv();
  const [open, setOpen] = useState(true);
  if (!drafted || !open) return null;
  return (
    // The notice's only button is its close button (the kit's Notice has no close callback, so the click is read here).
    <div
      data-first-draft
      className="xe-first-draft"
      onClick={(e) => {
        if (!(e.target as Element).closest("button")) return;
        setOpen(false);
        requestAnimationFrame(() => document.getElementById(HEADING_ID)?.focus());
      }}
    >
      <Notice status="info" title={FIRST_DRAFT_TITLE} live="off" container="section" dismissable>
        {FIRST_DRAFT_WORDS}
      </Notice>
    </div>
  );
}
