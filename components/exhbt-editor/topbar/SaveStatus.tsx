"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { STALE_EDITOR, useSave } from "../context";

/**
 * Quiet words: "Saved" or "Saving…". When a save fails, "Not saved. Retry" and where the words are kept;
 * after a deploy or a rollback, the words to reload and a Reload button in place of Retry.
 */
export function SaveStatus(): ReactNode {
  const { status, flush } = useSave();
  if (status.state === "error" && status.error === STALE_EDITOR) {
    return (
      <span className="xe-save xe-save-bad">
        <span role="status" className="xe-save-words">
          {STALE_EDITOR}
        </span>
        <Button size="sm" className="xe-tb" onClick={() => window.location.reload()}>
          Reload
        </Button>
      </span>
    );
  }
  if (status.state === "error") {
    return (
      <span className="xe-save xe-save-bad">
        <Button size="sm" variant="danger" className="xe-tb" label="Not saved. Retry" onClick={() => void flush()}>
          Not saved. Retry
        </Button>
        <span role="status" className="xe-save-words">
          Kept in this browser.{status.error ? ` ${status.error}` : ""}
        </span>
      </span>
    );
  }
  return (
    <span role="status" className="xe-save">
      {status.state === "saved" ? "Saved" : "Saving…"}
    </span>
  );
}
