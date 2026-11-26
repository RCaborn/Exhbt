"use client";

import dynamic from "next/dynamic";
import { Component, createContext, useContext, type ErrorInfo, type ReactNode } from "react";
import { Banner } from "@astryxdesign/core/Banner";
import { again } from "@/components/exhbt-editor/again";
import { flushPending } from "./pending";
import type { PortfolioEditorProps } from "./PortfolioEditor";
import { StandInPage } from "./StandIn";

/*
 * The gate in front of the one-page portfolio editor (decision 0031, "The switch": "Three ways back",
 * the third). The editor is never drawn on the server: it is loaded in the browser, in its own chunk,
 * inside an error boundary, because a boundary cannot catch a throw while the server draws the page.
 * Until the chunk has loaded (and on the server) the gate draws the loading view, which is the page as
 * the editor's first view draws it (StandIn.tsx), so the fields come alive in place.
 *
 * If the editor throws while it draws, or its chunk fails to load (asked for three times: again.ts),
 * the boundary logs the error, says so, waits for flushPending() (three seconds at most) and reloads
 * the page with ?builder=steps. It reloads and does not swap builders in place: the page's props are
 * from when it was opened, and a builder mounted on them could save over newer work.
 */

/** The page's props, for the loading view: next/dynamic gives its `loading` component none of them. */
const GateProps = createContext<PortfolioEditorProps | null>(null);

/** While the editor's chunk loads, and on the server: the stand-in, not yet ready (no data-ready). */
function Loading() {
  const props = useContext(GateProps);
  return props ? (
    <div data-editor="portfolio" data-loading="" aria-busy="true">
      <StandInPage data={props.data} />
    </div>
  ) : null;
}

const PortfolioEditor = dynamic(() => again(() => import("./PortfolioEditor")).then((m) => m.PortfolioEditor), { ssr: false, loading: Loading });

/** The longest the fallback waits for the newest state to reach the server before it reloads. */
const FLUSH_MS = 3000;

/**
 * This address with ?builder=steps added. The development switches come off, and so does what only the
 * editor reads of the address (what to open, which tile to mark): the step builder keeps `step`, which
 * is its own, and the hash, which finds its job links.
 */
export function stepsAddress(href: string): string {
  const url = new URL(href);
  for (const key of ["crash", "save", "open", "at", "full", "joined", "left"]) url.searchParams.delete(key);
  url.searchParams.set("builder", "steps");
  return url.toString();
}

/** Catches a throw while the editor draws, and a chunk that fails to load, and reloads into the step builder. */
class CrashFallback extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  private leaving = false;

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error("The portfolio editor failed, so the step builder will open.", error, info.componentStack);
    if (this.leaving) return;
    this.leaving = true;
    void (async () => {
      try {
        await Promise.race([flushPending(), new Promise((done) => setTimeout(done, FLUSH_MS))]);
      } catch (e) {
        console.error("Sending the newest changes failed.", e);
      } finally {
        window.location.replace(stepsAddress(window.location.href));
      }
    })();
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div data-editor="failed" className="mx-auto max-w-3xl px-4 py-10 sm:px-8">
        <Banner status="error" role="alert" title="Something went wrong with the new portfolio editor" description="Your work is saved. Opening the step builder…" />
      </div>
    );
  }
}

/** What `/portfolio` draws for the one-page editor: the boundary, and the editor loaded in the browser only. */
export function PortfolioGate(props: PortfolioEditorProps) {
  return (
    <GateProps value={props}>
      <CrashFallback>
        <PortfolioEditor {...props} />
      </CrashFallback>
    </GateProps>
  );
}
