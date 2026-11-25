"use client";

import type { ReactNode } from "react";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { confirmNumber, labelOf, unverifiedOf } from "@/components/editor/model";
import { pathOfNumber } from "@/lib/exhbt/verify";
import { useIssues, useUi } from "../context";
import { useDoc, useStore } from "../store";
import { Popover } from "./Popover";
import { HEADING_ID } from "./UndoButton";

/**
 * "3 things to fix" (decision 0026, "What the page does not draw"): shown whenever there is an issue that
 * stops publishing or a number to check, hidden only when there is neither. A complete AI draft with one
 * flagged number has no issue, and publishing refuses it, so this is where the person finds the number.
 * The panel lists the numbers first, then the issues worth showing now (all of them once publishing has
 * been tried); each issue puts the cursor in its exact field.
 */
const NONE: string[] = [];

export function ThingsToFix(): ReactNode {
  const issues = useIssues();
  // The slice must be the same object while it has not changed (useDoc), so no new empty list each time.
  const flags = useDoc((d) => d.unverified) ?? NONE;
  // Real problems now (all of them once publishing has been tried) and the numbers to check: empty parts are not nagged about.
  const count = issues.shown.length + flags.length;
  if (count === 0) return null;
  const onlyNumbers = issues.shown.length === 0;
  const words = onlyNumbers ? (flags.length === 1 ? "1 number to check" : `${flags.length} numbers to check`) : count === 1 ? "1 thing to fix" : `${count} things to fix`;
  return (
    <Popover
      className="xe-fix"
      panelClassName="xe-fix-panel"
      region="Things to fix before publishing"
      trigger={({ id, open, toggle, panelId }) => (
        <Button id={id} size="sm" className="xe-tb xe-fix-button" aria-expanded={open} aria-controls={open ? panelId : undefined} label={words} onClick={toggle}>
          <TriangleAlert aria-hidden size={16} strokeWidth={2.25} className="shrink-0" />
          <span className="xe-fix-count" aria-hidden>
            {count}
          </span>
          <span className="xe-fix-words">{words}</span>
        </Button>
      )}
    >
      {({ close }) => <FixPanel close={close} />}
    </Popover>
  );
}

function FixPanel({ close }: { close(restoreFocus?: boolean): void }): ReactNode {
  const store = useStore();
  const ui = useUi();
  const issues = useIssues();
  const doc = useDoc((d) => d);
  const flags = unverifiedOf(doc);
  const listed = issues.tried ? issues.all : issues.shown;
  const unlisted = issues.all.length - listed.length;

  return (
    <>
      {flags.length > 0 && (
        <ul aria-label="Numbers to check" className="xe-fix-list">
          {flags.map((n) => (
            <li key={n} className="xe-fix-number">
              <span>
                Check this number: <strong className="font-mono">{n}</strong>
                <span className="block text-sm text-graphite">We couldn&apos;t find it in your files. Fix it in the text, or confirm it.</span>
              </span>
              <span className="xe-fix-actions">
                <Button
                  size="sm"
                  className="xe-tb"
                  label={`That's right: ${n}`}
                  onClick={() => {
                    store.patchDoc((d) => confirmNumber(d, n), `confirm ${n}`);
                    ui.say(`Confirmed ${n}.`);
                    // The last thing to fix: the button goes, so the focus goes to the heading.
                    if (flags.length === 1 && issues.shown.length === 0) requestAnimationFrame(() => document.getElementById(HEADING_ID)?.focus());
                  }}
                >
                  That&apos;s right
                </Button>
                <Button
                  size="sm"
                  className="xe-tb"
                  label="Show me"
                  onClick={() => {
                    const path = pathOfNumber(store.get(), n);
                    if (path === null) return;
                    ui.jumpTo(path);
                    close();
                  }}
                >
                  Show me
                </Button>
              </span>
            </li>
          ))}
        </ul>
      )}
      {listed.length > 0 && (
        <ul aria-label="To fix" className="xe-fix-list">
          {listed.map((i) => {
            const label = labelOf(i.path, doc);
            const text = label ? `${label}: ${i.message}` : i.message;
            return (
              <li key={`${i.path}|${i.message}`}>
                <button
                  type="button"
                  className="xe-fix-issue"
                  data-issue-path={i.path}
                  onClick={() => {
                    ui.jumpTo(i.path);
                    close();
                  }}
                >
                  {text}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {unlisted > 0 && (
        <p className="xe-fix-more">
          {unlisted === 1 ? "1 part is still empty" : `${unlisted} parts are still empty`}. {unlisted === 1 ? "It is" : "They are"} listed here once you try to publish.
        </p>
      )}
    </>
  );
}
