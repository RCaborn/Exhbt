"use client";

import { useEffect, useMemo, type ReactNode } from "react";
import { blockOptions, pageItems, type BlockKind } from "@/lib/exhbt/layouts";
import { useRuntime, type UiApi } from "../context";
import { useFilesController, type FilesController } from "../files";
import { useStoreInternal } from "../store";
import type { Store } from "../store-core";
import { labelOf } from "../labels";

/*
 * The drag board (decision 0026, "Dragging"). F's: this is G's stub, which moves, adds and removes
 * through the store with no motion, so everything else can be built and tested against it. F replaces
 * the body; the signatures stay.
 */

export type Board = {
  /** Props for a section's grip button: the drag sensors, the keyboard handler, the ref. Spread onto the <button data-grip>. */
  grip(id: string): Record<string, unknown>;
  /** Move up (-1) or down (1) one place, with the motion and the words read out; keeps the focus on the button pressed. */
  moveBy(id: string, by: -1 | 1): void;
  /** Take a section off the page, with the motion, the words read out and the focus moved to what took its place. */
  remove(id: string): void;
  /** Add a block at a place, with the motion and the focus put in it. Returns its id, or null when there is no room. A graph then opens its figures sheet (`ui.open("chart", id)`); a link opens its "Web address" popover with the cursor in it (`ui.jumpTo` on its `href` path); an image opens the picture picker instead and is placed when the pictures are chosen; the flowchart, offered only when it is off the page, goes back at `at`. */
  add(kind: BlockKind, at: number): string | null;
  /** The section the focus was last in, for "add after the section you were last in". */
  lastFocus(): string | null;
};

const FIELD = 'textarea, input:not([type=file]), [contenteditable]:not([contenteditable="false"]), [role=textbox]';
const frameOf = (id: string) => document.querySelector<HTMLElement>(`[data-editor="page"] [data-section-id="${CSS.escape(id)}"]`);
const later = (fn: () => void) => requestAnimationFrame(() => requestAnimationFrame(fn));

const lastFocused = new WeakMap<Store, string | null>();

function makeBoard(store: Store, ui: UiApi, files: FilesController): Board {
  return {
    grip: () => ({}),
    moveBy(id, by) {
      const items = pageItems(store.get());
      const from = items.findIndex((it) => it.id === id);
      const to = from + by;
      if (from < 0 || to < 0 || to >= items.length) return;
      store.move(id, to);
      ui.say(`${labelOf(store.get(), id)} moved to place ${to + 1} of ${items.length}.`);
      later(() => {
        const frame = frameOf(id);
        const want = frame?.querySelector<HTMLButtonElement>(`[data-tool="${by < 0 ? "up" : "down"}"]`);
        (want && !want.disabled ? want : frame?.querySelector<HTMLButtonElement>(`[data-tool="${by < 0 ? "down" : "up"}"]`))?.focus();
      });
    },
    remove(id) {
      const before = pageItems(store.get());
      const at = before.findIndex((it) => it.id === id);
      const label = labelOf(store.get(), id);
      store.remove(id);
      ui.say(`${label} removed.`);
      later(() => {
        const after = pageItems(store.get());
        const next = after[Math.min(at, after.length - 1)];
        const frame = next && frameOf(next.id);
        (frame?.querySelector<HTMLElement>(FIELD) ?? frame?.querySelector<HTMLElement>("[data-grip]") ?? document.querySelector<HTMLElement>('[data-editor="page"] h1'))?.focus();
      });
    },
    add(kind, at) {
      if (kind === "image") {
        files.pick(at);
        return null;
      }
      const option = blockOptions(store.get()).find((o) => o.kind === kind);
      const id = store.insert(kind, at);
      if (!id) {
        if (option?.full) ui.say(option.full);
        return null;
      }
      ui.say(`${labelOf(store.get(), id)} added.`);
      if (kind === "graph") ui.open("chart", id);
      else
        later(() => {
          if (kind === "link") {
            const i = store.get().sections.findIndex((s) => s.id === id);
            ui.jumpTo(`sections.${i}.href`);
          } else frameOf(id)?.querySelector<HTMLElement>(FIELD)?.focus();
        });
      return id;
    },
    lastFocus: () => lastFocused.get(store) ?? null,
  };
}

/** Wraps the canvas (and the tray): the drag engine's context. G's stub draws its children and keeps the section the focus was last in. */
export function DragBoard(props: { children: ReactNode }): ReactNode {
  const store = useStoreInternal();
  useEffect(() => {
    const onFocus = (e: FocusEvent) => {
      const id = (e.target as Element | null)?.closest?.("[data-section-id]")?.getAttribute("data-section-id");
      if (id) lastFocused.set(store, id);
    };
    document.addEventListener("focusin", onFocus);
    return () => document.removeEventListener("focusin", onFocus);
  }, [store]);
  return props.children;
}

export function useBoard(): Board {
  const store = useStoreInternal();
  const { uiApi } = useRuntime();
  const files = useFilesController();
  return useMemo(() => makeBoard(store, uiApi, files), [store, uiApi, files]);
}
