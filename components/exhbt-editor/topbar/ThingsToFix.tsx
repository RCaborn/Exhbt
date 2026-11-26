"use client";

import type { ReactNode } from "react";
import { Lightbulb, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { confirmNumber, labelOf, unverifiedOf } from "@/components/editor/model";
import { pathOfNumber } from "@/lib/exhbt/verify";
import { useIssues, useSuggestions, useUi } from "../context";
import { useDoc, useStore } from "../store";
import { Popover } from "./Popover";
import { Suggestions } from "./Suggestions";
import { HEADING_ID } from "./UndoButton";

/**
 * "3 things to fix" (decision 0026, "What the page does not draw"): shown whenever there is an issue that
 * stops publishing or a number to check, hidden only when there is neither. A complete AI draft with one
 * flagged number has no issue, and publishing refuses it, so this is where the person finds the number.
 * The panel lists the numbers first, then the issues worth showing now (all of them once publishing has
 * been tried); each issue puts the cursor in its exact field.
 *
 * Under them, in a group of their own, the suggestions (decision 0032): what a page of this layout usually
 * has. They are not counted in "things to fix" and stop nothing. When they are all there is, and the exhbt
 * could go live as it stands, the button is a quiet "2 suggestions": so they can be found, and a page that
 * has barely been started is not handed a list.
 */
const NONE: string[] = [];

export function ThingsToFix(): ReactNode {
  const issues = useIssues();
  // The slice must be the same object while it has not changed (useDoc), so no new empty list each time.
  const flags = useDoc((d) => d.unverified) ?? NONE;
  const suggestions = useSuggestions();
  // Real problems now (all of them once publishing has been tried) and the numbers to check: empty parts are not nagged about.
  const count = issues.shown.length + flags.length;
  // Nothing to fix or check, and nothing that would stop publishing either: the suggestions alone, quietly.
  const onlySuggestions = count === 0 && issues.all.length === 0 && suggestions.length > 0;
  if (count === 0 && !onlySuggestions) return null;
  const onlyNumbers = issues.shown.length === 0;
  const n = onlySuggestions ? suggestions.length : count;
  const words = onlySuggestions
    ? n === 1
      ? "1 suggestion"
      : `${n} suggestions`
    : onlyNumbers
      ? flags.length === 1
        ? "1 number to check"
        : `${flags.length} numbers to check`
      : count === 1
        ? "1 thing to fix"
        : `${count} things to fix`;
  return (
    <Popover
      className="xe-fix"
      panelClassName="xe-fix-panel"
      region={onlySuggestions ? "Suggestions" : "Things to fix before publishing"}
      trigger={({ id, open, toggle, panelId }) => (
        <Button id={id} size="sm" className={onlySuggestions ? "xe-tb xe-suggest-button" : "xe-tb xe-fix-button"} aria-expanded={open} aria-controls={open ? panelId : undefined} label={words} onClick={toggle}>
          {onlySuggestions ? <Lightbulb aria-hidden size={16} strokeWidth={2.25} className="shrink-0" /> : <TriangleAlert aria-hidden size={16} strokeWidth={2.25} className="shrink-0" />}
          <span className="xe-fix-count" aria-hidden>
            {n}
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
          {unlisted === 1 ? "1 more thing is needed" : `${unlisted} more things are needed`} before this can go live. {unlisted === 1 ? "It is" : "They are"} listed here once you try to publish.
        </p>
      )}
      <Suggestions
        onPick={(path) => {
          ui.jumpTo(path);
          close();
        }}
      />
    </>
  );
}
