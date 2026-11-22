"use client";

import "./css/drag.css";
import { useEffect, useId, useRef, useState } from "react";
import { FileText, Plus } from "lucide-react";
import type { InsertSlot } from "@/components/portfolio/page-ctx";
import type { ExhbtDoc } from "@/lib/exhbt/blocks";
import { blockOptions, pageItems, type BlockOption } from "@/lib/exhbt/layouts";
import { useRuntime, useEnv } from "./context";
import { useBoard } from "./drag";
import { BlockIcon, fullLine, wordsLeft } from "./drag/blocks";
import { canTakeFigure } from "./figures/take";
import { labelAt } from "./labels";
import { useStoreInternal } from "./store";

/*
 * The "+" in the gap above each row and after the last (decision 0026, "The chrome"). It takes no
 * room: a zero-height element between the rows, with the button drawn over the gap. It lists every
 * kind the layout can hold (blockOptions), in the layout's own words, the flowchart when it is off
 * the page, and "Take a figure from my report" when there is one to take; a kind with no room is
 * dimmed with its reason under it. Whatever is chosen goes where this "+" is, the flowchart included.
 * The end one is "Add a section" (id add-section, data-path "sections"): "Things to fix" lands on it
 * for issues about how many of a kind there are, and opens its menu.
 */

type Open = { options: BlockOption[]; words: { text: string; over: boolean }; full: string | null; figure: { full?: string } | null };

function readMenu(doc: ExhbtDoc, reportFiles: { fileId: string }[]): Open {
  const options = blockOptions(doc);
  const image = options.find((o) => o.kind === "image");
  return { options, words: wordsLeft(doc), full: fullLine(doc, options), figure: canTakeFigure(doc, reportFiles) ? { full: image?.full } : null };
}

export function Insert({ at, end }: InsertSlot) {
  const store = useStoreInternal();
  const board = useBoard();
  const { uiApi } = useRuntime();
  const env = useEnv();
  const [open, setOpen] = useState<Open | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const before = end ? null : labelAt(store.get(), at);
  const name = before ? `Add a section before ${before}` : "Add a section";
  const show = () => setOpen(readMenu(store.get(), env.reportFiles));

  // "Things to fix" landing on the end "+" (the span round it carries the path; the jump lands on the button in it) opens its menu.
  useEffect(() => {
    const w = wrap.current;
    if (!w || !end) return;
    const onJump = () => {
      if (document.activeElement !== button.current) button.current?.focus({ preventScroll: true });
      setOpen(readMenu(store.get(), env.reportFiles));
    };
    w.addEventListener("xe-jump", onJump);
    return () => w.removeEventListener("xe-jump", onJump);
  }, [end, store, env.reportFiles]);

  // Open, a press anywhere else closes it.
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(null);
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open]);

  const choose = (run: () => void) => {
    setOpen(null);
    run();
  };

  return (
    <div
      ref={wrap}
      className="xe-insert"
      data-edit-only
      data-at={at}
      data-end={end || undefined}
      data-open={open ? "" : undefined}
      onKeyDown={(e) => {
        if (e.key !== "Escape" || !open) return;
        e.stopPropagation();
        setOpen(null);
        button.current?.focus();
      }}
      onBlur={(e) => {
        if (open && !e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(null);
      }}
    >
      {/* The end one's path is on the "+" alone, not on its menu: "Things to fix" lands on the "+" and opens the menu beside it. */}
      <span data-path={end ? "sections" : undefined}>
        <button
          ref={button}
          type="button"
          id={end ? "add-section" : undefined}
          className="xe-plus"
          aria-label={name}
          data-tip={name}
          aria-expanded={open !== null}
          aria-controls={open ? menuId : undefined}
          onClick={() => (open ? setOpen(null) : show())}
        >
          <Plus aria-hidden size={16} strokeWidth={2.5} />
        </button>
      </span>
      {open && (
        <div id={menuId} role="group" aria-label={name} className="xe-plus-menu" data-xe-menu>
          {open.full && <p className="xe-plus-full">{open.full}</p>}
          <p className="xe-plus-note" data-testid="words-left" data-over={open.words.over || undefined}>
            {open.words.text}
          </p>
          <ul className="xe-plus-list">
            {open.options.map((o) => (
              <li key={o.kind}>
                <button type="button" className="xe-plus-item" data-block={o.kind} disabled={Boolean(o.full)} aria-describedby={o.full ? `${menuId}-${o.kind}` : undefined} onClick={() => choose(() => board.add(o.kind, at))}>
                  <BlockIcon kind={o.kind} />
                  <span className="min-w-0">
                    <span className="xe-plus-name">{o.name}</span>
                    {o.full && (
                      <span id={`${menuId}-${o.kind}`} className="xe-plus-why">
                        {o.full}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            ))}
            {open.figure && (
              <li>
                {/* Like every item here, it goes where this "+" is: the sheet is told the section it goes before (none: the end). */}
                <button type="button" className="xe-plus-item" data-block="figure" disabled={Boolean(open.figure.full)} aria-describedby={open.figure.full ? `${menuId}-figure` : undefined} onClick={() => choose(() => uiApi.open("figure", end ? undefined : pageItems(store.get())[at]?.id))}>
                  <FileText aria-hidden size={16} strokeWidth={2.25} className="xe-block-icon" />
                  <span className="min-w-0">
                    <span className="xe-plus-name">Take a figure from my report</span>
                    {open.figure.full && (
                      <span id={`${menuId}-figure`} className="xe-plus-why">
                        {open.figure.full}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
