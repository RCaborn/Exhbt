"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Banner } from "@astryxdesign/core/Banner";
import type { BuilderState } from "@/app/(app)/portfolio/steps";
import { Button } from "@/components/ui/Button";
import { CustomiseSchema } from "@/lib/portfolio-customise";
import { ProfileDraftSchema } from "@/lib/portfolio-profile";
import { takeUnsaved, type KeptWhy } from "./keep";
import { usePortfolioApi, usePortfolioData } from "./runtime";

/*
 * The editor's own notices, under the bar and above the page, in app chrome (Astryx's Banner): each is
 * there only while it has something to say, so most visits see none.
 *  - Changes this browser kept because they were not saved (keep.ts): after a reload that followed "The
 *    site was updated" (decision 0031, "Saving": "After a deploy"), or after the page was left (by a link,
 *    or with the tab closed) or reloaded before a save had answered. Offered back once.
 *  - The page open in another tab: the newest save wins, and this says so ("Two tabs").
 */

/** What Undo calls the change that puts the kept state back. */
export const PUT_BACK = "put back the changes from before the reload";
/** What Undo calls it when the changes were kept because the page was left (a link, a closed tab) or reloaded before they were saved. */
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
    description: "This page was left or reloaded before they could be saved, so they were kept in this browser.",
    button: "Put back your last changes",
    said: "Your last changes were not saved before this page was left or reloaded. You can put them back.",
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

/**
 * A state as the server stores it: the same parse the save goes through (app/(app)/portfolio/actions.ts, BuilderSchema),
 * which trims the words, closes up their spaces and tidies the links. Null for a state the server would refuse.
 */
function asStored(s: BuilderState): string | null {
  const profile = ProfileDraftSchema.safeParse(s.profile);
  const arrangement = CustomiseSchema.safeParse(s.arrangement);
  return profile.success && arrangement.success ? JSON.stringify({ profile: profile.data, arrangement: arrangement.data }) : null;
}

/**
 * Whether the server already has the kept state: it would store it just as it stores the page that was loaded. The
 * browser keeps the newest state when a save had not answered as the page went, and that save may still have landed
 * (its answer lost with the page); kept as typed, it can differ from what was stored only by what the save tidies
 * away, such as a space at the end of a headline.
 */
function serverHas(kept: BuilderState, loaded: BuilderState): boolean {
  if (JSON.stringify(kept) === JSON.stringify(loaded)) return true;
  const stored = asStored(kept);
  return stored !== null && stored === asStored(loaded);
}

/**
 * The offer, once: the kept state is taken out of the browser as the editor opens, so a second reload
 * does not offer it again, and it is shown only if the server does not have it already (`serverHas`).
 * Taking it is one change that Undo can take back.
 */
function KeptOffer(): ReactNode {
  const data = usePortfolioData();
  const api = usePortfolioApi();
  const [kept, setKept] = useState<{ state: BuilderState; why: KeptWhy } | null>(null);
  const { owner } = data;
  const { initial } = data.builder;
  useEffect(() => {
    const found = takeUnsaved(owner);
    if (found && !serverHas(found.state, initial)) setKept(found);
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
