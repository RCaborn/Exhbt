"use client";

import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@astryxdesign/core/AppShell";
import { Banner } from "@astryxdesign/core/Banner";
import { Link } from "@astryxdesign/core/Link";
import { useToast } from "@astryxdesign/core/Toast";
import { Logo } from "@/components/brand/Logo";
import { useLab } from "../LabFrame";
import { AppNav } from "./AppNav";
import { FirstRun, type FirstRunArt, type Progress } from "./FirstRun";
import { AppLabStrip } from "./LabStrip";
import { useMorph } from "./motion";
import { Roadmaps } from "./Roadmaps";
import type { AppScreen, AppShow } from "./screens";
import { Settings } from "./Settings";
import { WithWork, type WorkArt } from "./WithWork";
import type { AppWords } from "./words";

const START: Progress = { page: false, exhbt: false };

/**
 * The App screen (/lab/design/app): the frame every signed-in page would share, and three ordinary
 * screens in it. The page is the real frame, not a picture of one: Astryx AppShell with TopNav, the
 * private-preview notice in its banner slot, one content line, and a quiet footer after it.
 *
 * Above the frame, while the lab bar shows, a strip of lab controls (LabStrip.tsx) switches the
 * screen and shows the feedback states. Each has its own address (screens.ts), read on the server.
 *
 * The person's own pages (her portfolio, her exhbts' cards and pages) are drawn on the server by the
 * real components in her look and arrive here as `art`; nothing here restyles them.
 */
export function AppLab({
  screen,
  show,
  words,
  address,
  firstRun,
  work,
}: {
  screen: AppScreen;
  show: AppShow | null;
  words: AppWords;
  /** Her address as display type (samples.tsx, Address), drawn on the server. */
  address: React.ReactNode;
  firstRun?: FirstRunArt;
  work?: WorkArt;
}) {
  const lab = useLab();
  const showToast = useToast();
  const morph = useMorph();
  const [progress, setProgress] = useState<Progress>(START);
  // At maximal her page fills in as a step is done (motion.ts); at the other levels it changes at once.
  const step = useCallback((next: (p: Progress) => Progress) => morph(() => setProgress(next)), [morph]);

  const toast = useCallback(
    (body: string, id = "app-toast") => {
      showToast({ body, uniqueID: id });
    },
    [showToast],
  );
  const copied = useCallback(() => toast("Link copied", "app-copied"), [toast]);
  const saved = useCallback(() => toast("Saved", "app-saved"), [toast]);

  // A toast asked for in the address plays once, when the page opens with it.
  useEffect(() => {
    if (show === "copied") copied();
    if (show === "saved") saved();
  }, [show, copied, saved]);

  const failed = show === "failed";
  const loading = show === "loading";
  // "Your portfolio" goes to the portfolio as this person has it: her first run, or her work.
  const portfolio: AppScreen = screen === "first-run" ? "first-run" : "work";

  return (
    <div data-app-lab data-app-screen={screen} data-app-level={lab.level}>
      {lab.bar === "shown" && (
        <AppLabStrip
          screen={screen}
          show={show}
          onCopied={copied}
          onSaved={saved}
          firstRun={
            screen === "first-run"
              ? {
                  progress,
                  fill: () => step((p) => ({ ...p, page: true })),
                  add: () => step((p) => ({ ...p, exhbt: true })),
                  reset: () => step(() => START),
                }
              : undefined
          }
        />
      )}
      <AppShell
        height="auto"
        variant="surface"
        banner={<Banner container="section" status="info" title="Private preview. Exhbt isn’t public yet, so please don’t share this link widely." />}
        topNav={<AppNav screen={screen} portfolio={portfolio} person={words.person} onLogOut={() => toast("Logging out isn’t part of the lab.", "app-logout")} />}
      >
        {/* The site's own skip link (app/layout.tsx) points at #main; AppShell's points at its main region. Both land here. */}
        <div className="app-page" id="main" tabIndex={-1}>
          {screen === "first-run" && firstRun && (
            <FirstRun words={words} art={firstRun} progress={progress} onAdd={() => step((p) => ({ ...p, exhbt: true }))} failed={failed} loading={loading} />
          )}
          {screen === "work" && work && <WithWork words={words} art={work} address={address} failed={failed} loading={loading} onCopied={copied} toast={toast} />}
          {screen === "account" && <Settings words={words} address={address} failed={failed} loading={loading} onCopied={copied} onSaved={saved} toast={toast} />}
          {screen === "roadmaps" && <Roadmaps />}
        </div>
      </AppShell>
      <AppFooter />
    </div>
  );
}

/** The app's own footer, in place of the marketing one: quiet, one line, on the content line. */
function AppFooter() {
  return (
    <footer className="app-foot">
      <div className="lab-content app-foot-row">
        <Logo size="sm" />
        <nav aria-label="Footer" className="app-foot-links">
          <Link href="/how-to-read-an-exhbt">How to read an exhbt</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/cookies">Cookies</Link>
        </nav>
      </div>
    </footer>
  );
}
