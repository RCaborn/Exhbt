"use client";

import type { ExhbtDoc } from "@/lib/exhbt/blocks";

/*
 * The newest doc, kept round React (decision 0026, "Saving"), so the crash fallback can send it even
 * when the render that followed the change threw. The editor's store notes every doc here before it
 * tells anyone of the change; autosave notes what the server has. This file is in the gate's own chunk
 * (EditorGate.tsx imports it), so it imports nothing of the editor's: the editor registers how to send.
 */

type Sender = { send(doc: ExhbtDoc): Promise<boolean>; settled(): Promise<void> };

let newest: ExhbtDoc | null = null;
let serverHas: ExhbtDoc | null = null;
let sender: Sender | null = null;

/** The store's newest doc, noted in every change before any subscriber is told. */
export function notePending(doc: ExhbtDoc): void {
  newest = doc;
}

/** The server has this doc (a save or a publish landed). */
export function noteSaved(doc: ExhbtDoc): void {
  serverHas = doc;
}

/** The editor says how to send a doc and how to wait for a save in flight. Returns how to take it back. */
export function registerSender(s: Sender): () => void {
  sender = s;
  return () => {
    if (sender === s) sender = null;
  };
}

/** The longest flushPending waits. */
const WAIT_MS = 3000;

/**
 * Sends the newest doc to the server if it has not got it; resolves when that lands or after three seconds,
 * whichever is first. A save already in flight is waited for first, so an older doc cannot land after this one.
 * The crash fallback in EditorGate.tsx awaits it before it reloads into the classic editor.
 */
export function flushPending(): Promise<void> {
  const work = (async () => {
    const s = sender;
    if (!s) return;
    await s.settled().catch(() => {});
    const doc = newest;
    if (!doc || doc === serverHas) return;
    if (await s.send(doc)) noteSaved(doc);
  })().catch((e) => console.error("Sending the newest changes failed; they are kept in this browser.", e));
  return Promise.race([work, new Promise<void>((done) => setTimeout(done, WAIT_MS))]);
}
