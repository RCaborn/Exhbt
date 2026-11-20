"use client";

import type { ExhbtDoc } from "@/lib/exhbt/blocks";

/*
 * The newest doc, kept round React (decision 0026, "Saving"), so the crash fallback can send it even
 * when the render that followed the change threw. The editor's store notes every doc here before it
 * tells anyone of the change; autosave notes what the server has. This file is in the gate's own chunk
 * (EditorGate.tsx imports it), so it imports nothing of the editor's: the editor registers how to send.
 *
 * Everything here is kept by exhbt: editors are reached by links in one page, so the doc an earlier
 * visit left unsent must never go through a later visit's editor, which saves another exhbt.
 */

type Sender = { id: string; send(doc: ExhbtDoc): Promise<boolean>; settled(): Promise<void> };

let newest: { id: string; doc: ExhbtDoc } | null = null;
let serverHas: { id: string; doc: ExhbtDoc } | null = null;
let sender: Sender | null = null;

/** The store's newest doc of exhbt `id`, noted in every change before any subscriber is told. */
export function notePending(doc: ExhbtDoc, id: string): void {
  newest = { id, doc };
}

/** The server has this doc (a save or a publish landed), of exhbt `id`: by default the one whose editor is open. */
export function noteSaved(doc: ExhbtDoc, id: string | undefined = sender?.id ?? newest?.id): void {
  if (id) serverHas = { id, doc };
}

/** The editor of exhbt `s.id` says how to send a doc and how to wait for a save in flight. Returns how to take it back. */
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
 * whichever is first. Only the editor of the same exhbt sends it, after any save of its own in flight, so an
 * older doc cannot land after this one. The crash fallback in EditorGate.tsx awaits it before it reloads
 * into the classic editor.
 */
export function flushPending(): Promise<void> {
  const work = (async () => {
    const s = sender;
    if (!s) return;
    await s.settled().catch(() => {});
    const n = newest;
    if (!n || n.id !== s.id) return;
    if (serverHas && serverHas.id === n.id && serverHas.doc === n.doc) return;
    if (await s.send(n.doc)) noteSaved(n.doc, n.id);
  })().catch((e) => console.error("Sending the newest changes failed; they are kept in this browser.", e));
  return Promise.race([work, new Promise<void>((done) => setTimeout(done, WAIT_MS))]);
}
