"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ChevronDown, LayoutTemplate } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { figureSentence, layoutSentence } from "@/lib/exhbt/drafted";
import { FORMAT_RULES, formatOf, OFFERED_FORMATS, type Format } from "@/lib/exhbt/formats";
import { layoutNotes } from "@/lib/exhbt/sections";
import { useEnv, useUi } from "../context";
import { useDoc, useStore } from "../store";
import { Popover } from "./Popover";

/*
 * The layout menu (decision 0026, "The chrome"; 0027, "Layouts are starting templates"). A button showing
 * the layout's name opens a panel with one radio for each layout the editor offers, each with a small
 * sketch and one short line. Choosing one switches at once (store.setLayout, one undo entry) and says what
 * was kept and what is over; the longer "best for" line of the radio that has the focus is under the list.
 * M adds four layouts to MENU_LINES, SKETCHES and LAID_OUT_AS in release 4.
 */

/** One short line for each layout, at most 40 characters, so a row stays on one line on a phone. */
export const MENU_LINES: Partial<Record<Format, string>> = {
  "case-study": "Question, method, result: data, code",
  gallery: "Pictures first: design, film, campaigns",
  research: "Aim, method, findings: studies, essays",
};

/** "Laid out as ...": the layout in a phrase that reads after "as". */
const LAID_OUT_AS: Partial<Record<Format, string>> = {
  "case-study": "a case study",
  gallery: "a gallery",
  research: "research",
};

/* Copied from the classic editor's LayoutPicker (decision 0026: it is deleted in release 5). */
const SKETCHES: Partial<Record<Format, ReactNode>> = {
  // A title bar, a row of three boxes, two columns.
  "case-study": (
    <>
      <rect x="2" y="2" width="30" height="5" rx="1" />
      <rect x="2" y="11" width="14" height="7" rx="1" />
      <rect x="20" y="11" width="14" height="7" rx="1" />
      <rect x="38" y="11" width="16" height="7" rx="1" />
      <rect x="2" y="23" width="24" height="15" rx="1" />
      <rect x="30" y="23" width="24" height="15" rx="1" />
    </>
  ),
  // One big frame over a row of small frames.
  gallery: (
    <>
      <rect x="2" y="2" width="52" height="22" rx="1" />
      <rect x="2" y="28" width="10" height="10" rx="1" />
      <rect x="16" y="28" width="12" height="10" rx="1" />
      <rect x="32" y="28" width="9" height="10" rx="1" />
      <rect x="45" y="28" width="9" height="10" rx="1" />
    </>
  ),
  // A narrow column beside a big frame, two columns under.
  research: (
    <>
      <rect x="2" y="2" width="16" height="22" rx="1" />
      <rect x="22" y="2" width="32" height="22" rx="1" />
      <rect x="2" y="28" width="24" height="10" rx="1" />
      <rect x="30" y="28" width="24" height="10" rx="1" />
    </>
  ),
};

const laidOutAs = (f: Format) => LAID_OUT_AS[f] ?? FORMAT_RULES[f].name.toLowerCase();

export function LayoutMenu({ inline = false }: { inline?: boolean } = {}): ReactNode {
  const f = useDoc(formatOf);
  const name = FORMAT_RULES[f].name;
  return (
    <Popover
      inline={inline}
      panelClassName="xe-layout-panel"
      focusIn={(p) => p.querySelector<HTMLElement>("input:checked")}
      trigger={({ id, open, toggle, panelId }) => (
        <Button id={id} size="sm" className="xe-tb xe-layout-button" aria-expanded={open} aria-controls={open ? panelId : undefined} label={`Layout: ${name}`} onClick={toggle}>
          <LayoutTemplate aria-hidden size={16} strokeWidth={2.25} className="shrink-0" />
          <span className="xe-tb-text">{name}</span>
          <ChevronDown aria-hidden size={14} strokeWidth={2.25} className="shrink-0" />
        </Button>
      )}
    >
      {() => <LayoutPanel />}
    </Popover>
  );
}

function LayoutPanel(): ReactNode {
  const store = useStore();
  const { drafted } = useEnv();
  const doc = useDoc((d) => d);
  const f = formatOf(doc);
  const group = useId();
  const [focused, setFocused] = useState<Format>(f);
  const [said, setSaid] = useState<Format | null>(null);
  const offered = OFFERED_FORMATS.includes(f) ? OFFERED_FORMATS : [...OFFERED_FORMATS, f];

  function choose(next: Format) {
    if (next === f) return;
    store.setLayout(next);
    setSaid(next);
  }

  // Said until the next change: a switch elsewhere (Undo) clears it.
  const showSaid = said === f;
  const notes = showSaid ? layoutNotes(doc) : null;
  const layoutLine = drafted && drafted.format === f && !said ? layoutSentence(f, drafted.reason) : null;
  const figureLine = drafted && !said ? figureSentence(doc, drafted.figure) : null;

  return (
    <>
      <div role="radiogroup" aria-label="Layout" className="xe-layout-list">
        {offered.map((k) => (
          <label key={k} className="xe-layout-row">
            <input
              type="radio"
              name={group}
              value={k}
              checked={f === k}
              onChange={() => choose(k)}
              onFocus={() => setFocused(k)}
              aria-describedby={`${group}-${k}`}
              className="size-4 shrink-0 accent-jade"
            />
            <svg aria-hidden width="40" height="29" viewBox="0 0 56 40" fill="none" stroke="currentColor" strokeWidth="1.75" className="shrink-0 text-graphite">
              {SKETCHES[k] ?? SKETCHES["case-study"]}
            </svg>
            <span className="xe-layout-text">
              <span className="xe-layout-name">{FORMAT_RULES[k].name}</span>
              <span className="xe-layout-line">{MENU_LINES[k] ?? ""}</span>
            </span>
            <span id={`${group}-${k}`} className="sr-only">
              {FORMAT_RULES[k].bestFor}
            </span>
          </label>
        ))}
      </div>
      <p aria-hidden className="xe-layout-best">
        {FORMAT_RULES[offered.includes(focused) ? focused : f].bestFor}
      </p>
      <div role="status" className="xe-layout-status" data-layout-status>
        {showSaid && (
          <>
            <p>Laid out as {laidOutAs(f)}. Undo restores your order.</p>
            {notes && notes.hidden.length > 0 && <p className="text-graphite">Kept, not shown in this layout: {notes.hidden.join(", ")}.</p>}
            {notes?.over.map((o) => (
              <p key={o} className="text-error">
                {o}
              </p>
            ))}
          </>
        )}
        {(layoutLine || figureLine) && (
          <p data-drafted>
            {layoutLine} {figureLine}
          </p>
        )}
      </div>
    </>
  );
}

/** Once, right after an AI draft: says the one line aloud and takes the draft's notes off the address, so a reload does not say it again. */
export function useDraftedLine(): void {
  const { drafted } = useEnv();
  const ui = useUi();
  const store = useStore();
  const done = useRef(false);
  useEffect(() => {
    if (!drafted || done.current) return;
    done.current = true;
    const line = [layoutSentence(drafted.format, drafted.reason), figureSentence(store.get(), drafted.figure)].filter(Boolean).join(" ");
    if (line) ui.say(line);
    const url = new URL(window.location.href);
    if (["drafted", "why", "fig"].some((k) => url.searchParams.has(k))) {
      for (const k of ["drafted", "why", "fig"]) url.searchParams.delete(k);
      window.history.replaceState(null, "", url.pathname + url.search + url.hash);
    }
    // Once, on the first draw.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
