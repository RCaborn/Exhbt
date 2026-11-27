"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { STALE_EDITOR, useSave } from "../context";
import { Said } from "../ui/Said";

/**
 * Quiet words: "Saved" or "Saving…". When a save fails, "Not saved. Retry" and where the words are kept;
 * after a deploy or a rollback, the words to reload and a Reload button in place of Retry.
 *
 * What a screen reader hears is separate from what is drawn, and is said in one live region that is there
 * from the start: only a failure, and the recovery after one ("Saved again."). The routine "Saving…" and
 * "Saved" stay on screen but are not announced, since they would come at every pause in typing.
 */
export function SaveStatus(): ReactNode {
  const { status, flush } = useSave();
  const stale = status.state === "error" && status.error === STALE_EDITOR;
  const failed = status.state === "error";
  const words = stale ? STALE_EDITOR : `Not saved. Kept in this browser.${status.error ? ` ${status.error}` : ""}`;

  const [said, setSaid] = useState({ text: "", n: 0 });
  const wasBad = useRef(false);
  useEffect(() => {
    if (failed) {
      wasBad.current = true;
      setSaid((s) => ({ text: words, n: s.n + 1 }));
    } else if (wasBad.current && status.state === "saved") {
      wasBad.current = false;
      setSaid((s) => ({ text: "Saved again. Your changes are safe.", n: s.n + 1 }));
    }
  }, [failed, status.state, words]);

  return (
    <>
      <Said text={said.text} n={said.n} role="status" />
      {stale ? (
        <span className="xe-save xe-save-bad">
          <span className="xe-save-words">{STALE_EDITOR}</span>
          <Button size="sm" className="xe-tb" onClick={() => window.location.reload()}>
            Reload
          </Button>
        </span>
      ) : failed ? (
        <span className="xe-save xe-save-bad">
          <Button size="sm" variant="danger" className="xe-tb" label="Not saved. Retry" onClick={() => void flush()}>
            <span className="xe-save-lead">Not saved. </span>Retry
          </Button>
          <span className="xe-save-words">Kept in this browser.{status.error ? ` ${status.error}` : ""}</span>
        </span>
      ) : (
        <span className="xe-save">{status.state === "saved" ? "Saved" : "Saving…"}</span>
      )}
    </>
  );
}
