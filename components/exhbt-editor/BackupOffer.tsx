"use client";

import { useCallback, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { clearBackup, readBackup, type Backup } from "@/components/editor/useAutosave";
import { Button } from "@/components/ui/Button";
import { normaliseDoc } from "@/lib/exhbt/blocks";
import { useEnv, useLive, useSave } from "./context";
import { useStoreInternal } from "./store";

/** Restore's undo entry: "Undo: restore the kept changes". */
export const RESTORE_LABEL = "restore the kept changes";

/** Whether `now` is the very copy `offered` (the same time and the same doc). */
const sameCopy = (now: Backup | null, offered: Backup) => Boolean(now && now.at === offered.at && JSON.stringify(now.doc) === JSON.stringify(offered.doc));

/**
 * A copy kept in this browser that is newer than the server's, offered back, as the classic editor does. Over the
 * page, under the top bar.
 *
 * The offer is for that one copy (the review's data-safety-3). It goes as soon as the doc changes, since the store then
 * writes the new doc over the copy, and as soon as the copy is gone or replaced: a save or a publish cleared it, or
 * another tab of this exhbt wrote its own. So "Restore them" can never put an older copy over work done since. Restore
 * is one undo entry, so Undo gives back what the server had (and the entry keeps any picture it took off the page).
 * "Discard them" takes the copy out only while it is still the one offered.
 */
export function BackupOffer(): ReactNode {
  const env = useEnv();
  const store = useStoreInternal();
  const save = useSave();
  const live = useLive();
  const [offer, setOffer] = useState<Backup | null>(() => {
    const b = readBackup(env.id);
    if (!b) return null;
    if (b.at > Date.parse(env.updatedAt) && JSON.stringify(b.doc) !== JSON.stringify(env.initialDoc)) return b;
    clearBackup(env.id);
    return null;
  });
  const [startedAt] = useState(() => store.version());
  const changed = useSyncExternalStore(
    store.subscribe,
    () => store.version() !== startedAt,
    () => false,
  );
  const stillKept = useCallback((o: Backup) => sameCopy(readBackup(env.id), o), [env.id]);

  // Looked at again after every save (a new status each time, even "Saved" again after a publish), every publish
  // (a new live status each time), and whenever another tab writes to storage: each may have cleared or replaced the copy.
  const saved = save.status;
  useEffect(() => {
    if (!offer) return;
    const check = () => {
      if (!stillKept(offer)) setOffer(null);
    };
    check();
    window.addEventListener("storage", check);
    return () => window.removeEventListener("storage", check);
  }, [offer, stillKept, saved, live]);

  if (!offer || changed) return null;
  return (
    <div role="status" className="xe-offer">
      <p className="font-semibold">We kept changes from {new Date(offer.at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} that never reached the server.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          variant="primary"
          size="sm"
          onClick={() => {
            // Kept in this browser, maybe in an older shape: read into the current one. Only while nothing has changed and it is still the copy offered.
            if (store.version() === startedAt && stillKept(offer)) store.patchDoc(() => normaliseDoc(offer.doc), RESTORE_LABEL);
            setOffer(null);
          }}
        >
          Restore them
        </Button>
        <Button
          size="sm"
          onClick={() => {
            // A copy written since (by another tab of this exhbt) is not the one offered: it stays.
            if (stillKept(offer)) clearBackup(env.id);
            setOffer(null);
          }}
        >
          Discard them
        </Button>
      </div>
    </div>
  );
}
