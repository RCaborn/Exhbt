"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Banner } from "@astryxdesign/core/Banner";
import type { BuilderState } from "@/app/(app)/portfolio/steps";
import { Button } from "@/components/ui/Button";
import { takeUnsaved, type KeptWhy } from "./keep";
import { usePortfolioApi, usePortfolioData } from "./runtime";

/*
 * The editor's own notices, under the bar and above the page, in app chrome (Astryx's Banner): each is
 * there only while it has something to say, so most visits see none.
 *  - After a reload that followed "The site was updated": the changes that could not be saved, offered
 *    back once (decision 0031, "Saving": "After a deploy").
 *  - The page open in another tab: the newest save wins, and this says so ("Two tabs").
 */

/** What Undo calls the change that puts the kept state back. */
export const PUT_BACK = "put back the changes from before the reload";
/** What Undo calls it when the changes were kept because the person left the page before they were saved. */
export const PUT_BACK_LEFT = "put back your last changes";

/** The offer's words, by why the changes were kept (keep.ts). */
const OFFER: Record<KeptWhy, { title: string; description: string; button: string; said: string; undo: string }> = {
  stale: {
    title: "Your last changes were not saved before the reload",
    description: "The site was updated while you were editing, so they were kept in this browser.",
    button: "Put back the changes from before the reload",
    said: "Your last changes were not saved before the reload. You can put them back.",
    undo: PUT_BACK,
  },
  left: {
    title: "Your last changes were not saved",
    description: "You left the page before they could be saved, so they were kept in this browser.",
    button: "Put back your last changes",
    said: "Your last changes were not saved when you left the page. You can put them back.",
    undo: PUT_BACK_LEFT,
  },
};

export function Notices(): ReactNode {
  return (
    <div className="pe-notices" data-notices>
      <KeptOffer />
      <OtherTab />
    </div>
  );
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * The offer, once: the kept state is taken out of the browser as the editor opens, so a second reload
 * does not offer it again, and it is shown only if it differs from the page as it was loaded. Taking it
 * is one change that Undo can take back.
 */
function KeptOffer(): ReactNode {
  const data = usePortfolioData();
  const api = usePortfolioApi();
  const [kept, setKept] = useState<{ state: BuilderState; why: KeptWhy } | null>(null);
  const { owner } = data;
  const { initial } = data.builder;
  useEffect(() => {
    const found = takeUnsaved(owner);
    if (found && !same(found.state, initial)) setKept(found);
    // Once, as the editor opens: a refresh of the page's data is not a reload.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // A Banner is what is seen; the live region is what a screen reader hears (decision 0033).
  useEffect(() => {
    if (kept) api.say(OFFER[kept.why].said);
  }, [kept, api]);
  if (!kept) return null;
  const words = OFFER[kept.why];
  return (
    <Banner
      status="info"
      data-kept-offer
      data-kept-why={kept.why}
      title={words.title}
      description={words.description}
      isDismissable
      dismissLabel="Leave them out"
      onDismiss={() => setKept(null)}
      endContent={
        <Button
          size="sm"
          onClick={() => {
            api.change(() => kept.state, words.undo);
            api.say("Your changes are back on the page.");
            setKept(null);
          }}
        >
          {words.button}
        </Button>
      }
    />
  );
}

/** Whether another tab of this browser has the editor open. */
function useOtherTab(): boolean {
  const [others, setOthers] = useState(0);
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const me = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    const seen = new Set<string>();
    const channel = new BroadcastChannel("exhbt-portfolio-editor");
    const say = (type: "hello" | "here" | "bye") => channel.postMessage({ type, id: me });
    channel.onmessage = (e: MessageEvent<{ type?: string; id?: string } | null>) => {
      const m = e.data;
      if (!m?.id || m.id === me) return;
      if (m.type === "bye") seen.delete(m.id);
      else {
        seen.add(m.id);
        // A tab that has just opened hears who was already here.
        if (m.type === "hello") say("here");
      }
      setOthers(seen.size);
    };
    say("hello");
    const gone = () => say("bye");
    // A tab brought back by the browser's Back button is here again.
    const back = (e: PageTransitionEvent) => {
      if (e.persisted) say("hello");
    };
    window.addEventListener("pagehide", gone);
    window.addEventListener("pageshow", back);
    return () => {
      gone();
      window.removeEventListener("pagehide", gone);
      window.removeEventListener("pageshow", back);
      channel.close();
    };
  }, []);
  return others > 0;
}

function OtherTab(): ReactNode {
  const open = useOtherTab();
  const api = usePortfolioApi();
  useEffect(() => {
    if (open) api.say("This page is open in another tab. The last change saved wins.");
  }, [open, api]);
  if (!open) return null;
  // Information, not something gone wrong: info, not warning (decision 0033).
  return <Banner status="info" data-other-tab title="This page is open in another tab" description="The last change saved wins." isDismissable />;
}
