"use client";

import "@/components/exhbt-editor/css/core.css";
import "./css/core.css";
import { memo, useEffect, useState, type ReactNode } from "react";
import { unstable_isUnrecognizedActionError } from "next/navigation";
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
import { forgetUnsaved, keepUnsaved } from "./keep";
import { watchLeaving } from "./leaving";
import { Notices } from "./Notices";
import { hasPending, noteSaved, noteSending, registerSender } from "./pending";
import {
  DataContext,
  RuntimeContext,
  usePortfolioState,
  usePortfolioUi,
  useRuntime,
  type PortfolioEditorApi,
  type Going,
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
  /** The editor is on the page. */
  here(): void;
  /** The editor has been taken off the page (a link inside the app): what the server has not got is kept for the next visit (leftBehind). */
  left(): void;
  /**
   * A navigation the editor started is over and the editor is still on the page: new data for the page has come (a
   * navigation that came back here).
   */
  stayed(): void;
  /**
   * The browser asked "Leave site?" and the page stayed: the navigation is over, unless a save asked for now could still
   * be dropped (startVisit's `asked`).
   */
  asked(): void;
};

function startVisit(loaded: BuilderState, owner: string): Visit {
  const host: Host = { change: () => {}, retry: () => {}, navigating: (to) => navigating(to) };
  const rt = createRuntime(loaded, host);
  /** What the server has said it has, for this visit alone (pending.ts's notes are the document's, and a later visit's). */
  let confirmed = loaded;
  /** Set once the editor has been taken off the page: from then on its state cannot change. */
  let gone = false;
  /** Set just after that, once the work of that moment is done (useBuilder's own send as the editor goes): see `save`. */
  let closed = false;
  /** Keeps the newest state in this browser, for the next visit to offer back, unless the server has it. */
  const keepNewest = () => {
    const newest = rt.state.get();
    if (newest !== confirmed) keepUnsaved(owner, newest, rt.save.get().stale ? "stale" : "left");
  };

  /**
   * A navigation the editor started (a press on a link out of the page, a phone's More, Open: leaving.ts), from its
   * start until it is over: the editor is off the page, or it is still here (`stayed`, `asked`). Next runs one router
   * action at a time, and a navigation goes ahead of the one that is running. When it does, an action asked for before
   * the navigation is over can be dropped: the end of Next's queue is left at the action the navigation went ahead of,
   * and one added after it is never run (next 15.5's app-router-instance.js, dispatchAction). A save dropped there never
   * leaves the browser and never answers. One that is not dropped runs once the navigation is over. So a save asked for
   * in that time waits until then (`tracked`) and goes, with the newest words, which costs it nothing, and the gate can
   * wait for every save, however long it takes, without waiting for one that will never come: it never opens on words
   * that an older save on its way can still overwrite.
   */
  let underWay = false;
  /**
   * The navigation under way went ahead of a save of this visit's that Next had not answered: until it is over, a save
   * asked for can be dropped. Without one the navigation is the last thing in Next's queue, a save asked for runs after
   * it, and nothing is dropped. (Only this visit's saves are counted, the one kind a person makes all the time: a
   * sheet's own action, a claim or a photo, on its way at a press is not, and the hold does not wait for it.)
   */
  let mayDrop = false;
  /** This visit's saves that Next has been handed and has not answered. */
  let onItsWay = 0;
  /** The saves asked for while it is under way, each sent when it is over: at once, in that moment, before anything else is asked of Next. */
  const waiting: (() => void)[] = [];
  function navigating(to: Going): void {
    // To this page afresh with nothing on its way, a save asked for runs after Next's navigation and none is dropped,
    // and the page's new data, which ends a hold, may not come (a page Next has kept): nothing is held.
    if (to === "again" && onItsWay === 0) return;
    underWay = true;
    if (onItsWay > 0) mayDrop = true;
  }
  function navigationOver(): void {
    underWay = false;
    mayDrop = false;
    for (const go of waiting.splice(0)) go();
  }
  /**
   * "Leave site?" was answered Stay. Next asks it when it gives up on a navigation (a page it could not fetch, which it
   * then loads afresh), and the navigation is over then. A reload asks it too, while the navigation is still under way,
   * and the two cannot be told apart from here: so the hold ends only when no save can be dropped (`mayDrop`), and
   * otherwise it lasts until the editor goes or new data comes. Left over: a save on its way at the press, a next page
   * Next cannot fetch, and Stay. The saves then wait until the person leaves by a link, or the page goes for good
   * (`pagehide` keeps the words, leaving.ts), and the status says Saving all the while.
   */
  function asked(): void {
    if (!mayDrop) navigationOver();
  }

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
      onItsWay++;
      const r = await savePortfolioAction(state).finally(() => {
        onItsWay--;
      });
      if (!r.ok) return { ok: false, error: r.error };
      // The server has it, as of its own clock: noted for the crash fallback and for the gate (pending.ts).
      noteSaved(state, r.savedAt);
      confirmed = state;
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
  /**
   * Sends a state, noted while it is on its way and until it is answered: the gate and the crash fallback wait for it
   * (pending.ts), however long it takes, because a save that has left the browser can still land. One asked for while a
   * navigation the editor started is under way is sent once that is over (`underWay`), with the newest state in its
   * place: useBuilder asks for one save at a time, so words typed while the next page was coming would otherwise wait
   * behind it, for a save that is never sent once the editor has gone (`save`). Not a state the rules refuse, which
   * useBuilder never sends: then the one it asked for goes. Once the editor has gone nothing sends again a save that
   * fails, so the newest words are kept for the next visit (again: a stale answer has just kept the older words it
   * carried); one that lands with the newest words takes back what was kept.
   */
  const tracked = (state: BuilderState): Promise<SaveResult> => {
    let sent = state;
    const run = underWay
      ? new Promise<SaveResult>((done, fail) =>
          waiting.push(() => {
            const newest = rt.state.get();
            if (newest !== state && !problemOf(newest)) sent = newest;
            void send(sent).then(done, fail);
          }),
        )
      : send(state);
    noteSending(run);
    void run.then(
      (r) => {
        if (!gone) return;
        if (!r.ok) keepNewest();
        else if (sent === rt.state.get()) forgetUnsaved(owner, sent);
      },
      () => {
        if (gone) keepNewest();
      },
    );
    return run;
  };

  /**
   * The save useBuilder calls. Once the editor has gone, useBuilder asks again only when a save that was on its way has
   * answered and newer words were waiting behind it, at a moment nothing here chooses or sees: the next page may have
   * a navigation of its own under way (one the person started there, or Next's), which can drop it, and a save that
   * never answers would keep the gate waiting. Not sent, then: those words were kept in this browser as the editor
   * went (leftBehind), and the next visit offers them back. The save useBuilder sends in the moment the editor goes is
   * sent. A state the server has said it has (it went in an older one's place: `tracked`) is not sent again.
   */
  const save = (state: BuilderState): Promise<SaveResult> => {
    if (state === confirmed) return Promise.resolve({ ok: true });
    if (!closed) return tracked(state);
    keepNewest();
    return Promise.resolve({ ok: false, error: "The editor has closed: these changes were kept in this browser." });
  };

  /**
   * The editor has been taken off the page by a link inside the app (leaving.ts), and its state cannot change now. The
   * navigation that took it off is over, so a save that waited for it goes now. What the server has not said it has is
   * kept in this browser at once, for the next visit to offer back unless the server has it by then: a save refused or
   * failed is sent again by nobody, and a tab closed before the save on its way lands drops it. A save that lands takes
   * the kept words back (tracked).
   */
  function leftBehind(): void {
    gone = true;
    queueMicrotask(() => {
      if (gone) closed = true;
    });
    navigationOver();
    if (rt.state.get() === confirmed) return;
    keepNewest();
  }
  /** On the page (again): React's development checks take an editor off the page and put it back as it mounts. */
  function here(): void {
    gone = false;
    closed = false;
  }

  return {
    rt,
    host,
    loaded,
    owner,
    save,
    send: async (state) =>
      (await tracked(state).catch(() => ({ ok: false as const }))).ok,
    here,
    left: leftBehind,
    stayed: navigationOver,
    asked,
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

  // The browser's Back, bringing this document back whole from its own cache: its editor holds the state of
  // when it was left, and the server may have newer words since (the step builder's, another tab's, another
  // page's). Saved over them, they would be lost, so the page is loaded afresh. Nothing is lost by it:
  // anything that was waiting was sent as the page was left (useBuilder sends when the tab is hidden), and
  // kept in this browser if the server had not said it had it (leaving.ts), to be offered back.
  useEffect(() => {
    const shown = (e: PageTransitionEvent) => {
      if (e.persisted) window.location.reload();
    };
    window.addEventListener("pageshow", shown);
    return () => window.removeEventListener("pageshow", shown);
  }, []);

  // Leaving by a link inside the app (a tile, the Add link, the header): words no save will get to the server (a
  // save refused or failed) reach no server, and the next visit's editor starts from what the server has. So they
  // are kept in this browser and offered back once on the next visit (startVisit's leftBehind, keep.ts, Notices.tsx).
  useEffect(() => {
    visit.here();
    return () => visit.left();
  }, [visit]);

  // A navigation the editor started is over, and the editor is still here (startVisit's `underWay`): new data for the
  // page has come (the person came back to it before the next page did, or a link to this page has fetched it). Or the
  // browser was asked to leave the page and it stayed: Next turns a navigation whose page it cannot fetch into a full
  // page load, and the browser asks "Leave site?" when a change is waiting, so a person who stays carries on editing and
  // their saves go again, unless a reload may be what asked while the navigation is still under way (startVisit's
  // `asked`). The check runs once the question is answered; a page that does go never runs it.
  useEffect(() => visit.stayed(), [visit, data]);
  useEffect(() => {
    const asked = () => void setTimeout(visit.asked, 0);
    window.addEventListener("beforeunload", asked);
    return () => window.removeEventListener("beforeunload", asked);
  }, [visit]);

  // A press on a link out of the editor holds what is waiting until the editor goes, and a page that goes for good keeps
  // what the server has not said it has (leaving.ts).
  useEffect(() => watchLeaving(rt, visit.owner), [rt, visit]);

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
