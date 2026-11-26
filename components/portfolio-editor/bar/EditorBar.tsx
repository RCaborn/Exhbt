"use client";

import "../css/bar.css";
import { useRef, type ReactNode } from "react";
import { BriefcaseBusiness, Eye, Link2, MoreHorizontal, Palette } from "lucide-react";
import { Badge } from "@astryxdesign/core/Badge";
import { DropdownMenu, type DropdownMenuOption } from "@astryxdesign/core/DropdownMenu";
import { Popover } from "@astryxdesign/core/Popover";
import { ToggleButton } from "@astryxdesign/core/ToggleButton";
import { Toolbar } from "@astryxdesign/core/Toolbar";
import { Button } from "@/components/ui/Button";
import { flushPending } from "../pending";
import { usePortfolioApi, usePortfolioData, usePortfolioState, usePortfolioUi, type PortfolioSheet } from "../runtime";
import { AddressSheet } from "../sheets/AddressSheet";
import { PhotoSheet } from "../sheets/PhotoButton";
import { TeamNotice, TeamSheet, TEAM_WORDS } from "../sheets/TeamSheet";
import { SaveStatus } from "../ui/SaveStatus";
import { Sheet } from "../ui/Sheet";
import { HEADING_ID, UndoButton } from "../ui/UndoButton";
import { useBarSize, useCoarse, useNarrow, useStanding, type Standing } from "./hooks";
import { LookPanel, PreviewNotice } from "./LookMenu";
import { LinksPanel } from "../tools/PartTools";

/*
 * The editor's bar (decision 0031, "The bar"): one row of app chrome, Astryx's Toolbar (one Tab stop,
 * the arrow keys along it) in a frame exactly `--xe-topbar-h` tall that sticks to the top of the window
 * (css/core.css). In order: "Your portfolio" and the chip saying where the page stands; Look; Undo and
 * the save status; See as a visitor; Job links; the menu; and the one primary button, "Claim your
 * address" until there is one, then "Share". Under 48rem, Look, See as a visitor, Job links and Team
 * fold into the menu, keeping the heading, the status and the primary button.
 *
 * Every menu, popover and sheet the bar opens is drawn here once and follows the runtime's `ui.sheet`,
 * so `open(name)` from anywhere (the first-run strip, a field's "Show me", the address's `?open=`) opens
 * the same one. Under the bar, in app chrome, the notices: a look being previewed, and someone waiting
 * to join one of the person's exhbts.
 */

/** The chip's words, and what each one means. */
export const CHIP: Record<Standing, { label: string; variant: "success" | "warning" | "neutral"; means: string }> = {
  live: { label: "Live", variant: "success", means: "Visitors can see your portfolio at your address." },
  offline: { label: "Not online yet", variant: "warning", means: "Visitors get “not found” until you have an address and a published exhbt." },
  preview: { label: "Preview only", variant: "neutral", means: "Only you can see your portfolio on your plan." },
};

/** The bar's own words, in one place. */
export const BAR = {
  heading: "Your portfolio",
  look: "Look",
  visitor: "See as a visitor",
  jobLinks: "Job links",
  more: "More",
  claim: "Claim your address",
  share: "Share",
  reorder: "Reorder sections",
  steps: "Use the step builder",
  stepsForGood: "Go back to the step builder for good",
};

export function EditorBar({ team, jobLinks }: { team: ReactNode; jobLinks: ReactNode }): ReactNode {
  const narrow = useNarrow();
  const size = useBarSize();
  const contactOnPage = usePortfolioState((s) => s.arrangement.sections.includes("contact"));
  const visitor = usePortfolioUi((u) => u.visitor);
  return (
    <>
      <div className="pe-bar" data-bar data-narrow={narrow ? "" : undefined}>
        <Toolbar
          label={BAR.heading}
          size={size}
          gap={2}
          startContent={
            <span className="pe-bar-start">
              <h1 id={HEADING_ID} tabIndex={-1} className="pe-bar-heading">
                {BAR.heading}
              </h1>
              <Chip />
            </span>
          }
          endContent={
            <span className="pe-bar-end">
              {!narrow && <LookButton />}
              <UndoButton />
              <SaveStatus />
              {!narrow && <span aria-hidden className="pe-bar-rule" />}
              {!narrow && <VisitorToggle />}
              {!narrow && <JobLinksButton jobLinks={jobLinks} />}
              <MoreMenu />
              <PrimaryButton />
            </span>
          }
        />
      </div>
      <div className="pe-bar-notices" data-bar-notices>
        <PreviewNotice />
        <TeamNotice />
      </div>
      {/* The sheets: the same at every width. */}
      <PhotoSheet />
      <AddressSheet />
      <TeamSheet team={team} />
      {/* Folded into the menu on a narrow window, where the bar's buttons they hang off are gone. */}
      {narrow && (
        <>
          <Sheet name="look" title="Your look">
            <LookPanel />
          </Sheet>
          <Sheet name="job-links" title={BAR.jobLinks}>
            {jobLinks}
          </Sheet>
        </>
      )}
      {/* Your links hang off Get in touch; without that section on the page, or while the visitor's page
          is shown, they open as a sheet. */}
      {(!contactOnPage || visitor) && (
        <Sheet name="links" title="Your links">
          <LinksPanel />
        </Sheet>
      )}
    </>
  );
}

/** Where the page stands for visitors. */
function Chip(): ReactNode {
  const standing = useStanding();
  const c = CHIP[standing];
  return (
    <span className="pe-chip" data-chip={standing} title={c.means}>
      <Badge variant={c.variant} label={c.label} />
      <span className="sr-only">{c.means}</span>
    </span>
  );
}

/** A bar button that opens a popover the runtime keeps (`ui.sheet === name`). */
function usePanel(name: PortfolioSheet) {
  const api = usePortfolioApi();
  const open = usePortfolioUi((u) => u.sheet === name);
  return { open, onOpenChange: (next: boolean) => (next ? api.open(name) : open && api.close()) };
}

function LookButton(): ReactNode {
  const p = usePanel("look");
  const size = useBarSize();
  return (
    <Popover isOpen={p.open} onOpenChange={p.onOpenChange} label="Your look" placement="below" alignment="start" width={432} padding={4} content={<LookPanel />}>
      <Button size={size} label={BAR.look} aria-expanded={p.open}>
        <Palette aria-hidden size={16} strokeWidth={2.25} />
        {BAR.look}
      </Button>
    </Popover>
  );
}

function JobLinksButton({ jobLinks }: { jobLinks: ReactNode }): ReactNode {
  const p = usePanel("job-links");
  const size = useBarSize();
  return (
    <Popover isOpen={p.open} onOpenChange={p.onOpenChange} label={BAR.jobLinks} placement="below" alignment="end" width={432} padding={4} content={<div data-job-links-menu>{jobLinks}</div>}>
      <Button size={size} label={BAR.jobLinks} aria-expanded={p.open}>
        <BriefcaseBusiness aria-hidden size={16} strokeWidth={2.25} />
        {BAR.jobLinks}
      </Button>
    </Popover>
  );
}

function VisitorToggle(): ReactNode {
  const api = usePortfolioApi();
  const on = usePortfolioUi((u) => u.visitor);
  const size = useBarSize();
  return (
    <ToggleButton size={size} label={BAR.visitor} icon={<Eye aria-hidden size={16} strokeWidth={2.25} />} isPressed={on} onPressedChange={(next) => api.seeAsVisitor(next)} data-testid="see-as-visitor">
      {BAR.visitor}
    </ToggleButton>
  );
}

function PrimaryButton(): ReactNode {
  const api = usePortfolioApi();
  const { username } = usePortfolioData().builder;
  const open = usePortfolioUi((u) => u.sheet === "address");
  const size = useBarSize();
  const label = username ? BAR.share : BAR.claim;
  return (
    <Button variant="primary" size={size} label={label} aria-expanded={open} onClick={() => api.open("address")}>
      {username && <Link2 aria-hidden size={16} strokeWidth={2.25} />}
      {label}
    </Button>
  );
}

/**
 * The menu: Team projects; "Reorder sections" under a finger (I's sheet); the step builder for this
 * visit, and for an admin for good. On a narrow window it also holds what the row has no room for.
 */
function MoreMenu(): ReactNode {
  const api = usePortfolioApi();
  const narrow = useNarrow();
  const coarse = useCoarse();
  const size = useBarSize();
  const { admin } = usePortfolioData();
  const visitor = usePortfolioUi((u) => u.visitor);
  const form = useRef<HTMLFormElement>(null);

  const leave = async (go: () => void) => {
    // Whatever is waiting to be saved is sent first, so nothing typed is lost on the way out.
    await flushPending().catch(() => {});
    go();
  };

  const items: DropdownMenuOption[] = [
    ...(narrow
      ? ([
          { label: BAR.look, icon: <Palette aria-hidden size={16} />, onClick: () => api.open("look") },
          { label: visitor ? "Back to editing" : BAR.visitor, icon: <Eye aria-hidden size={16} />, onClick: () => api.seeAsVisitor(!visitor) },
          { label: BAR.jobLinks, icon: <BriefcaseBusiness aria-hidden size={16} />, onClick: () => api.open("job-links") },
        ] satisfies DropdownMenuOption[])
      : []),
    { label: TEAM_WORDS.title, onClick: () => api.open("team") },
    ...(coarse ? [{ label: BAR.reorder, onClick: () => api.open("reorder") }] : []),
    { type: "divider" },
    { label: BAR.steps, description: "The guided builder, for this visit.", onClick: () => void leave(() => window.location.assign("/portfolio?builder=steps")) },
    ...(admin ? [{ label: BAR.stepsForGood, description: "Admins only: in this browser.", onClick: () => void leave(() => form.current?.requestSubmit()) }] : []),
  ];

  return (
    <>
      <DropdownMenu
        button={{ label: BAR.more, icon: <MoreHorizontal aria-hidden size={18} />, isIconOnly: true, size, variant: "ghost", tooltip: BAR.more }}
        hasChevron={false}
        items={items}
        alignment="end"
        menuWidth={280}
        presentation={coarse ? "adaptive" : "popover"}
      />
      {admin && (
        <form ref={form} method="post" action="/api/portfolio/editor" hidden data-admin-steps>
          <input type="hidden" name="kind" value="steps" />
        </form>
      )}
    </>
  );
}
