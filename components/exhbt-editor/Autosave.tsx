"use client";

import { useEffect, useRef } from "react";
import { saveDraft } from "@/app/(app)/exhbts/[id]/actions";
import { useAutosave, type SaveResult } from "@/components/editor/useAutosave";
import type { ExhbtDoc } from "@/lib/exhbt/blocks";
import { STALE_EDITOR, useRuntime, type SaveApi } from "./context";
import { noteSaved, registerSender } from "./pending";
import { useFilesController } from "./files";
import { useDoc } from "./store";

/*
 * Autosave for the edit-on-page editor (decision 0026, "Saving"): components/editor/useAutosave.ts as
 * it is, run by a component that draws nothing, so the only part of the editor that renders on every
 * change of the whole doc is this one. useSave() reads what it publishes.
 *
 * A save that throws for a reason other than the network (a TypeError from fetch, or the browser
 * offline) means the page's server actions are gone, after a deploy or a rollback: it is not tried
 * again, and the status says so (STALE_EDITOR). In development, `?save=stale` makes every save fail
 * that way, for the test.
 */

const isNetwork = (e: unknown) => e instanceof TypeError || (typeof navigator !== "undefined" && navigator.onLine === false);

const devStale = () => process.env.NODE_ENV !== "production" && typeof window !== "undefined" && new URLSearchParams(window.location.search).get("save") === "stale";

async function send(id: string, doc: ExhbtDoc): Promise<SaveResult> {
  try {
    if (devStale()) throw new Error("The save was told to fail as a stale editor's would (?save=stale, development only).");
    return await saveDraft(id, doc);
  } catch (e) {
    if (isNetwork(e)) throw e;
    console.error("Saving failed in a way the network does not explain: this editor is older than the site.", e);
    return { ok: false, error: STALE_EDITOR };
  }
}

export function Autosave() {
  const { env, save } = useRuntime();
  const files = useFilesController();
  const doc = useDoc((d) => d);
  const a = useAutosave({ id: env.id, doc, initial: env.initialDoc, save: (d) => send(env.id, d),
    // The server has it: noted for the crash fallback, and the rule that deletes files runs.
    onSavedDoc: (d) => {
      noteSaved(d);
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
        send: async (d) => (await send(env.id, d)).ok,
        settled: () => latest.current.settled(),
      }),
    [env.id],
  );
  return null;
}
