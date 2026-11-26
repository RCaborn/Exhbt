"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Text } from "@astryxdesign/core/Text";
import { Said } from "@/components/exhbt-editor/ui/Said";
import { Button } from "@/components/ui/Button";
import { usePortfolioApi, usePortfolioData, usePortfolioSave, usePortfolioState, usePortfolioUi, useRuntime } from "../runtime";

/** What the status says when the site was updated under this tab: its save action is gone (a deploy or a rollback since it was opened). */
export const STALE_EDITOR = "The site was updated. Reload to carry on.";

/**
 * The save status, for the bar (decision 0031, "Saving": "One status in the bar"). Quiet words: "Saved",
 * and "Saved · live" when visitors can see the page, so a word going public as it saves is never a
 * surprise; "Saving…" while a change waits or is on its way. When the rules refuse what is on the page,
 * "Not saved:" with the first problem and "Show me", which goes to its field. When a save fails, "Not
 * saved" with what went wrong and Retry; after a deploy or a rollback, the words to reload and Reload.
 *
 * What a screen reader hears is separate from what is drawn, in one live region that is there from the
 * start: only a failure, and the recovery after one. The routine "Saving…" and "Saved" stay on screen
 * but are not announced, since they would come at every pause in typing.
 *
 * Astryx throughout: the words are its Text, the actions its Button.
 */
export function SaveStatus(): ReactNode {
  const { status, stale } = usePortfolioSave();
  const rt = useRuntime();
  const api = usePortfolioApi();
  const firstIssue = usePortfolioUi((u) => Object.keys(u.issues)[0] ?? null);
  const live = useLive();

  const failed = status.kind === "error" || status.kind === "invalid";
  const words = stale
    ? STALE_EDITOR
    : status.kind === "invalid"
      ? `Not saved: ${status.message}`
      : status.kind === "error"
        ? `Not saved. ${status.message}`
        : status.kind === "saved"
          ? live
            ? "Saved · live"
            : "Saved"
          : "Saving…";

  const [said, setSaid] = useState({ text: "", n: 0 });
  const wasBad = useRef(false);
  useEffect(() => {
    if (failed || stale) {
      wasBad.current = true;
      setSaid((s) => ({ text: words, n: s.n + 1 }));
    } else if (wasBad.current && status.kind === "saved") {
      wasBad.current = false;
      setSaid((s) => ({ text: "Saved again. Your changes are safe.", n: s.n + 1 }));
    }
  }, [failed, stale, status.kind, words]);

  const state = stale ? "stale" : status.kind;
  return (
    <>
      <Said text={said.text} n={said.n} role="status" />
      <span className="pe-save" data-save={state} data-live={live && status.kind === "saved" ? "" : undefined}>
        <Text type="supporting" color={failed || stale ? "primary" : "secondary"} weight={failed || stale ? "semibold" : undefined} className="pe-save-words">
          {words}
        </Text>
        {stale ? (
          <Button size="sm" onClick={() => window.location.reload()}>
            Reload
          </Button>
        ) : status.kind === "invalid" && firstIssue ? (
          <Button size="sm" onClick={() => api.jumpTo(firstIssue)}>
            Show me
          </Button>
        ) : status.kind === "error" ? (
          <Button size="sm" variant="danger" onClick={() => rt.retry()}>
            Retry
          </Button>
        ) : null}
      </span>
    </>
  );
}

/**
 * Whether visitors can see the page as it saves: the plan has a public page, there is an address, and
 * at least one published exhbt is listed on it (not hidden). What the bar's chip calls "Live".
 */
export function useLive(): boolean {
  const data = usePortfolioData();
  const hidden = usePortfolioState((s) => s.arrangement.hidden);
  return data.visitor.publicPlan && Boolean(data.builder.username) && data.visitor.published.some((p) => !hidden.includes(p.id));
}
