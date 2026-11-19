"use client";

/*
 * Formatted fields' editors are made one at a time in idle moments after the page is up (decision
 * 0026, "Typing in the page's own type"), so a dozen Tiptap editors never start in one frame. A field
 * the person clicks starts at once, outside this queue. Each job resolves when its editor is ready, and
 * only then does the next one start.
 */

type Job = { start(): Promise<void>; done: boolean };

const queue: Job[] = [];
let running = false;
let open = false;

type Idle = (cb: () => void, opts?: { timeout: number }) => void;
const whenIdle: Idle = (cb, opts) => {
  const ric = (window as unknown as { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number }).requestIdleCallback;
  if (ric) ric(cb, opts);
  else setTimeout(cb, 50);
};

function pump() {
  if (!open || running) return;
  const job = queue.shift();
  if (!job) return;
  running = true;
  whenIdle(
    () => {
      const finish = () => {
        running = false;
        pump();
      };
      if (job.done) return finish();
      job.done = true;
      // A job that never says it is ready does not hold the queue up for long.
      void Promise.race([job.start(), new Promise<void>((r) => setTimeout(r, 1500))]).finally(finish);
    },
    { timeout: 1500 },
  );
}

/** Puts a field's editor in the queue. Returns how to take it out (the field went, or was started by the person). */
export function enqueueEditor(start: () => Promise<void>): () => void {
  const job: Job = { start, done: false };
  queue.push(job);
  pump();
  return () => {
    job.done = true;
    const i = queue.indexOf(job);
    if (i >= 0) queue.splice(i, 1);
  };
}

/** The page is up: the queue may start. */
export function openEditorQueue() {
  open = true;
  pump();
}

/** The editor is going: nothing more starts. */
export function closeEditorQueue() {
  open = false;
  queue.length = 0;
  running = false;
}
