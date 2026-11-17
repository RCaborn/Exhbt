"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { toggleSavedIdea } from "@/app/(app)/roadmap/saved/actions";
import { UpgradePrompt } from "@/components/site/UpgradePrompt";
import { Button } from "@/components/ui/Button";
import type { Plan } from "@/lib/entitlements";

/** What the Projects view knows about saving ideas (left out when signed out or Phase 2 is off). */
export type SaveState =
  | { state: "ok"; /** Titles of this roadmap's ideas already on the person's saved list. */ saved: string[] }
  | { state: "locked"; reason: string; upgradeTo?: Plan };

/**
 * The star on a project idea. On a plan with saved ideas it saves a copy to the list (and takes
 * it off again). On Free it is a locked control: pressing it shows the upgrade offer instead.
 * `inForm` is for ideas drawn inside another form (the plan editor), where a nested form isn't allowed.
 */
export function SaveIdea({
  save,
  roadmapId,
  ideaId,
  title,
  inForm = false,
}: {
  save: SaveState;
  roadmapId: string;
  ideaId: string;
  title: string;
  inForm?: boolean;
}) {
  const [open, setOpen] = useState(false);

  if (save.state === "locked") {
    return (
      <>
        <Button size="sm" label={`Save idea: ${title} (locked)`} onClick={() => setOpen((o) => !o)}>
          <Star aria-hidden size={15} strokeWidth={2.25} />
          Save idea
        </Button>
        {open && <UpgradePrompt reason={save.reason} upgradeTo={save.upgradeTo} primary={false} className="basis-full" />}
      </>
    );
  }

  const saved = save.saved.includes(title);
  const action = toggleSavedIdea.bind(null, roadmapId, ideaId);
  const label = saved ? `Saved: ${title}. Remove from saved ideas` : `Save idea: ${title}`;
  const body = (
    <Button type="submit" size="sm" formAction={inForm ? action : undefined} label={label}>
      <Star aria-hidden size={15} strokeWidth={2.25} fill={saved ? "currentColor" : "none"} />
      {saved ? "Saved" : "Save idea"}
    </Button>
  );
  return inForm ? body : <form action={action}>{body}</form>;
}
