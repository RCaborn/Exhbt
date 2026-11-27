"use client";

import "../css/topbar.css";
import type { MouseEvent, ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Eye, IdCard } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useEnv, useLive, useUi } from "../context";
import { flushPending } from "../pending";
import { FirstDraftNotice } from "./FirstDraftNotice";
import { LayoutMenu, useDraftedLine } from "./LayoutMenu";
import { MenuButton } from "./MenuButton";
import { useNarrow } from "./Popover";
import { SaveStatus } from "./SaveStatus";
import { ThingsToFix } from "./ThingsToFix";
import { HEADING_ID, UndoButton } from "./UndoButton";
import { WordBar } from "./WordBar";

/*
 * The top bar (decision 0026, "The chrome"): one row that stays at the top, exactly --xe-topbar-h tall
 * (css/core.css), so the loading view's room for it is right and nothing moves when it arrives. App
 * chrome, in the app's own tokens. Everything it does goes through the store and the hooks: the layout
 * menu, Undo, the word bar, "Things to fix", See as a visitor, the save status, Card and link details, the
 * menu and "Review and publish". Under 48rem the row keeps the way back, the word count, the things to
 * fix, the save status and "Review and publish"; the rest is in the menu.
 */
export function TopBar(): ReactNode {
  const narrow = useNarrow();
  const env = useEnv();
  const ui = useUi();
  useDraftedLine();
  // The live status, not the page's props, so publishing and unpublishing change it without a reload.
  const live = useLive();
  const chip = !env.canGoLive ? "Preview only" : live.status === "published" ? "Live" : "Draft";
  const router = useRouter();
  // Portfolio first (decision 0031, "Continuity with the exhbt editor"): back to this exhbt's tile on the
  // portfolio, once the last change has landed, so the tile never shows an old title. Without the switch,
  // today's link to the exhbts list.
  const back = env.portfolioFirst ? { href: `/portfolio?at=${encodeURIComponent(env.id)}`, text: "Your portfolio" } : { href: "/exhbts", text: "Your exhbts" };
  const waitThenGo = (e: MouseEvent<HTMLAnchorElement>) => {
    // A new tab or window keeps the browser's own behaviour.
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    void flushPending().then(() => router.push(back.href));
  };

  const visitor = (
    <Button size="sm" className="xe-tb xe-visitor" label="See as a visitor" aria-pressed={ui.visitor} onClick={() => ui.setVisitor(!ui.visitor)}>
      <Eye aria-hidden size={16} strokeWidth={2.25} className="shrink-0" />
      <span className="xe-tb-text">See as a visitor</span>
    </Button>
  );
  const card = (close?: (restoreFocus?: boolean) => void) => (
    <Button
      size="sm"
      className="xe-tb xe-card-button"
      label="Card and link details"
      onClick={() => {
        close?.(true);
        ui.open("card");
      }}
    >
      <IdCard aria-hidden size={16} strokeWidth={2.25} className="shrink-0" />
      <span className="xe-tb-text">Card and link details</span>
    </Button>
  );

  return (
    <>
    <header className="xe-topbar" data-topbar>
      <div className="xe-topbar-row">
        <Link href={back.href} className="xe-back" aria-label={back.text} onClick={env.portfolioFirst ? waitThenGo : undefined}>
          <ArrowLeft aria-hidden size={16} strokeWidth={2.25} />
          <span className="xe-back-text">{back.text}</span>
        </Link>
        <div className="xe-title">
          <h1 id={HEADING_ID} tabIndex={-1} className="xe-title-h1">
            Edit exhbt
          </h1>
          <span className="chip xe-chip-state">{chip}</span>
        </div>
        {!narrow && (
          <>
            <LayoutMenu />
            <UndoButton />
          </>
        )}
        <WordBar />
        <ThingsToFix />
        {!narrow && visitor}
        <span className="xe-spacer" />
        <SaveStatus />
        {!narrow && card()}
        <MenuButton
          before={
            narrow
              ? (close) => (
                  <>
                    <LayoutMenu inline />
                    <UndoButton />
                    {visitor}
                    {card(close)}
                  </>
                )
              : undefined
          }
        />
        <Button variant="primary" size="sm" className="xe-tb xe-publish" onClick={() => ui.open("publish")}>
          Review and publish
        </Button>
      </div>
    </header>
    <FirstDraftNotice />
    </>
  );
}
