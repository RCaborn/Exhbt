"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { Component, createContext, useContext, useEffect, useState, type ErrorInfo, type ReactNode } from "react";
import { Banner } from "@astryxdesign/core/Banner";
import { again } from "@/components/exhbt-editor/again";
import { Button } from "@/components/ui/Button";
import { flushPending, isBehind, lastState, settledSaves } from "./pending";
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
 *
 * For the same reason the gate never mounts the editor on data older than the document's own saves
 * (`useFresh`, below): the browser's Back can hand it the page as it was first loaded.
 */

/** The page's props, for the loading view: next/dynamic gives its `loading` component none of them. */
const GateProps = createContext<PortfolioEditorProps | null>(null);

/**
 * While the editor's chunk loads, while newer data is fetched, and on the server: the stand-in, not yet
 * ready (no data-ready). It draws the words this document last had for the person when it has any, so a
 * page that is waiting for newer data shows what they left, not what the old data says.
 */
function Loading() {
  const props = useContext(GateProps);
  return props ? (
    <div data-editor="portfolio" data-loading="" aria-busy="true">
      <StandInPage data={props.data} state={lastState(props.data.owner) ?? undefined} />
    </div>
  ) : null;
}

const PortfolioEditor = dynamic(() => again(() => import("./PortfolioEditor")).then((m) => m.PortfolioEditor), { ssr: false, loading: Loading });

/** The longest the fallback waits for the newest state to reach the server before it reloads. */
const FLUSH_MS = 3000;
/** How long newer data is waited for before the gate says it could not be fetched. */
const FRESH_MS = 10_000;

/**
 * This address with ?builder=steps added. The development switches come off, and so does what only the
 * editor reads of the address (what to open, which tile to mark): the step builder keeps `step`, which
 * is its own, and the hash, which finds its job links.
 */
export function stepsAddress(href: string): string {
  const url = new URL(href);
  for (const key of ["crash", "save", "grow", "open", "at", "full", "joined", "left"]) url.searchParams.delete(key);
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

/*
 * When the browser goes back or forward to /portfolio inside the app, Next may draw it from what it
 * kept: the page as it was when it was first loaded. A history move is noted here, for as long as this
 * chunk has been in the document, so a gate that mounts just after one knows to ask for the page afresh.
 */
let movedAt = -Infinity;
if (typeof window !== "undefined") window.addEventListener("popstate", () => void (movedAt = performance.now()));
const JUST_MOVED_MS = 1500;

/**
 * Whether the page's data is at least as new as everything this document has saved for the person:
 * "yes" (mount the editor), "wait" (newer data has been asked for) or "failed" (it did not come).
 *
 * The editor's save does not revalidate the page, so after the browser's Back the data can be from
 * before words that were typed and saved since. An editor mounted on it would show the old words and
 * save them over the new with its next key. So while a save is on its way the gate waits for it, and
 * while the data was loaded before the newest save landed it asks for the page again and waits for
 * data loaded after it. A page loaded in the ordinary way is never behind, and mounts at once.
 */
function useFresh(owner: string, loadedAt: string): { state: "yes" | "wait" | "failed"; retry(): void } {
  const router = useRouter();
  const [fresh, setFresh] = useState(() => !isBehind(owner, loadedAt));
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (fresh) return;
    let live = true;
    const timer = setTimeout(() => live && setFailed(true), FRESH_MS);
    void settledSaves().then(() => {
      if (!live) return;
      // Data loaded after the newest save: nothing is behind after all (the save that was on its way landed before the load).
      if (!isBehind(owner, loadedAt)) return setFresh(true);
      // New props arrive with a later loadedAt, and this runs again.
      router.refresh();
    });
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [fresh, owner, loadedAt, router, attempt]);

  // Back or forward to a page whose own data is not behind: what other pages did since (an exhbt's title, a
  // publish) is still fetched, behind the editor.
  useEffect(() => {
    if (fresh && performance.now() - movedAt < JUST_MOVED_MS) router.refresh();
    // Once, as the gate mounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    state: fresh ? "yes" : failed ? "failed" : "wait",
    retry: () => {
      setFailed(false);
      setAttempt((n) => n + 1);
    },
  };
}

/** What `/portfolio` draws for the one-page editor: the boundary, and the editor loaded in the browser only. */
export function PortfolioGate(props: PortfolioEditorProps) {
  const fresh = useFresh(props.data.owner, props.data.loadedAt);
  return (
    <GateProps value={props}>
      <CrashFallback>
        {fresh.state === "yes" ? (
          <PortfolioEditor {...props} />
        ) : (
          <>
            {fresh.state === "failed" && (
              <div className="mx-auto max-w-3xl px-4 pt-6 sm:px-8" data-stale-data>
                <Banner
                  status="warning"
                  role="alert"
                  title="We could not fetch the newest copy of your page"
                  description="Check your connection, then try again. Nothing you saved is lost."
                  endContent={
                    <Button size="sm" onClick={fresh.retry}>
                      Try again
                    </Button>
                  }
                />
              </div>
            )}
            <Loading />
          </>
        )}
      </CrashFallback>
    </GateProps>
  );
}
