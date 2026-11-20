"use client";

import { createContext, useContext, useMemo, useSyncExternalStore } from "react";
import { validateForPublish, type ExhbtDoc, type Issue } from "@/lib/exhbt/blocks";
import type { FieldPath } from "@/components/portfolio/page-ctx";
import type { PortfolioTheme } from "@/lib/portfolio-themes";
import type { EditorProps } from "@/components/editor/Editor";
import { visibleIssues } from "@/components/editor/model";
import { atom, useAtom, type Atom } from "./atom";
import { useStoreInternal } from "./store";

/*
 * What every part of the edit-on-page editor reads, besides the doc (store.ts): the page's props, the
 * view and its sheets, the issues, autosave and the formatted field with the cursor (decision 0026).
 * Each is held outside React and read by hook, so a part re-renders only when what it reads changes.
 * The runtime behind them is made once per visit in EditorShell.tsx.
 */

/** What the edit page passes: the classic editor's props, plus the person's look and the stored reports a figure can be taken from. */
export type PageEditorProps = EditorProps & {
  theme: PortfolioTheme;
  /** The person's stored PDFs for this exhbt, for "Take a figure from my report" when nothing was picked. */
  reportFiles: { fileId: string; name: string; url: string }[];
};

export type SheetName = "publish" | "card" | "work" | "chart" | "figure" | "reorder";
export type Ui = {
  /** The sheet that is open, if any. `sectionId` for the chart and figure sheets. */
  sheet: { name: SheetName; sectionId?: string } | null;
  open(name: SheetName, sectionId?: string): void;
  close(): void;
  /** Scrolls to the field for an issue path and puts the cursor in it, opening its sheet first when it lives in one. */
  jumpTo(path: FieldPath): void;
  /** Says something in the polite live region. */
  say(text: string): void;
  /** The view: editing, or "See as a visitor". */
  visitor: boolean;
  setVisitor(on: boolean): void;
  /** The publish tick ("This is my work, and the numbers are true"). The page draws its "Confirmed by" check from it. */
  confirmed: boolean;
  setConfirmed(on: boolean): void;
};

/** The formatted field that has the cursor, if one does: what its buttons do and which are on. For the phone's bar. */
/** `toggleLink()` with no link on opens the field's own address prompt (as the classic editor's formatted field does, with its error for an address that is not https); with one on, it removes it. */
export type ActiveRich = { highlight: boolean; bold: boolean; italic: boolean; link: boolean; toggleBold(): void; toggleItalic(): void; toggleLink(): void };

export type SaveApi = { status: { state: "saved" | "waiting" | "saving" | "retrying" | "error"; error?: string }; flush(): Promise<void>; settled(): Promise<void>; markSaved(d: ExhbtDoc): void };

/** What `useSave().status.error` says when a save failed for a reason other than the network: the page's server actions are gone (a deploy or a rollback since it was opened). */
export const STALE_EDITOR = "The editor was updated. Reload to carry on; your changes are kept in this browser.";

/** The view's own state, outside React. */
export type UiState = {
  sheet: Ui["sheet"];
  visitor: boolean;
  confirmed: boolean;
  /** Publishing has been tried: every issue is shown from then on. */
  tried: boolean;
  /** The last thing said in the live region, and a count so the same words can be said twice. */
  said: { text: string; n: number };
};

export type UiApi = Pick<Ui, "open" | "close" | "jumpTo" | "say" | "setVisitor" | "setConfirmed"> & { setTried(v: boolean): void };

/** Whether the exhbt is live, and at which slug: what the page was opened with, then what publishing and unpublishing say. */
export type LiveStatus = { status: "draft" | "published"; slug: string | null };

/** One visit's runtime: made once in EditorShell.tsx. */
export type Runtime = {
  env: PageEditorProps;
  ui: Atom<UiState>;
  uiApi: UiApi;
  save: Atom<SaveApi>;
  activeRich: Atom<ActiveRich | null>;
  status: Atom<LiveStatus>;
};

export const RuntimeContext = createContext<Runtime | null>(null);

export function useRuntime(): Runtime {
  const r = useContext(RuntimeContext);
  if (!r) throw new Error("The editor's hooks need its RuntimeContext (components/exhbt-editor/EditorShell.tsx).");
  return r;
}

export const initialUi = (): UiState => ({ sheet: null, visitor: false, confirmed: false, tried: false, said: { text: "", n: 0 } });

export const initialSave = (): SaveApi => ({ status: { state: "saved" }, flush: () => Promise.resolve(), settled: () => Promise.resolve(), markSaved: () => {} });

/** The runtime's atoms, before the jump and the save are wired in (EditorShell.tsx does that). */
export function createRuntime(env: PageEditorProps, jumpTo: (path: FieldPath, ui: UiApi) => void): Runtime {
  const ui = atom(initialUi());
  const uiApi: UiApi = {
    open: (name, sectionId) => ui.set((s) => ({ ...s, sheet: { name, ...(sectionId ? { sectionId } : {}) } })),
    close: () => ui.set((s) => (s.sheet ? { ...s, sheet: null } : s)),
    jumpTo: (path) => jumpTo(path, uiApi),
    say: (text) => ui.set((s) => ({ ...s, said: { text, n: s.said.n + 1 } })),
    setVisitor: (on) => ui.set((s) => (s.visitor === on ? s : { ...s, visitor: on })),
    setConfirmed: (on) => ui.set((s) => (s.confirmed === on ? s : { ...s, confirmed: on })),
    setTried: (v) => ui.set((s) => (s.tried === v ? s : { ...s, tried: v })),
  };
  return { env, ui, uiApi, save: atom(initialSave()), activeRich: atom<ActiveRich | null>(null), status: atom<LiveStatus>({ status: env.status, slug: env.slug }) };
}

/**
 * Whether the exhbt is live now, its slug, and its live address (`liveBase` + slug, when there is a
 * username): `useEnv()` holds only what the page was opened with, so the top bar's chip, "Unpublish"
 * and the publish sheet read this instead. After publishing works, call `set({ status: "published",
 * slug })` with the slug publishExhbt answered; after unpublishing works, `set({ status: "draft" })`.
 */
export function useStatus(): LiveStatus & { liveUrl: string | null; set(next: Partial<LiveStatus>): void } {
  const { env, status } = useRuntime();
  const s = useAtom(status);
  return useMemo(
    () => ({
      ...s,
      liveUrl: s.status === "published" && s.slug && env.liveBase ? `${env.liveBase}/${s.slug}` : null,
      set: (next: Partial<LiveStatus>) => status.set((cur) => ({ ...cur, ...next })),
    }),
    [s, env.liveBase, status],
  );
}

/** One slice of the view's state. */
export function useUiState<S>(select: (s: UiState) => S): S {
  return useAtom(useRuntime().ui, select);
}

/** The formatted field that has the cursor, if one does. */
export function useActiveRich(): ActiveRich | null {
  return useAtom(useRuntime().activeRich);
}

export function useUi(): Ui {
  const { ui, uiApi } = useRuntime();
  const s = useAtom(ui);
  return useMemo(() => ({ ...uiApi, sheet: s.sheet, visitor: s.visitor, confirmed: s.confirmed }), [uiApi, s.sheet, s.visitor, s.confirmed]);
}

export function useEnv(): PageEditorProps {
  return useRuntime().env;
}

type Issues = { all: Issue[]; shown: Issue[]; at(path: FieldPath): Issue[]; tried: boolean; setTried(v: boolean): void };

/** The issues for a doc, worked out once per doc and per "tried". */
const issuesCache = new WeakMap<ExhbtDoc, { all: Issue[]; shown: Map<boolean, Issue[]> }>();
export function issuesOf(doc: ExhbtDoc, tried: boolean): { all: Issue[]; shown: Issue[] } {
  let c = issuesCache.get(doc);
  if (!c) {
    c = { all: validateForPublish(doc), shown: new Map() };
    issuesCache.set(doc, c);
  }
  let shown = c.shown.get(tried);
  if (!shown) {
    shown = visibleIssues(doc, c.all, tried);
    c.shown.set(tried, shown);
  }
  return { all: c.all, shown };
}

/** Every issue that stops publishing (validateForPublish), and the ones worth showing now (visibleIssues in components/editor/model.ts). */
export function useIssues(): Issues {
  const store = useStoreInternal();
  const { ui, uiApi } = useRuntime();
  const doc = useSyncExternalStore(store.subscribe, store.get, store.get);
  const tried = useAtom(ui, (s) => s.tried);
  return useMemo(() => {
    const { all, shown } = issuesOf(doc, tried);
    return { all, shown, at: (path: FieldPath) => shown.filter((i) => i.path === path), tried, setTried: uiApi.setTried };
  }, [doc, tried, uiApi]);
}

/** Autosave, as components/editor/useAutosave.ts returns it. */
export function useSave(): { status: { state: "saved" | "waiting" | "saving" | "retrying" | "error"; error?: string }; flush(): Promise<void>; settled(): Promise<void>; markSaved(d: ExhbtDoc): void } {
  return useAtom(useRuntime().save);
}
