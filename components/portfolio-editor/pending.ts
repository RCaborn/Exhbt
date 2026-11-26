"use client";

import type { BuilderState } from "@/app/(app)/portfolio/steps";

/*
 * What this document knows of the portfolio's saves, kept round React (decision 0031, "The switch": the
 * third way back; "Saving"). Two things need it, and both sit in the gate, outside the editor:
 *
 *  - The crash fallback sends the newest state even when the render that followed the change threw. The
 *    editor notes every state here before it tells anyone of the change, and notes what the server has
 *    when a save lands.
 *  - The editor's save does not revalidate the page (it would draw the page again under the cursor), so
 *    when the browser's Back returns to /portfolio, Next can hand the gate the data the page was first
 *    loaded with. An editor mounted on it would show old words and save them over the newer ones with
 *    its next key. So the time of the newest save that landed is kept here, and the gate will not mount
 *    an editor on data loaded before it (`isBehind`).
 *
 * This file is in the gate's own chunk (PortfolioGate.tsx imports it), so it imports nothing of the
 * editor's: the editor registers how to send. One editor is open at a time, on the signed-in person's
 * one portfolio, so there is one slot. Everything in it is kept with the person it belongs to (`owner`)
 * and is never read for anyone else: an earlier visit's words must not reach a later visit that could
 * be another person's.
 */

type Sender = {
  /** Sends a state through the editor's own save action; true when the server took it. */
  send(state: BuilderState): Promise<boolean>;
};

let owner: string | null = null;
let newest: BuilderState | null = null;
let serverHas: BuilderState | null = null;
/** The server's own time of the newest save that landed from this document. */
let savedAt: string | null = null;
/** This browser's own clock when that save's answer came: only for how long to wait, never compared with a server's time. */
let savedHereAt = 0;
let sender: Sender | null = null;
/** Saves on their way: the gate and the crash fallback wait for them. */
let sending = 0;
let settled: Promise<void> = Promise.resolve();

/** The editor's newest state, noted in every change before any part of the page is told. */
export function notePending(state: BuilderState): void {
  newest = state;
}

/** The server has this state: a save of it landed, at the server's time `at`. */
export function noteSaved(state: BuilderState, at?: string): void {
  serverHas = state;
  if (at && (!savedAt || at > savedAt)) {
    savedAt = at;
    savedHereAt = Date.now();
  }
}

/** A save is on its way: until it is answered, nobody is to think the server is up to date. */
export function noteSending(save: Promise<unknown>): void {
  sending++;
  const done = save.then(
    () => {},
    () => {},
  );
  settled = done.finally(() => void sending--);
}

/** Resolves once no save is on its way (one that ends may start the next: the newest state always follows). */
export async function settledSaves(): Promise<void> {
  // A turn first: an editor that is leaving the page starts its own last save as it goes (useBuilder).
  await new Promise((done) => setTimeout(done, LEAVING_MS));
  while (sending > 0) await settled;
}

/** Whether there is a state the server has not got. */
export function hasPending(): boolean {
  return newest !== null && newest !== serverHas;
}

/**
 * How far two server instances' clocks may differ before old words could come back. `loadedAt` and
 * `savedAt` are each stamped by whichever instance answered, so a load is trusted only when it is newer
 * than the newest landed save by more than this. Beyond it, a load made before the save on an instance
 * whose clock is ahead by more than SKEW_MS would pass as newer: the known limit, until the store gives a
 * counter from one source (docs/briefs/portfolio-first/e-handover.md, "The Back fix's limit").
 */
export const SKEW_MS = 2000;

/**
 * Why data loaded at `loadedAt` may not be the newest, from the server's two times alone (pure, for the
 * in-process tests): "saving", a save is on its way; "older", it was loaded at or before the newest
 * landed save; "margin", after it, but by no more than SKEW_MS, so a clock that is ahead could explain
 * it; "fresh", newer by more than that.
 */
export function staleness(loadedAt: string, saved: string | null, onTheirWay: number): "fresh" | "saving" | "older" | "margin" {
  if (onTheirWay > 0) return "saving";
  if (saved === null) return "fresh";
  const load = Date.parse(loadedAt);
  const save = Date.parse(saved);
  if (load <= save) return "older";
  return load <= save + SKEW_MS ? "margin" : "fresh";
}

/** `staleness` for `who`, with what this document knows. Anyone else's data is never behind this document's saves. */
export function behind(who: string, loadedAt: string): "fresh" | "saving" | "older" | "margin" {
  if (owner !== who) return "fresh";
  return staleness(loadedAt, savedAt, sending);
}

/**
 * Whether data loaded at the server's time `loadedAt` may be older than what this document has saved for
 * `who` (`behind`, above, is not "fresh"). The gate asks before it mounts an editor.
 */
export function isBehind(who: string, loadedAt: string): boolean {
  return behind(who, loadedAt) !== "fresh";
}

/**
 * How long until a load asked for now is sure to be past the margin: SKEW_MS after the newest save's
 * answer came, on this browser's own clock. 0 when that has passed. Only ever a delay.
 */
export function marginLeft(): number {
  return savedAt === null ? 0 : Math.max(0, savedHereAt + SKEW_MS - Date.now());
}

/** The newest state this document had for `who`, for the loading view to draw while newer data is fetched. Null for anyone else. */
export function lastState(who: string): BuilderState | null {
  return owner === who ? newest : null;
}

/**
 * The editor says how to send a state, for `who`, starting from the state the page was loaded with
 * (which the server has). Whatever was here for someone else is dropped. Returns how to take it back.
 */
export function registerSender(s: Sender, who: string, loaded: BuilderState): () => void {
  if (owner !== who) savedAt = null;
  owner = who;
  sender = s;
  newest = loaded;
  serverHas = loaded;
  return () => {
    if (sender === s) sender = null;
  };
}

/** The longest flushPending waits. */
const WAIT_MS = 3000;
/** How long an editor that is leaving the page is given to start its own last save. */
const LEAVING_MS = 50;

/**
 * Sends the newest state to the server if it has not got it; resolves when that lands or after three
 * seconds, whichever is first. It lets the editor's own saves through first (one on its way, and the
 * one an editor sends as it is taken off the page), so the same words are not sent twice and an older
 * state cannot land after a newer one. The crash fallback in PortfolioGate.tsx awaits it before it
 * reloads into the step builder.
 */
export function flushPending(): Promise<void> {
  // Read now: the editor takes its sender back as it leaves the page.
  const s = sender;
  const work = (async () => {
    if (!s) return;
    await settledSaves();
    const n = newest;
    if (!n || n === serverHas) return;
    if (await s.send(n)) noteSaved(n);
  })().catch((e) => console.error("Sending the newest changes failed.", e));
  return Promise.race([work, new Promise<void>((done) => setTimeout(done, WAIT_MS))]);
}
