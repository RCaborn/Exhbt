"use client";

import "../css/figures.css";
import { useId, useRef, type ReactNode } from "react";
import { Link2 } from "lucide-react";
import type { ExtraSlot } from "@/components/portfolio/page-ctx";
import { formatLimits, safeHref } from "@/lib/exhbt/blocks";
import { formatOf } from "@/lib/exhbt/formats";
import { useFieldIssue } from "../fields/issues";
import { labelOf } from "../labels";
import { useDoc, useStore } from "../store";
import { useAnchoredPopover } from "./anchor";

/*
 * A link's "Web address" (decision 0026, "What the page does not draw"): a button over the link's
 * bottom corner, always shown (the address is a link's main field, so it is never hidden until hover),
 * named "Web address: Link 1", and marked while the address is missing or not a full https:// one. It
 * opens a native popover holding the field (path sections.N.href), "(optional)" where the layout lets a
 * link go without one. A link just added opens it with the cursor in the field: F's board.add jumps to
 * the href path, and G's jump opens the popover before it focuses the field. Nothing here takes room.
 */
export function LinkExtras(props: ExtraSlot): ReactNode {
  if (props.where !== "over") return null;
  return <WebAddress sectionId={props.sectionId} />;
}

function WebAddress({ sectionId }: { sectionId: string }) {
  const store = useStore();
  const index = useDoc((d) => d.sections.findIndex((x) => x.id === sectionId));
  const href = useDoc((d) => {
    const s = d.sections.find((x) => x.id === sectionId);
    return s?.kind === "link" ? s.href : "";
  });
  const label = useDoc((d) => labelOf(d, sectionId));
  const optional = useDoc((d) => formatLimits(formatOf(d)).link.hrefOptional);
  const path = `sections.${index}.href`;
  const issue = useFieldIssue(path);
  const id = useId();
  const fieldId = `${id}-href`;
  const button = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  useAnchoredPopover(button, pop, "end");
  if (index < 0) return null;
  // Missing (where the layout needs one) or not a usable https:// address: the button says so.
  const wrong = href.trim() ? safeHref(href) === null : !optional;
  const close = () => {
    pop.current?.hidePopover();
    button.current?.focus();
  };
  return (
    <span className="xe-fig-link" data-edit-only>
      <button
        ref={button}
        type="button"
        className="xe-fig-chip xe-fig-corner"
        popoverTarget={`${id}-pop`}
        aria-label={`Web address: ${label}`}
        aria-describedby={wrong ? `${id}-state` : undefined}
        data-missing={wrong ? "" : undefined}
      >
        <Link2 aria-hidden size={13} strokeWidth={2.25} />
        Web address
        {wrong && <span aria-hidden className="xe-fig-chip-mark" />}
      </button>
      {wrong && (
        <span id={`${id}-state`} className="sr-only">
          {href.trim() ? "Not a full https:// address" : "No address yet"}
        </span>
      )}
      <div ref={pop} id={`${id}-pop`} popover="auto" className="xe-fig-pop xe-fig-pop-link">
        <label htmlFor={fieldId} className="xe-fig-pop-label">
          Web address {optional && <span className="xe-fig-pop-optional">(optional)</span>}
        </label>
        <input
          id={fieldId}
          type="url"
          inputMode="url"
          autoComplete="url"
          spellCheck={false}
          className="xe-fig-pop-input"
          data-path={path}
          value={href}
          placeholder="https://"
          aria-invalid={issue ? true : undefined}
          aria-describedby={issue ? `${fieldId}-issue` : `${fieldId}-hint`}
          onChange={(e) => store.setAt(path, e.target.value.trim())}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              close();
            }
          }}
        />
        {issue ? (
          <p id={`${fieldId}-issue`} className="xe-fig-pop-issue">
            {issue}
          </p>
        ) : (
          <p id={`${fieldId}-hint`} className="xe-fig-pop-hint">
            The full address, starting https://
          </p>
        )}
      </div>
    </span>
  );
}
