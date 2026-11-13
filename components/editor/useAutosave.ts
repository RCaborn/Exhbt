"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ExhbtDoc } from "@/lib/exhbt/blocks";

/**
 * Autosave that can't lose work (docs/phase-2.md section 6):
 *  - saves about 1.5 s after the last change, and at once when the tab is hidden or focus leaves the editor;
 *  - one save at a time, always of the newest doc, so an older request can't land after a newer one;
 *  - a save that fails to reach the server is tried 3 times, with a pause between; after that the
 *    state is "error" and stays so until a save works (the person can press Retry, or just keep typing);
 *  - every change is also kept in this browser (localStorage, per exhbt) until the server has it,
 *    and offered back on the next visit if it is newer than the server's copy;
 *  - `beforeunload` asks before leaving while anything is unsaved.
 * Sequence numbers: each change gets the next number, and a response only marks the doc "saved"
 * if no newer change has been made since the request went out.
 */

export type SaveState = "saved" | "waiting" | "saving" | "retrying" | "error";
export type SaveResult = { ok: true } | { ok: false; error: string };

const SAVE_AFTER_MS = 1500;
const TRIES = 3;
const BACKOFF_MS = [800, 1600];

const key = (id: string) => `exhbt-backup:${id}`;

export type Backup = { doc: ExhbtDoc; at: number };

export function readBackup(id: string): Backup | null {
  try {
    const raw = window.localStorage.getItem(key(id));
    if (!raw) return null;
    const b = JSON.parse(raw) as Backup;
    return b && typeof b.at === "number" && b.doc && typeof b.doc === "object" ? b : null;
  } catch {
    return null;
  }
}
function writeBackup(id: string, doc: ExhbtDoc) {
  try {
    window.localStorage.setItem(key(id), JSON.stringify({ doc, at: Date.now() } satisfies Backup));
  } catch {
    // Private window or full storage: the server copy is still the one that counts.
  }
}
export function clearBackup(id: string) {
  try {
    window.localStorage.removeItem(key(id));
  } catch {
    // Nothing to clear.
  }
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function useAutosave({
  id,
  doc,
  initial,
  save,
  onSavedDoc,
}: {
  id: string;
  doc: ExhbtDoc;
  /** The doc as the server gave it; no save until the doc differs from it. */
  initial: ExhbtDoc;
  save: (doc: ExhbtDoc) => Promise<SaveResult>;
  onSavedDoc?: (doc: ExhbtDoc) => void;
}) {
  const [state, setState] = useState<{ state: SaveState; error?: string }>({ state: "saved" });
  const docRef = useRef(doc);
  const lastSaved = useRef(initial);
  const editSeq = useRef(0);
  const running = useRef<Promise<void> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveRef = useRef(save);
  saveRef.current = save;
  const onSavedRef = useRef(onSavedDoc);
  onSavedRef.current = onSavedDoc;
  docRef.current = doc;

  const dirty = () => docRef.current !== lastSaved.current;

  const drain = useCallback(async () => {
    while (dirty()) {
      const snapshot = docRef.current;
      const seq = editSeq.current;
      let ok = false;
      let error = "";
      for (let attempt = 0; attempt < TRIES; attempt++) {
        setState({ state: attempt === 0 ? "saving" : "retrying" });
        try {
          const r = await saveRef.current(snapshot);
          if (r.ok) {
            ok = true;
          } else {
            // The server said no (not a dropped connection): trying again won't change the answer.
            error = r.error;
            attempt = TRIES;
          }
          if (ok) break;
        } catch {
          error = "Couldn't reach the server.";
          if (attempt < TRIES - 1) await wait(BACKOFF_MS[attempt] ?? 1600);
        }
      }
      if (!ok) {
        setState({ state: "error", error });
        return;
      }
      lastSaved.current = snapshot;
      onSavedRef.current?.(snapshot);
      if (seq === editSeq.current) {
        clearBackup(id);
        setState({ state: "saved" });
      } else {
        // Edited while that request was out: the loop saves the newer doc next.
        setState({ state: "waiting" });
      }
    }
  }, [id]);

  const run = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    if (running.current) return running.current;
    const p = drain().finally(() => {
      running.current = null;
    });
    running.current = p;
    return p;
  }, [drain]);

  // A change: keep it here at once, save it soon.
  useEffect(() => {
    if (doc === lastSaved.current) return;
    editSeq.current += 1;
    writeBackup(id, doc);
    setState((s) => (s.state === "saving" || s.state === "retrying" ? s : { state: "waiting" }));
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void run(), SAVE_AFTER_MS);
  }, [doc, id, run]);

  // Save at once when the tab is hidden or the page is going away; when focus leaves the editor (see `onBlur`).
  useEffect(() => {
    const flush = () => {
      if (dirty()) void run();
    };
    const hidden = () => document.visibilityState === "hidden" && flush();
    document.addEventListener("visibilitychange", hidden);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", hidden);
      window.removeEventListener("pagehide", flush);
      if (timer.current) clearTimeout(timer.current);
      // Leaving the editor inside the app: send what's waiting rather than drop it.
      flush();
    };
  }, [run]);

  // Leaving with unsaved changes asks first.
  useEffect(() => {
    if (state.state === "saved") return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [state.state]);

  return {
    status: state,
    /** Save now if there is anything to save (Retry, blur). */
    flush: () => (dirty() ? run() : Promise.resolve()),
    /** Resolves when no save is running. Publishing waits on this so a late autosave can't land after it. */
    settled: () => running.current ?? Promise.resolve(),
    /** The server already holds this doc (publishing saves it too). */
    markSaved: (d: ExhbtDoc) => {
      lastSaved.current = d;
      if (d === docRef.current) {
        clearBackup(id);
        setState({ state: "saved" });
      }
    },
  };
}
