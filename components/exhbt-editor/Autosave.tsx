"use client";

import { createContext, useContext, useEffect, useRef } from "react";
import { unstable_isUnrecognizedActionError } from "next/navigation";
import { saveDraft } from "@/app/(app)/exhbts/[id]/actions";
import { useAutosave, type SaveResult } from "@/components/editor/useAutosave";
import type { ExhbtDoc } from "@/lib/exhbt/blocks";
import { STALE_EDITOR, useRuntime, type SaveApi } from "./context";
import { noteSaved, registerSender } from "./pending";
import { useFilesController, type FilesController } from "./files";
import { useDoc } from "./store";

/*
 * Autosave for the edit-on-page editor (decision 0026, "Saving"): components/editor/useAutosave.ts as
 * it is, run by a component that draws nothing, so the only part of the editor that renders on every
 * change of the whole doc is this one. useSave() reads what it publishes.
 *
 * A save the server cannot run because the page's server actions are gone (after a deploy or a
 * rollback Next answers that it has no such action, and throws UnrecognizedActionError) is a stale
 * editor: it is not tried again, and the status says so (STALE_EDITOR). Every other failure (a dropped
 * connection, a server error or timeout, a gateway's error page, "An error occurred in the Server
 * Components render") is thrown on to useAutosave, which tries it three times like any save that did
 * not land (the review's data-safety-2). In development, `?save=stale` makes every save fail as a
 * stale editor's does, for the test.
 */

/** Next's words for an action it does not have: its error's, and the body it sends when a proxy drops its header. */
const NO_SUCH_ACTION = /Server Action ".*" was not found on the server|Failed to find Server Action|^Server action not found/i;
const isStale = (e: unknown) => unstable_isUnrecognizedActionError(e) || (e instanceof Error && (e.name === "UnrecognizedActionError" || NO_SUCH_ACTION.test(e.message)));

const devStale = () => process.env.NODE_ENV !== "production" && typeof window !== "undefined" && new URLSearchParams(window.location.search).get("save") === "stale";

async function send(id: string, doc: ExhbtDoc): Promise<SaveResult> {
  try {
    if (devStale()) throw Object.assign(new Error('Server Action "dev" was not found on the server. (?save=stale, development only)'), { name: "UnrecognizedActionError" });
    return await saveDraft(id, doc);
  } catch (e) {
    // Tried again by useAutosave.
    if (!isStale(e)) throw e;
    console.error("The server has no such action: this editor is older than the site.", e);
    return { ok: false, error: STALE_EDITOR };
  }
}

/**
 * Sends a save, and keeps the rule that deletes files off what it points at until it is answered (files.ts, `sending`).
 * A save still on its way can land after the rule has run: in Safari a press on Remove gives the button no focus, so the
 * field the focus leaves saves at once, the picture still in its doc, and an Undo entry falling off the list meanwhile
 * sent the picture's DELETE before that save landed. The server kept the file and this visit forgot it. The hold ends a
 * task after the answer, once useAutosave has noted the doc that landed as the server's.
 */
async function held(files: FilesController, doc: ExhbtDoc, go: () => Promise<SaveResult>): Promise<SaveResult> {
  const done = files.sending(doc);
  try {
    return await go();
  } finally {
    setTimeout(done, 0);
  }
}

/** Development only: a save in place of the server action (the timing harness, app/dev/editor-timing, saves nothing). */
export const SaveOverride = createContext<((doc: ExhbtDoc) => Promise<SaveResult>) | null>(null);

export function Autosave() {
  const override = useContext(SaveOverride);
  const { env, save } = useRuntime();
  const files = useFilesController();
  const saveDoc = (d: ExhbtDoc) => held(files, d, () => (override ? override(d) : send(env.id, d)));
  const doc = useDoc((d) => d);
  const a = useAutosave({ id: env.id, doc, initial: env.initialDoc, save: saveDoc,
    // The server has it: noted for the crash fallback, and the rule that deletes files runs.
    onSavedDoc: (d) => {
      noteSaved(d, env.id);
      files.noteSaved(d);
    },
  });
  const latest = useRef(a);
  latest.current = a;

  // Stable functions over whatever useAutosave returned last.
  const api = useRef<Omit<SaveApi, "status">>({
    flush: () => latest.current.flush(),
    settled: () => latest.current.settled(),
    markSaved: (d) => latest.current.markSaved(d),
  });
  const status = a.status;
  useEffect(() => {
    save.set({ ...api.current, status });
  }, [save, status]);

  // flushPending (the crash fallback) sends through the same action, after any save in flight.
  useEffect(
    () =>
      registerSender({
        id: env.id,
        send: async (d) => (await held(files, d, () => (override ? override(d) : send(env.id, d)))).ok,
        settled: () => latest.current.settled(),
      }),
    [env.id, override, files],
  );
  return null;
}
