"use client";

import "@/components/exhbt-editor/css/core.css";
import "./css/core.css";
import { memo, useEffect, useState, type ReactNode } from "react";
import { unstable_isUnrecognizedActionError, useRouter } from "next/navigation";
import { savePortfolioAction } from "@/app/(app)/portfolio/actions";
import { problemOf } from "@/app/(app)/portfolio/builder-state";
import type { PortfolioData } from "@/app/(app)/portfolio/load";
import type { BuilderState } from "@/app/(app)/portfolio/steps";
import { useBuilder } from "@/app/(app)/portfolio/useBuilder";
import { useAtom } from "@/components/exhbt-editor/atom";
import { ToastViewport } from "@astryxdesign/core/Toast";
import { GrowContext } from "@/components/exhbt-editor/fields/InlineText";
import { useNoZoomOnFocus } from "@/components/exhbt-editor/phone/noZoom";
import { Said } from "@/components/exhbt-editor/ui/Said";
import { Address } from "./Address";
import { EditorBar } from "./bar/EditorBar";
import { FirstRun } from "./bar/FirstRun";
import { Canvas } from "./Canvas";
import { keepUnsaved } from "./keep";
import { Notices } from "./Notices";
import { hasPending, noteSaved, noteSending, registerSender } from "./pending";
import {
  DataContext,
  RuntimeContext,
  usePortfolioState,
  usePortfolioUi,
  useRuntime,
  type PortfolioEditorApi,
  type PortfolioUi,
  type Runtime,
  type SaveView,
} from "./runtime";
import { createRuntime, type Host } from "./runtime-core";
import { STALE_EDITOR } from "./ui/SaveStatus";
import { VisitorView } from "./VisitorView";

/*
 * The one-page portfolio editor (decision 0031): the person's own page, in their look, with every word
 * typed where it sits. Loaded only in the browser, inside the gate's error boundary (PortfolioGate.tsx),
 * so a throw here reloads the page into the step builder.
 *
 * Saving is the step builder's own (`useBuilder`, used and never changed): a change shows at once, is
 * sent 0.6s after the last one and when the tab is hidden, and a state the rules refuse is not sent.
 * This component is the only one that renders on every change, and it draws nothing itself: everything
 * under it reads the runtime (runtime.ts) and draws again only when its own slice changes.
 *
 * Development only: `?crash=render` throws whenever it draws, `?crash=change` on the render after the
 * first change (e2e/portfolio-core.spec.ts); `?save=stale` makes every save fail as a stale tab's does,
 * `?save=fail` as a refused one does; `?grow=mirror` makes the fields grow by their hidden mirror, as
 * they do in a browser with no `field-sizing`.
 */

declare global {
  interface Window {
    /** Development only: the editor's state, view and actions, for e2e/portfolio-editor.ts. */
    __portfolioEditor?: {
      state(): BuilderState;
      ui(): PortfolioUi;
      save(): SaveView;
      undoLabel(): string | null;
      /** Whether a change is still waiting for the server to have it. */
      waiting(): boolean;
      api: PortfolioEditorApi;
    };
  }
}

export type PortfolioEditorProps = {
  data: PortfolioData;
  /** The Team sheet's contents, drawn on the server so its buttons keep their own actions. */
  team: ReactNode;
  /** The Job links menu's contents, drawn on the server. */
  jobLinks: ReactNode;
};

const devParam = (key: string) =>
  process.env.NODE_ENV !== "production" && typeof window !== "undefined"
    ? new URLSearchParams(window.location.search).get(key)
    : null;

/** Next's words for an action it does not have: its error's, and the body it sends when a proxy drops its header (as components/exhbt-editor/Autosave.tsx reads them). */
const NO_SUCH_ACTION =
  /Server Action ".*" was not found on the server|Failed to find Server Action|^Server action not found/i;
const isStale = (e: unknown) =>
  unstable_isUnrecognizedActionError(e) ||
  (e instanceof Error &&
    (e.name === "UnrecognizedActionError" || NO_SUCH_ACTION.test(e.message)));

type SaveResult = { ok: true } | { ok: false; error: string };

type Visit = {
  rt: Runtime;
  host: Host;
  /** The state and the person the editor was opened with: what the server had then. */
  loaded: BuilderState;
  owner: string;
  /** The save `useBuilder` calls. */
  save(state: BuilderState): Promise<SaveResult>;
  /** The crash fallback's own send, through the same action. */
  send(state: BuilderState): Promise<boolean>;
};

function startVisit(loaded: BuilderState, owner: string): Visit {
  const host: Host = { change: () => {}, retry: () => {} };
  const rt = createRuntime(loaded, host);

  async function send(state: BuilderState): Promise<SaveResult> {
    // Once the site has been updated under this tab nothing more can be saved from it: every later state
    // follows the first into the browser, to be offered back after the reload (keep.ts, Notices.tsx).
    if (rt.save.get().stale) {
      keepUnsaved(owner, state);
      return { ok: false, error: STALE_EDITOR };
    }
    try {
      if (devParam("save") === "stale")
        throw Object.assign(
          new Error(
            'Server Action "dev" was not found on the server. (?save=stale, development only)',
          ),
          { name: "UnrecognizedActionError" },
        );
      if (devParam("save") === "fail")
        return {
          ok: false,
          error: "The save was told to fail (?save=fail, development only).",
        };
      const r = await savePortfolioAction(state);
      if (!r.ok) return { ok: false, error: r.error };
      // The server has it, as of its own clock: noted for the crash fallback and for the gate (pending.ts).
      noteSaved(state, r.savedAt);
      return { ok: true };
    } catch (e) {
      // Anything else is thrown on to useBuilder, which says the server could not be reached.
      if (!isStale(e)) throw e;
      console.error(
        "The server has no such action: this page is older than the site.",
        e,
      );
      rt.save.set((v) => ({ ...v, stale: true }));
      keepUnsaved(owner, state);
      return { ok: false, error: STALE_EDITOR };
    }
  }
  /** Every save is noted while it is on its way: the gate and the crash fallback wait for it (pending.ts). */
  const tracked = (state: BuilderState) => {
    const run = send(state);
    noteSending(run);
    return run;
  };

  return {
    rt,
    host,
    loaded,
    owner,
    save: tracked,
    send: async (state) =>
      (await tracked(state).catch(() => ({ ok: false as const }))).ok,
  };
}

export function PortfolioEditor({
  data,
  team,
  jobLinks,
}: PortfolioEditorProps): ReactNode {
  if (devParam("crash") === "render")
    throw new Error(
      "The portfolio editor was told to fail (?crash=render, development only).",
    );
  // The visit starts from the page as it was loaded. A later refresh brings new data (a photo, an address,
  // a publish in another tab) and never resets what the person has typed.
  const [visit] = useState(() => startVisit(data.builder.initial, data.owner));
  const { rt } = visit;
  const builder = useBuilder<BuilderState>(visit.loaded, visit.save, problemOf);
  // The runtime's one way to change the state and to send it: useBuilder's own.
  visit.host.change = builder.change;
  visit.host.retry = builder.retry;
  const [ready, setReady] = useState(false);
  const router = useRouter();
  // An iPhone zooms in on a field under 16px, and much of the page's own type is under it.
  useNoZoomOnFocus();

  // What useBuilder says of the save, for the status line.
  const status = builder.status;
  useEffect(() => {
    rt.save.set((v) => ({ ...v, status }));
  }, [rt, status]);

  useEffect(() => {
    setReady(true);
    // Development only: the browser tests read the editor's state and call its actions (e2e/portfolio-editor.ts).
    if (process.env.NODE_ENV !== "production")
      window.__portfolioEditor = {
        state: rt.state.get,
        ui: rt.ui.get,
        save: rt.save.get,
        undoLabel: () => rt.undo.get().label,
        waiting: hasPending,
        api: rt.api,
      };
    // The crash fallback sends the newest state through the same action. Registered once, with what the
    // server had when the editor opened: a refresh must not make it forget a change that is still waiting.
    return registerSender({ send: visit.send }, visit.owner, visit.loaded);
  }, [rt, visit]);

  // The browser's Back, bringing this document back whole from its own cache: what other pages did since
  // (an exhbt's title, a publish) is fetched. The editor's state is as the person left it.
  useEffect(() => {
    const shown = (e: PageTransitionEvent) => {
      if (e.persisted) router.refresh();
    };
    window.addEventListener("pageshow", shown);
    return () => window.removeEventListener("pageshow", shown);
  }, [router]);

  return (
    <RuntimeContext value={rt}>
      <DataContext value={data}>
        <Shell ready={ready} team={team} jobLinks={jobLinks} />
      </DataContext>
    </RuntimeContext>
  );
}

/**
 * Everything the editor draws. Memoised: its props are the same from one key to the next, so the root's
 * own render (useBuilder's) stops here.
 */
const Shell = memo(function Shell({
  ready,
  team,
  jobLinks,
}: {
  ready: boolean;
  team: ReactNode;
  jobLinks: ReactNode;
}): ReactNode {
  const grow = devParam("grow") === "mirror" ? "mirror" : null;
  return (
    // Astryx's toasts (the note after ?at=) are drawn in this viewport, inside the app's theme.
    <ToastViewport position="bottomEnd">
      <GrowContext value={grow}>
        <div data-editor="portfolio" data-ready={ready ? "true" : undefined}>
          <EditorBar team={team} jobLinks={jobLinks} />
          <Notices />
          <FirstRun />
          <Body />
          <UndoKeys />
          <LiveRegion />
          {ready && <Address />}
          {devParam("crash") === "change" && <CrashOnChange />}
        </div>
      </GrowContext>
    </ToastViewport>
  );
});

/** The editing page, or "See as a visitor" in its place (the bar's button, `seeAsVisitor`). */
function Body(): ReactNode {
  const visitor = usePortfolioUi((u) => u.visitor);
  return visitor ? <VisitorView /> : <Canvas />;
}

/** Inside a text field Ctrl or Cmd and Z is the field's own undo; nothing of the editor's takes it there. */
const inField = (el: Element | null) =>
  Boolean(
    el?.closest(
      'textarea, input, select, [contenteditable]:not([contenteditable="false"])',
    ),
  );

/**
 * Ctrl or Cmd and Z outside a text field: the editor's Undo, as the bar's button does it (decision 0031,
 * "Undo"). Shift or Alt with it is left to the browser, and so is the key when there is nothing to undo.
 */
function UndoKeys(): ReactNode {
  const rt = useRuntime();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        !(e.ctrlKey || e.metaKey) ||
        e.shiftKey ||
        e.altKey ||
        e.key.toLowerCase() !== "z"
      )
        return;
      if (inField(document.activeElement) || !rt.undo.get().label) return;
      e.preventDefault();
      rt.undoLast();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [rt]);
  return null;
}

/** The one polite live region: what `say` says. */
function LiveRegion(): ReactNode {
  const said = useAtom(useRuntime().said);
  return <Said text={said.text} n={said.n} data-said={said.n} />;
}

/** Development only (`?crash=change`): throws on the render after the first change, for the crash fallback's test. */
function CrashOnChange(): ReactNode {
  const state = usePortfolioState((s) => s);
  const [first] = useState(state);
  if (state !== first)
    throw new Error(
      "The portfolio editor was told to fail after a change (?crash=change, development only).",
    );
  return null;
}
