"use client";

import "./css/draft-tools.css";
import { createContext, useContext, useMemo, useSyncExternalStore } from "react";
import { rewriteBlockAction } from "@/app/(app)/exhbts/[id]/draft-tools-actions";
import { BlockTools, type DraftTools, type DraftToolsInit } from "@/components/editor/BlockTools";
import type { ExhbtDoc } from "@/lib/exhbt/blocks";
import { BLOCK_NAMES, blockValue, replaceBlock, type AiVersion, type DraftBlock } from "@/lib/exhbt/draft-blocks";
import { atom, useAtom, type Atom } from "./atom";
import { useStoreInternal } from "./store";
import type { Store } from "./store-core";

/*
 * "More actions" (rewrite, back to the AI version) on the parts the AI drafted, with the classic
 * editor's BlockTools (components/editor/BlockTools.tsx) drawn as it is. BlockTools takes a DraftTools;
 * this makes one on the editor's store instead of React state, so a rewrite and "Back to the AI
 * version" are each one undo entry (decision 0026, "Undo"), and a rewrite sends the doc as it is when
 * the person presses it. The state (the AI version, rewrites left, the last message) is shared by
 * every BlockTools on the page.
 */

type Shared = { ai: AiVersion; left: number; busy: DraftBlock | null; message: DraftTools["message"] };
export type DraftToolsRuntime = { init: DraftToolsInit; shared: Atom<Shared>; rewrite: DraftTools["rewrite"]; restore: DraftTools["restore"] };

export function createDraftTools(store: Store, id: string, init: DraftToolsInit): DraftToolsRuntime {
  const shared = atom<Shared>({ ai: init?.aiVersion ?? { blocks: {}, unverified: {} }, left: init?.rewritesLeft ?? 0, busy: null, message: null });
  const set = (p: Partial<Shared>) => shared.set((s) => ({ ...s, ...p }));
  return {
    init,
    shared,
    async rewrite(block, note) {
      set({ busy: block, message: null });
      try {
        const r = await rewriteBlockAction(id, block, note, store.get());
        if (!r.ok) {
          set({ message: { block, text: r.error, ok: false, atLimit: r.atLimit }, ...(r.left !== undefined ? { left: r.left } : {}) });
          return false;
        }
        store.patchDoc((d) => replaceBlock(d, block, r.value as never, r.flags), `the rewrite of the ${BLOCK_NAMES[block]}`);
        shared.set((s) => ({
          ...s,
          ai: { blocks: { ...s.ai.blocks, [block]: r.value }, unverified: { ...s.ai.unverified, [block]: r.flags } },
          left: r.left,
          message: { block, ok: true, text: `Rewritten. ${r.left} ${r.left === 1 ? "rewrite" : "rewrites"} left.${r.flags.length ? " Check the flagged numbers." : ""}` },
        }));
        return true;
      } catch {
        set({ message: { block, text: "Couldn't reach the server. Nothing was changed. Try again in a moment.", ok: false } });
        return false;
      } finally {
        set({ busy: null });
      }
    },
    restore(block) {
      const v = shared.get().ai.blocks[block];
      if (v === undefined) return;
      store.patchDoc((d) => replaceBlock(d, block, structuredClone(v) as never, shared.get().ai.unverified[block] ?? []), `back to the AI version of the ${BLOCK_NAMES[block]}`);
      set({ message: { block, ok: true, text: "Back to the AI version." } });
    },
  };
}

export const DraftToolsContext = createContext<DraftToolsRuntime | null>(null);

/** What a block's value depends on, as one string for the header (whose value is a new object each time) or the slice itself. */
const sliceOf = (d: ExhbtDoc, block: DraftBlock): unknown =>
  block === "header" ? JSON.stringify(blockValue(d, "header")) : block === "findings" ? d.sections.find((s) => s.kind === "findings") : blockValue(d, block);

/** "More actions" for one block the AI drafted, or nothing when the exhbt has no AI version. A leaf: it reads its own block's slice. */
export function MoreActions({ block }: { block: DraftBlock }) {
  const rt = useContext(DraftToolsContext);
  const store = useStoreInternal();
  // Drawn again when this block's words change, so "Back to the AI version" shows only once they differ.
  useSyncExternalStore(
    store.subscribe,
    () => sliceOf(store.get(), block),
    () => sliceOf(store.get(), block),
  );
  const shared = useAtom(rt?.shared ?? EMPTY);
  const dt = useMemo<DraftTools | null>(
    () => (rt ? { enabled: Boolean(rt.init), left: shared.left, limit: rt.init?.rewritesLimit ?? 0, ai: shared.ai, busy: shared.busy, message: shared.message, doc: store.get(), rewrite: rt.rewrite, restore: rt.restore } : null),
    // `store.get()` is read on each render: this leaf renders whenever its block changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rt, shared, store, store.get()],
  );
  if (!dt?.enabled) return null;
  return <BlockTools dt={dt} block={block} />;
}

const EMPTY = atom<Shared>({ ai: { blocks: {}, unverified: {} }, left: 0, busy: null, message: null });
