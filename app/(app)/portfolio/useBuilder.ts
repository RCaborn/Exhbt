"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * The portfolio builder's state and its saving (decisions 0014 and 0016). Generic over the state, so
 * the builder holds the "You" fields and the arrangement in one object with one status line.
 *
 *  - Every change shows at once (the state is updated before anything is sent).
 *  - Saving is debounced: about half a second after the last change, and at once when the tab is
 *    hidden or the page is left. One save at a time, always of the newest state, so an older
 *    request can't land after a newer one.
 *  - A state the rules refuse (`problemOf`: a quote over its word cap, an address that isn't https)
 *    is not sent; the status says so and the field shows what to fix. Everything else waits with it.
 *  - The last structural change can be undone: the whole state before it comes back and saves.
 *    Typing into a field is not a change to undo; it is just edited.
 *  - A failed save keeps the state on screen and says so; the next change, or "Try again", sends it.
 */

export type SaveStatus =
  | { kind: "saved" }
  | { kind: "pending" }
  | { kind: "saving" }
  | { kind: "invalid"; message: string }
  | { kind: "error"; message: string };

const SAVE_AFTER_MS = 600;

type SaveResult = { ok: true } | { ok: false; error: string };

export function useBuilder<T>(initial: T, save: (state: T) => Promise<SaveResult>, problemOf: (state: T) => string | null | undefined) {
  const [state, setState] = useState(initial);
  const [status, setStatus] = useState<SaveStatus>({ kind: "saved" });
  const [undoable, setUndoable] = useState<{ label: string; state: T } | null>(null);
  const undoRef = useRef(undoable);
  const latest = useRef(initial);
  const saved = useRef(initial);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const running = useRef(false);
  const saveRef = useRef(save);
  saveRef.current = save;
  const problemRef = useRef(problemOf);
  problemRef.current = problemOf;
  const flushRef = useRef<() => Promise<void>>(async () => {});

  flushRef.current = async () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    if (running.current) return; // the save in flight looks again when it ends
    if (latest.current === saved.current) {
      setStatus({ kind: "saved" });
      return;
    }
    const sending = latest.current;
    const first = problemRef.current(sending);
    if (first) {
      setStatus({ kind: "invalid", message: first });
      return;
    }
    running.current = true;
    setStatus({ kind: "saving" });
    let result: SaveResult;
    try {
      result = await saveRef.current(sending);
    } catch {
      result = { ok: false, error: "We couldn't reach the server. Check your connection and try again." };
    }
    running.current = false;
    if (!result.ok) {
      setStatus({ kind: "error", message: result.error });
      return;
    }
    saved.current = sending;
    if (latest.current !== sending) void flushRef.current();
    else setStatus({ kind: "saved" });
  };

  const schedule = useCallback(() => {
    setStatus((s) => (s.kind === "saving" ? s : { kind: "pending" }));
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flushRef.current(), SAVE_AFTER_MS);
  }, []);

  /** Applies a change. Give `undo` (a short past-tense phrase) for a change the person can take back. */
  const change = useCallback(
    (update: (s: T) => T, undo?: string) => {
      const before = latest.current;
      const next = update(before);
      if (next === before) return;
      if (undo) {
        undoRef.current = { label: undo, state: before };
        setUndoable(undoRef.current);
      }
      latest.current = next;
      setState(next);
      schedule();
    },
    [schedule],
  );

  const undo = useCallback(() => {
    const u = undoRef.current;
    if (!u) return;
    undoRef.current = null;
    setUndoable(null);
    latest.current = u.state;
    setState(u.state);
    schedule();
  }, [schedule]);

  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") void flushRef.current();
    };
    const onLeave = (e: BeforeUnloadEvent) => {
      if (latest.current !== saved.current) e.preventDefault();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("beforeunload", onLeave);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("beforeunload", onLeave);
      // Leaving the page (a link inside the app): send what is waiting.
      if (latest.current !== saved.current) void flushRef.current();
    };
  }, []);

  return { state, status, change, undo, undoable, retry: () => void flushRef.current() };
}
