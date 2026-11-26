"use client";

import type { BuilderState } from "@/app/(app)/portfolio/steps";

/*
 * The newest state of the portfolio, kept round React (decision 0031, "The switch": the third way back),
 * so the crash fallback can send it even when the render that followed the change threw. The editor
 * notes every state here before it tells anyone of the change, and notes what the server has when a
 * save lands. This file is in the gate's own chunk (PortfolioGate.tsx imports it), so it imports nothing
 * of the editor's: the editor registers how to send.
 *
 * One editor is open at a time, and it edits the signed-in person's one portfolio, so there is one slot
 * (the exhbt editor's is kept by exhbt). Whatever an earlier visit left here is dropped when an editor
 * registers: it must never go out through a later visit's editor, which could be another person's.
 */

type Sender = {
  /** Sends a state through the editor's own save action; true when the server took it. */
  send(state: BuilderState): Promise<boolean>;
  /** Resolves when any save the editor has in flight has been answered. */
  settled(): Promise<void>;
};

let newest: BuilderState | null = null;
let serverHas: BuilderState | null = null;
let sender: Sender | null = null;

/** The editor's newest state, noted in every change before any part of the page is told. */
export function notePending(state: BuilderState): void {
  newest = state;
}

/** The server has this state: a save of it landed. */
export function noteSaved(state: BuilderState): void {
  serverHas = state;
}

/** Whether there is a state the server has not got. */
export function hasPending(): boolean {
  return newest !== null && newest !== serverHas;
}

/**
 * The editor says how to send a state and how to wait for a save in flight, and starts from the state
 * the page was loaded with (which the server has). Returns how to take it back.
 */
export function registerSender(s: Sender, loaded: BuilderState): () => void {
  sender = s;
  newest = loaded;
  serverHas = loaded;
  return () => {
    if (sender === s) sender = null;
  };
}

/** The longest flushPending waits. */
const WAIT_MS = 3000;
/** How long it gives an editor that is leaving the page to start its own last save. */
const LEAVING_MS = 50;

/**
 * Sends the newest state to the server if it has not got it; resolves when that lands or after three
 * seconds, whichever is first. It waits a moment first: an editor that is being taken off the page sends
 * what is waiting itself (useBuilder), and that save is let through before another is thought of, so the
 * same words are not sent twice and an older state cannot land after a newer one. The crash fallback in
 * PortfolioGate.tsx awaits it before it reloads into the step builder.
 */
export function flushPending(): Promise<void> {
  // Read now: the editor takes its sender back as it leaves the page.
  const s = sender;
  const work = (async () => {
    if (!s) return;
    await new Promise((done) => setTimeout(done, LEAVING_MS));
    await s.settled().catch(() => {});
    const n = newest;
    if (!n || n === serverHas) return;
    if (await s.send(n)) noteSaved(n);
  })().catch((e) => console.error("Sending the newest changes failed.", e));
  return Promise.race([work, new Promise<void>((done) => setTimeout(done, WAIT_MS))]);
}
