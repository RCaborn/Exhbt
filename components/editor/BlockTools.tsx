"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { MoreHorizontal, RotateCcw, Wand2 } from "lucide-react";
import { rewriteBlockAction } from "@/app/(app)/exhbts/[id]/draft-tools-actions";
import { Button } from "@/components/ui/Button";
import type { ExhbtDoc } from "@/lib/exhbt/blocks";
import { FORMAT_COPY, formatOf, type Format } from "@/lib/exhbt/formats";
import { BLOCK_NAMES, blockValue, replaceBlock, sameBlock, type AiVersion, type BlockValue, type DraftBlock } from "@/lib/exhbt/draft-blocks";

/**
 * One "More actions" menu per card the AI drafts (docs/phase-2.md section 6): "Rewrite this block", "Back to the AI version" and how many rewrites are left.
 * The rules (limit, facts only, number check) are enforced by the server action; this shows them.
 */

export type DraftToolsInit = { aiVersion: AiVersion; rewritesLeft: number; rewritesLimit: number } | null | undefined;

export type DraftTools = {
  enabled: boolean;
  left: number;
  limit: number;
  ai: AiVersion;
  busy: DraftBlock | null;
  /** Latest outcome, per block: said aloud and shown beside the buttons. */
  message: { block: DraftBlock; text: string; ok: boolean; atLimit?: boolean } | null;
  doc: ExhbtDoc;
  rewrite: (block: DraftBlock, note: string) => Promise<boolean>;
  restore: (block: DraftBlock) => void;
};

export function useDraftTools(id: string, init: DraftToolsInit, doc: ExhbtDoc, setDoc: React.Dispatch<React.SetStateAction<ExhbtDoc>>): DraftTools {
  const [ai, setAi] = useState<AiVersion>(init?.aiVersion ?? { blocks: {}, unverified: {} });
  const [left, setLeft] = useState(init?.rewritesLeft ?? 0);
  const [busy, setBusy] = useState<DraftBlock | null>(null);
  const [message, setMessage] = useState<DraftTools["message"]>(null);

  async function rewrite(block: DraftBlock, note: string): Promise<boolean> {
    setBusy(block);
    setMessage(null);
    try {
      const r = await rewriteBlockAction(id, block, note, doc);
      if (!r.ok) {
        if (r.left !== undefined) setLeft(r.left);
        setMessage({ block, text: r.error, ok: false, atLimit: r.atLimit });
        return false;
      }
      setDoc((d) => replaceBlock(d, block, r.value as never, r.flags));
      setAi((a) => ({ blocks: { ...a.blocks, [block]: r.value }, unverified: { ...a.unverified, [block]: r.flags } }));
      setLeft(r.left);
      setMessage({
        block,
        ok: true,
        text: `Rewritten. ${r.left} ${r.left === 1 ? "rewrite" : "rewrites"} left.${r.flags.length ? " Check the flagged numbers at the top." : ""}`,
      });
      return true;
    } catch {
      setMessage({ block, text: "Couldn't reach the server. Nothing was changed. Try again in a moment.", ok: false });
      return false;
    } finally {
      setBusy(null);
    }
  }

  function restore(block: DraftBlock) {
    const v = ai.blocks[block];
    if (v === undefined) return;
    setDoc((d) => replaceBlock(d, block, structuredClone(v) as never, ai.unverified[block] ?? []));
    setMessage({ block, ok: true, text: "Back to the AI version." });
  }

  return { enabled: Boolean(init), left, limit: init?.rewritesLimit ?? 0, ai, busy, message, doc, rewrite, restore };
}

/**
 * What the rewrite calls each part. Not `{ ...BLOCK_NAMES, header: … }`: the build inlines that
 * spread into one object literal with "header" twice, and warns.
 */
const nameOf = (block: DraftBlock, f: Format): string => {
  if (f === "case-study") return block === "header" ? "question and details" : BLOCK_NAMES[block];
  // A gallery or research part has its own plain noun phrase (no article: the text says "the ...").
  return block === "skills" ? BLOCK_NAMES.skills : FORMAT_COPY[f].rewriteName[block];
};
/** What the card is called on the page, for the menu button's name. */
const cardNames = (f: Format): Record<DraftBlock, string> => ({ header: FORMAT_COPY[f].header, skills: "Skills", gap: FORMAT_COPY[f].gap, flow: FORMAT_COPY[f].flow, findings: f === "case-study" ? "Findings" : FORMAT_COPY[f].findings });

const ITEM = "flex w-full items-center gap-2 rounded-[8px] px-2.5 py-2 text-left text-[0.95rem] font-medium text-ink hover:bg-mist disabled:opacity-50";

export function BlockTools({ dt, block }: { dt: DraftTools; block: DraftBlock }) {
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const [note, setNote] = useState("");
  const root = useRef<HTMLDivElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const noneLeft = dt.left <= 0;
  // A rewrite is running (this block's or another's): Cancel is off, and so is Escape.
  const anyBusy = dt.busy !== null;

  useEffect(() => {
    if (!menu) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenu(false);
        trigger.current?.focus();
      }
    };
    const onPointer = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setMenu(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [menu]);

  // The panel (the rewrite form, or "No rewrites left") closes with Escape and gives the focus back to "More actions": here while
  // the focus is on nothing, as it is once "Rewrite this block" is pressed (the button goes with its menu), and in onKeyDown below
  // while it is in the panel. The menu takes its own Escape first, and a panel whose "More actions" isn't drawn (in a card that is
  // closed) is left alone; the button is asked, not this box, which the phone's bar lays out in its own row and draws no box for.
  // A press outside never closes the form, so a note typed in it is not lost (decision 0026: while it is open its toolbar stays,
  // wherever the pointer and the focus are); it does close "No rewrites left", which holds nothing and has no Cancel.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented || menu || anyBusy || !trigger.current?.getClientRects().length) return;
      if (document.activeElement && document.activeElement !== document.body) return;
      e.preventDefault();
      setOpen(false);
      trigger.current?.focus();
    };
    const onPointer = (e: PointerEvent) => {
      if (noneLeft && !root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open, menu, noneLeft, anyBusy]);

  if (!dt.enabled) return null;

  const name = nameOf(block, formatOf(dt.doc));
  const current = blockValue(dt.doc, block) as BlockValue;
  const ai = dt.ai.blocks[block];
  const edited = ai !== undefined && !sameBlock(current, ai);
  const pending = dt.busy === block;
  const msg = dt.message?.block === block ? dt.message : null;
  const noteId = `rewrite-note-${block}`;

  return (
    // data-open: its menu, or its panel (the rewrite form, or "No rewrites left"), is open. The edit-on-page editor draws
    // this in a toolbar over the page, which otherwise shows only under the pointer or the focus, and keeps that toolbar
    // up while this is set (components/exhbt-editor/css/core.css). Here, in a card, nothing reads it.
    <div
      ref={root}
      className="mb-3"
      data-testid={`tools-${block}`}
      data-open={menu || open ? "" : undefined}
      onKeyDown={(e) => {
        // Escape in the panel, or on "More actions", closes the panel before a toolbar round it hears the key: the edit-on-page
        // editor's compact card (Toolbar.tsx) would close and hide the form still open in it. The menu takes its own Escape first.
        if (e.key !== "Escape" || !open || menu) return;
        e.preventDefault();
        e.stopPropagation();
        if (anyBusy) return;
        setOpen(false);
        trigger.current?.focus();
      }}
    >
      <div ref={wrap} className="relative flex justify-end">
        <button
          ref={trigger}
          type="button"
          aria-label={`More actions for ${cardNames(formatOf(dt.doc))[block]}`}
          aria-expanded={menu}
          aria-controls={menuId}
          onClick={() => setMenu((m) => !m)}
          className="inline-flex size-9 items-center justify-center rounded-full border border-line bg-surface text-ink hover:border-ink"
        >
          <MoreHorizontal aria-hidden size={18} strokeWidth={2.25} />
        </button>
        <div id={menuId} hidden={!menu} data-tools-menu className="absolute top-full right-0 z-10 mt-1 w-64 rounded-[12px] border border-line bg-surface p-1.5 shadow-pack">
          <button
            type="button"
            className={ITEM}
            disabled={anyBusy}
            onClick={() => {
              setMenu(false);
              setOpen(true);
            }}
          >
            <Wand2 aria-hidden size={14} strokeWidth={2.25} /> Rewrite this block
          </button>
          {edited && (
            <button
              type="button"
              className={ITEM}
              disabled={anyBusy}
              onClick={() => {
                setMenu(false);
                dt.restore(block);
              }}
            >
              <RotateCcw aria-hidden size={14} strokeWidth={2.25} /> Back to the AI version
            </button>
          )}
          <p className="px-2.5 pt-1.5 pb-1 text-sm text-graphite" data-testid="rewrites-left">
            {dt.left} of {dt.limit} {dt.limit === 1 ? "rewrite" : "rewrites"} left
          </p>
        </div>
      </div>

      {/* The form, "No rewrites left" and the line that says how a rewrite went, in one box. Here, in a card, it is drawn in the
          flow; the edit-on-page editor draws it over the page, as a card of its own under the button, in the person's look
          (data-tools-menu and data-tools-panel: components/exhbt-editor/css/draft-tools.css). */}
      <div data-tools-panel>
        {open && (
          <div className="mt-2 rounded-[12px] border border-line px-3 py-2">
            {noneLeft ? (
              <p className="text-sm">
                No rewrites left on this exhbt.{" "}
                <Link href="/account/billing" className="link font-semibold text-ink">
                  See your plan
                </Link>
              </p>
            ) : (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (await dt.rewrite(block, note)) {
                    setOpen(false);
                    setNote("");
                  }
                }}
              >
                <label htmlFor={noteId} className="label">
                  Note for the rewrite <span className="font-normal text-graphite">(optional)</span>
                </label>
                <input
                  id={noteId}
                  className="field"
                  maxLength={200}
                  value={note}
                  placeholder="e.g. shorter, focus on the regression"
                  onChange={(e) => setNote(e.target.value)}
                />
                <p className="hint mt-1">It only steers the wording. It still draws only on your files.{edited && ` This replaces your edits to the ${name}.`}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button type="submit" variant="primary" size="sm" loading={pending} disabled={anyBusy} label={`Rewrite the ${name} now`}>
                    Rewrite now
                  </Button>
                  <Button size="sm" disabled={anyBusy} onClick={() => setOpen(false)}>
                    Cancel
                  </Button>
                </div>
              </form>
            )}
          </div>
        )}

        <div role="status" aria-live="polite" className="text-sm" data-testid="tools-status">
          {pending && <p className="mt-2 text-graphite">Rewriting the {name}…</p>}
          {msg && !pending && (
            <p className={`mt-2 ${msg.ok ? "font-semibold text-ink" : "text-error"}`}>
              {msg.text}{" "}
              {msg.atLimit && (
                <Link href="/account/billing" className="link font-semibold text-ink">
                  See your plan
                </Link>
              )}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
