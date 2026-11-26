"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useToast } from "@astryxdesign/core/Toast";
import type { PortfolioData } from "@/app/(app)/portfolio/load";
import { featuredOf } from "@/components/portfolio/PortfolioHome";
import { Button } from "@/components/ui/Button";
import { editingHome } from "./home-props";
import { usePortfolioData, useRuntime, type PortfolioSheet, type Runtime } from "./runtime";

/*
 * What the editor reads from its address (decision 0031, "What the portfolio reads from its address"),
 * once the page is up. Each thing is done once, then taken out of the address with history.replaceState,
 * so a reload does not do it again. Unknown values are ignored and left where they are.
 *
 *   ?open=look|address|job-links|team|links   opens that menu, sheet or popover
 *   ?at=<exhbt id>                            scrolls to that tile and marks it for two seconds; if the
 *                                             exhbt is live, a note at the foot of the window gives its link
 *   ?full=1                                   the Add tile gives the plan's reason in the alert tone
 *   ?joined=1, ?left=1                        opens Team, with the note about joining or leaving; these
 *                                             and ?full=1 stay in the address until Team closes, since
 *                                             the server draws the Team sheet from them
 *   ?step=you|look|projects|publish           the step builder's own addresses: the name's field, the Look
 *                                             menu, the work, the address sheet
 *   #team-projects, #job-links                as open=team and open=job-links (sent emails carry the first)
 */

const OPENS: readonly PortfolioSheet[] = ["look", "address", "job-links", "team", "links"];
const HASHES: Record<string, PortfolioSheet> = { "#team-projects": "team", "#job-links": "job-links" };
const MARK_MS = 2000;

/** The editor's root on the page. */
const root = () => document.querySelector<HTMLElement>('[data-editor="portfolio"]');
const calm = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Waits for something to be drawn, a frame at a time, then hands it over. */
function whenDrawn(find: () => HTMLElement | null | undefined, then: (el: HTMLElement) => void, tries = 40): void {
  const el = find();
  if (el) return then(el);
  if (tries > 0) requestAnimationFrame(() => whenDrawn(find, then, tries - 1));
}

/** The tile of an exhbt on the editing page: its card or row, the band when it is in it, or an owner-only tile. */
function tileOf(id: string, inBand: boolean): HTMLElement | null {
  const page = root();
  const safe = CSS.escape(id);
  return page?.querySelector<HTMLElement>(`[data-card="${safe}"], [data-tile="${safe}"]`) ?? (inBand ? (page?.querySelector<HTMLElement>('[data-section="featured"]') ?? null) : null);
}

/** Reads the address, does what it says and returns the address with those parts taken out. */
function act(rt: Runtime, data: PortfolioData, say: (id: string) => void): string | null {
  const url = new URL(window.location.href);
  const q = url.searchParams;
  let changed = false;
  let open: PortfolioSheet | null = null;
  const done = (key: string) => {
    q.delete(key);
    changed = true;
  };

  const asked = q.get("open");
  if (asked && (OPENS as readonly string[]).includes(asked)) {
    open = asked as PortfolioSheet;
    done("open");
  }
  const full = q.get("full") === "1";
  if (full) rt.ui.set((u) => ({ ...u, full: true }));
  for (const note of ["joined", "left"] as const) {
    if (q.get(note) !== "1") continue;
    rt.ui.set((u) => ({ ...u, team: note }));
    open = "team";
  }
  const step = q.get("step");
  if (step === "you") rt.api.jumpTo("profile.name");
  else if (step === "look") open ??= "look";
  else if (step === "publish") open ??= "address";
  else if (step === "projects") whenDrawn(() => root()?.querySelector<HTMLElement>('[data-section="work"], [data-section="featured"]'), (el) => el.scrollIntoView({ block: "start", behavior: calm() ? "auto" : "smooth" }));
  if (step === "you" || step === "look" || step === "publish" || step === "projects") done("step");

  const at = q.get("at");
  if (at) {
    const home = editingHome(rt.state.get(), data);
    const inBand = home.sections.includes("featured") && featuredOf(home)?.id === at;
    rt.ui.set((u) => ({ ...u, marked: at }));
    setTimeout(() => rt.ui.set((u) => (u.marked === at ? { ...u, marked: null } : u)), MARK_MS);
    whenDrawn(
      () => tileOf(at, inBand),
      (el) => {
        el.scrollIntoView({ block: "center", behavior: calm() ? "auto" : "smooth" });
        el.setAttribute("data-marked", "");
        setTimeout(() => el.removeAttribute("data-marked"), MARK_MS);
      },
    );
    say(at);
    done("at");
  }

  const hashed = HASHES[url.hash];
  if (hashed) {
    open ??= hashed;
    url.hash = "";
    changed = true;
  }
  // The Team sheet is drawn on the server from the same words (TeamPanel's said and full): while it is
  // open they stay in the address, so a refresh meanwhile draws it with them still, and they go as it
  // closes (forgetTeamNote, below). Without Team open, `full` is only the Add tile's and goes at once.
  if (open !== "team" && full) done("full");
  if (open) rt.api.open(open);
  return changed ? `${url.pathname}${url.search}${url.hash}` : null;
}

/** The team's words in the address: kept while the Team sheet is open (act, above). */
const TEAM_WORDS = ["joined", "left", "full"] as const;

/**
 * Once the Team sheet closes, its note has been read: the note goes from the view, and its words from the
 * address, so neither a reload nor the next refresh says it again.
 */
function forgetTeamNote(rt: Runtime): () => void {
  let was = rt.ui.get().sheet;
  return rt.ui.subscribe(() => {
    const now = rt.ui.get().sheet;
    const closed = was === "team" && now !== "team";
    was = now;
    if (!closed) return;
    const url = new URL(window.location.href);
    const kept = TEAM_WORDS.filter((k) => url.searchParams.has(k));
    if (kept.length > 0) {
      for (const k of kept) url.searchParams.delete(k);
      window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    }
    if (rt.ui.get().team) rt.ui.set((u) => ({ ...u, team: null }));
  });
}

/** Draws nothing: acts on the address once the editor is up. */
export function Address(): ReactNode {
  const rt = useRuntime();
  const data = usePortfolioData();
  const toast = useToast();
  const latest = useRef(data);
  latest.current = data;

  useEffect(() => {
    // The note after a publish (decision 0031, "A new student", step 7): the exhbt's own link, with Copy.
    const live = (id: string) => {
      const found = latest.current.visitor.published.find((p) => p.id === id);
      if (!found?.home.href || found.home.href === "#") return;
      const link = new URL(found.home.href, window.location.origin);
      toast({
        body: `${found.home.title} is live at ${link.host}${link.pathname}`,
        // It carries the link: it stays until it is closed.
        isAutoHide: false,
        uniqueID: `live-${id}`,
        endContent: <CopyLink href={link.toString()} onCopied={() => rt.api.say("Link copied.")} />,
      });
    };
    const next = act(rt, latest.current, live);
    // Next's router follows the address through the browser's own history calls; its own entry in the
    // history's state is kept, so Back and Forward still work as Next expects.
    if (next) window.history.replaceState(window.history.state, "", next);
    // Once, as the editor opens: the address is read then, and never again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Not once: a subscription, set up again whenever React runs the effects again.
  useEffect(() => forgetTeamNote(rt), [rt]);
  return null;
}

/** "Copy link", which says so once it has. */
function CopyLink({ href, onCopied }: { href: string; onCopied(): void }): ReactNode {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      size="sm"
      onClick={() => {
        void navigator.clipboard
          ?.writeText(href)
          .then(() => {
            setCopied(true);
            onCopied();
          })
          .catch(() => {});
      }}
    >
      {copied ? "Copied" : "Copy link"}
    </Button>
  );
}
