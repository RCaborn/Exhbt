"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { STALE_EDITOR, useRuntime, useSave } from "../context";

/*
 * The top bar (decision 0026, "The chrome"): one row that stays at the top, exactly --xe-topbar-h tall
 * (css/core.css), so the loading view's room for it is right and nothing moves when it arrives. H's:
 * this is G's stub, with the way back, the screen's heading ("Edit exhbt", level 1), the save status and
 * "Review and publish".
 */
export function TopBar(): ReactNode {
  const { uiApi } = useRuntime();
  return (
    <header className="xe-topbar">
      <div className="xe-topbar-row">
        <Link href="/exhbts" className="inline-flex items-center gap-1.5 text-sm font-semibold hover:text-graphite">
          <ArrowLeft aria-hidden size={15} strokeWidth={2.25} /> Your exhbts
        </Link>
        <h1 tabIndex={-1} className="text-[1.125rem] font-semibold">
          Edit exhbt
        </h1>
        <span className="ml-auto">
          <SaveStatus />
        </span>
        <Button variant="primary" size="sm" onClick={() => uiApi.open("publish")}>
          Review and publish
        </Button>
      </div>
    </header>
  );
}

/** Quiet words: "Saved", "Saving…", or "Not saved. Retry"; after a deploy or a rollback, the words to reload. */
export function SaveStatus() {
  const save = useSave();
  const s = save.status;
  if (s.state === "error" && s.error === STALE_EDITOR) {
    return (
      <span role="status" className="inline-flex items-center gap-2 text-sm text-error">
        {STALE_EDITOR}
        <Button size="sm" onClick={() => window.location.reload()}>
          Reload
        </Button>
      </span>
    );
  }
  if (s.state === "error") {
    return (
      <Button size="sm" variant="danger" onClick={() => void save.flush()} label="Not saved. Retry">
        Not saved. Retry
      </Button>
    );
  }
  return (
    <span role="status" className="text-sm text-graphite">
      {s.state === "saved" ? "Saved" : "Saving…"}
    </span>
  );
}
