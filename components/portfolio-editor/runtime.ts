"use client";

import { createContext, useContext } from "react";
import type { PortfolioData } from "@/app/(app)/portfolio/load";
import type { BuilderState } from "@/app/(app)/portfolio/steps";
import type { SaveStatus } from "@/app/(app)/portfolio/useBuilder";
import { useAtom, type Atom } from "@/components/exhbt-editor/atom";
import type { HomePath } from "@/components/portfolio/home-ctx";

/*
 * What every part of the one-page portfolio editor reads and calls (decision 0031): the edited state
 * (`BuilderState`, the step builder's own), what the loader gave, the view (the open sheet, a look being
 * previewed, each field's problem) and the actions. The sections and tiles (F), the bar and its sheets
 * (G) and the phone's parts (I) are built on the four hooks below and nothing else of the editor's.
 *
 * The state is kept in an atom outside React, written in the same breath as the change itself, so a part
 * that reads one slice draws again only when that slice changes, and a field's words are back in it
 * before the browser paints the key. PortfolioEditor.tsx makes the runtime; saving is `useBuilder`'s.
 */

/** The menus, sheets and popovers a part can ask for by name. */
export type PortfolioSheet = "photo" | "look" | "address" | "job-links" | "team" | "links" | "reorder" | "item";

export type PortfolioEditorApi = {
  /** Applies a change at once and saves it shortly after. `undo` is the past-tense phrase Undo names ("removed Experience"); typing passes none. */
  change(update: (s: BuilderState) => BuilderState, undo?: string): void;
  /** Writes one field by its path, with no undo entry (typing). */
  setAt(path: HomePath, value: unknown): void;
  /** Opens a menu, sheet or popover by name; close() puts the focus back where it was. */
  open(sheet: PortfolioSheet): void;
  close(): void;
  /** Says something in the polite live region. */
  say(message: string): void;
  /** Scrolls to and focuses the field or anchor with this data-path, opening what it lives in first. */
  jumpTo(path: HomePath): void;
  /** Draws the page in another look without saving it (a locked look); null goes back to the saved one. */
  previewLook(themeId: string | null): void;
  /** "See as a visitor" on or off: the canvas draws the visitor's page (VisitorView.tsx) in place of the editing page. The bar's button calls it. */
  seeAsVisitor(on: boolean): void;
};

/** The view: what is open, and what the page is being shown as. */
export type PortfolioUi = {
  /** The open sheet. */
  sheet: PortfolioSheet | null;
  /** The look being previewed (a locked look, never saved), or null. */
  previewing: string | null;
  /** Each path's problem: what stops a save, at the field it is about. */
  issues: Record<HomePath, string>;
  /** "See as a visitor" is on. */
  visitor: boolean;
  /** The address said `?full=1`: the Add tile gives the plan's reason in the alert tone. */
  full: boolean;
  /** The exhbt the address pointed at (`?at=`), marked for two seconds. */
  marked: string | null;
  /** The note after joining or leaving a team project (`?joined=1`, `?left=1`), for the Team sheet. */
  team: "joined" | "left" | null;
};

/** The save's state as the status line reads it. */
export type SaveView = {
  status: SaveStatus;
  /** The site was updated under this tab: its save action is gone, and only a reload carries on. */
  stale: boolean;
};

/** A line's two halves as they are being typed, and the stored line they made (fields/TextField.tsx). */
export type LineDraft = { label: string; year: string; line: string };

/** What Undo would undo ("removed Experience"), or null. */
export type UndoView = { label: string | null };

/** The editor's working parts. Only the editor's own files read this; everything else uses the hooks below. */
export type Runtime = {
  state: Atom<BuilderState>;
  ui: Atom<PortfolioUi>;
  save: Atom<SaveView>;
  undo: Atom<UndoView>;
  said: Atom<{ text: string; n: number }>;
  /** The lines of education and experience being typed, by path: each half as typed, while the stored line is still theirs. */
  lines: Atom<Record<HomePath, LineDraft>>;
  api: PortfolioEditorApi;
  /** Undoes the newest entry and says so. */
  undoLast(): void;
  /** Sends what is waiting now (the status line's Retry). */
  retry(): void;
};

export const RuntimeContext = createContext<Runtime | null>(null);
export const DataContext = createContext<PortfolioData | null>(null);

export function useRuntime(): Runtime {
  const rt = useContext(RuntimeContext);
  if (!rt) throw new Error("The portfolio editor's hooks need its runtime (components/portfolio-editor/PortfolioEditor.tsx).");
  return rt;
}

/** Stable for the editor's life: reading it never re-renders. */
export function usePortfolioApi(): PortfolioEditorApi {
  return useRuntime().api;
}

/** A slice of the edited state: re-renders only when the selected value changes (Object.is). */
export function usePortfolioState<T>(select: (s: BuilderState) => T): T {
  return useAtom(useRuntime().state, select);
}

/** What the loader gave, the newest after a refresh. */
export function usePortfolioData(): PortfolioData {
  const data = useContext(DataContext);
  if (!data) throw new Error("The portfolio editor's hooks need its data (components/portfolio-editor/PortfolioEditor.tsx).");
  return data;
}

/**
 * The open sheet, the look being previewed, and each path's problem. With `select`, one slice of it:
 * re-renders only when the selected value changes.
 */
export function usePortfolioUi(): PortfolioUi;
export function usePortfolioUi<T>(select: (u: PortfolioUi) => T): T;
export function usePortfolioUi<T>(select?: (u: PortfolioUi) => T): T | PortfolioUi {
  return useAtom(useRuntime().ui, select as (u: PortfolioUi) => T | PortfolioUi);
}

/** The save's state, for the status line. */
export function usePortfolioSave(): SaveView {
  return useAtom(useRuntime().save);
}

/**
 * Undo, for a part of the bar that offers it somewhere of its own (the folded menu on a narrow window):
 * the label of the step Undo would reverse ("removed Experience"), or null when there is none, and the
 * action. `undo` is the same function for the editor's life.
 */
export function usePortfolioUndo(): { label: string | null; undo(): void } {
  const rt = useRuntime();
  const label = useAtom(rt.undo, (u) => u.label);
  return { label, undo: rt.undoLast };
}
