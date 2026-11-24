"use client";

import dynamic from "next/dynamic";
import { Component, createContext, useContext, type ErrorInfo, type ReactNode } from "react";
import { again } from "./again";
import type { PageEditorProps } from "./context";
import { flushPending } from "./pending";
import { StandInPage } from "./StandIn";

/*
 * The gate in front of the edit-on-page editor (decision 0026, "The classic editor: the switch, the
 * fallback, the escape"). The editor is never drawn on the server: it is loaded in the browser, in its
 * own chunk, inside an error boundary, because a boundary cannot catch a throw while the server draws
 * the page. Until the chunk has loaded (and on the server) the gate draws the loading view, which is
 * exactly what the editor's first view draws (StandIn.tsx), so the fields come alive in place.
 *
 * If the editor throws while it draws, or its chunk fails to load (asked for three times: again.ts),
 * the boundary logs the error, says so, waits for flushPending() (three seconds at most; the browser
 * copy was already written) and reloads the page with ?editor=classic. It reloads rather than swapping editors in place: the
 * page's props are from when it was opened, and an editor mounted on them could save over newer work.
 */

/** The page's props, for the loading view: next/dynamic gives its `loading` component none of them. */
const GateProps = createContext<PageEditorProps | null>(null);

/** While the editor's chunk loads, and on the server: the stand-in, not yet ready (no data-ready). */
function Loading() {
  const props = useContext(GateProps);
  return props ? (
    <div data-editor="page" data-loading="" aria-busy="true">
      <StandInPage {...props} />
    </div>
  ) : null;
}

const PageEditor = dynamic(() => again(() => import("./EditorShell")).then((m) => m.PageEditor), { ssr: false, loading: Loading });

/** The longest the fallback waits for the newest doc to reach the server before it reloads. */
const FLUSH_MS = 3000;

/**
 * This address with ?editor=classic added. The development crash switch comes off. So does what the draft page
 * passed on (drafted, why, fig): the classic editor takes those off the address by replacing it with the bare
 * path (components/editor/Editor.tsx), which would drop editor=classic too, and a reload would then be the new
 * editor again. The visit stays in the classic editor; the line about the draft is not said.
 */
function classicAddress(href: string): string {
  const url = new URL(href);
  for (const key of ["crash", "drafted", "why", "fig"]) url.searchParams.delete(key);
  url.searchParams.set("editor", "classic");
  return url.toString();
}

/** Catches a throw while the editor draws, and a chunk that fails to load, and reloads into the classic editor. */
class CrashFallback extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  private leaving = false;

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error("The new editor failed, so the classic editor will open.", error, info.componentStack);
    if (this.leaving) return;
    this.leaving = true;
    void (async () => {
      try {
        await Promise.race([flushPending(), new Promise((done) => setTimeout(done, FLUSH_MS))]);
      } catch (e) {
        console.error("Sending the newest changes failed; they are kept in this browser.", e);
      } finally {
        window.location.replace(classicAddress(window.location.href));
      }
    })();
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div data-editor="failed" className="bg-mist">
        <div className="mx-auto max-w-[78rem] px-4 pt-8 pb-16 sm:px-8 xl:max-w-[90rem]">
          <h1 className="text-[2rem] sm:text-[2.5rem]">Edit exhbt</h1>
          <p role="alert" className="mt-4 font-semibold">
            Something went wrong with the new editor. Your work is saved.
          </p>
          <p className="mt-1 text-graphite">Opening the classic editor…</p>
        </div>
      </div>
    );
  }
}

/** What the edit page draws for the new editor: the boundary, and the editor loaded in the browser only. */
export function EditorGate(props: PageEditorProps) {
  return (
    <GateProps value={props}>
      <CrashFallback>
        <PageEditor {...props} />
      </CrashFallback>
    </GateProps>
  );
}
