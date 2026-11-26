"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Link2, Sparkles } from "lucide-react";
import { IconButton } from "@astryxdesign/core/IconButton";
import { Popover } from "@astryxdesign/core/Popover";
import { Switch } from "@astryxdesign/core/Switch";
import { Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { suggestIntroAction } from "@/app/(app)/portfolio/actions";
import type { HomePath } from "@/components/portfolio/home-ctx";
import { Button } from "@/components/ui/Button";
import { useBarSize, useNarrow } from "../bar/hooks";
import { usePortfolioApi, usePortfolioState, usePortfolioUi } from "../runtime";
import { placeLinks, placeTool, type Spot } from "./place";

/*
 * The corner tools of the two parts with no frame of their own (decision 0031, "What is edited where"),
 * drawn over the page and taking no room:
 *  - "intro": Suggest an intro, the last child of `[data-intro]` (relative while editing), placed where
 *    it meets no word (tools/place.ts): on the intro's line, beside it, above or below it, as an icon when
 *    its name does not fit. Once the intro has words it shows while the intro is pointed at or edited
 *    (css/bar.css). It drafts an
 *    intro only from what the person has given (suggestIntroAction) and fills the field, with an Undo
 *    step, since it replaces what was there. Its daily limit's words are the action's own.
 *  - "contact": Your links, a grid child of Get in touch (relative while editing), so absolute. A
 *    popover with LinkedIn, GitHub, website and email as the step builder had them, and "Show LinkedIn
 *    on your page". Each field carries its `data-path` (LINK_PATHS), so a problem's "Show me" finds it.
 */
export function PartTools({ where }: { where: "intro" | "contact" }): ReactNode {
  return where === "intro" ? <SuggestIntro /> : <YourLinks />;
}

const UNREACHABLE = "We couldn't reach the server. Check your connection and try again.";

/** The spots Suggest an intro is tried in (tools/place.ts): on the intro's own line (only clear while it is empty or its first line is short), beside it, above it, below it. */
const INTRO_SPOTS: Spot[] = ["line", "beside", "above", "below"];

type Placed = { spot: Spot | "none"; x: number; y: number; compact: boolean };

/**
 * Places Suggest an intro where it meets no word (placeTool): first at its full size, then as an icon
 * alone; if neither fits anywhere, as an icon above the intro. Again when its look or the window
 * changes, and once typing pauses after the page's words change (useReplace).
 */
function useIntroPlace(span: React.RefObject<HTMLSpanElement | null>, size: "sm" | "md", deps: unknown[], words: unknown[]): Placed {
  const [placed, setPlaced] = useState<Placed>({ spot: "none", x: 0, y: 0, compact: false });
  const full = useRef<{ w: number; h: number } | null>(null);
  const place = useCallback(() => {
    const tool = span.current;
    const intro = tool?.parentElement;
    const button = tool?.querySelector("button");
    if (!tool || !intro || !button) return;
    const b = button.getBoundingClientRect();
    if (!placedRef.current.compact && b.width > 0) full.current = { w: b.width, h: b.height };
    const icon = size === "md" ? 44 : 36;
    const next: Placed = (() => {
      if (full.current) {
        const p = placeTool(intro, tool, full.current, INTRO_SPOTS);
        if (p) return { ...p, compact: false };
      }
      const p = placeTool(intro, tool, { w: icon, h: icon }, INTRO_SPOTS);
      if (p) return { ...p, compact: true };
      return { spot: "above", x: intro.getBoundingClientRect().width - icon, y: -icon - 4, compact: true };
    })();
    setPlaced((now) => (now.spot === next.spot && now.compact === next.compact && Math.abs(now.x - next.x) < 0.5 && Math.abs(now.y - next.y) < 0.5 ? now : next));
  }, [span, size]);
  const placedRef = useRef(placed);
  placedRef.current = placed;

  useReplace(span, place, deps, words);
  return placed;
}

/** How long typing must pause before the tools are placed again: placing measures the page's words. */
const QUIET_MS = 180;

type Idle = { request(fn: () => void, o: { timeout: number }): number; cancel(id: number): void };
const idle: Idle =
  typeof window !== "undefined" && "requestIdleCallback" in window
    ? { request: (fn, o) => window.requestIdleCallback(fn, o), cancel: (id) => window.cancelIdleCallback(id) }
    : { request: (fn) => window.setTimeout(fn, 0), cancel: (id) => window.clearTimeout(id) };

/**
 * Runs `place` before the first paint and whenever `deps` change (the look, the controls' size), and in
 * the next frame when the page's width changes (the window, the fonts). Typing never places it in the
 * key's own frame (brief I): a key on the page, a change to `words` (the person's words, typed or put in
 * by Suggest an intro) or a change of the page's height only asks for it once typing has paused, when the
 * browser is idle.
 */
function useReplace(span: React.RefObject<HTMLSpanElement | null>, place: () => void, deps: unknown[], words: unknown[]): void {
  useLayoutEffect(() => {
    place();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [place, ...deps]);

  const later = useRef<() => void>(() => {});
  useEffect(() => {
    const page = span.current?.closest("[data-portfolio-home]");
    if (!page) return;
    let frame = 0;
    let timer = 0;
    let waiting = 0;
    const stop = () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
      idle.cancel(waiting);
    };
    const soon = () => {
      stop();
      frame = requestAnimationFrame(place);
    };
    const quiet = () => {
      stop();
      timer = window.setTimeout(() => (waiting = idle.request(place, { timeout: 500 })), QUIET_MS);
    };
    later.current = quiet;
    let width = page.getBoundingClientRect().width;
    const seen = new ResizeObserver(() => {
      const w = page.getBoundingClientRect().width;
      if (Math.abs(w - width) < 0.5) return quiet();
      width = w;
      soon();
    });
    seen.observe(page);
    page.addEventListener("input", quiet, true);
    document.fonts?.ready.then(soon).catch(() => {});
    return () => {
      stop();
      later.current = () => {};
      seen.disconnect();
      page.removeEventListener("input", quiet, true);
    };
  }, [span, place]);

  useEffect(() => {
    later.current();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, words);
}

function SuggestIntro(): ReactNode {
  const api = usePortfolioApi();
  const profile = usePortfolioState((s) => s.profile);
  const themeId = usePortfolioState((s) => s.arrangement.themeId);
  const filled = profile.bio.trim().length > 0;
  const size = useBarSize();
  const span = useRef<HTMLSpanElement>(null);
  const placed = useIntroPlace(span, size, [themeId], [profile, filled]);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ text: string; error: boolean } | null>(null);

  async function suggest() {
    setBusy(true);
    setNote(null);
    const r = await suggestIntroAction(profile).catch(() => ({ ok: false as const, error: UNREACHABLE }));
    setBusy(false);
    if (!r.ok) return setNote({ text: r.error, error: true });
    api.change((s) => ({ ...s, profile: { ...s.profile, bio: r.intro } }), "suggested an intro");
    setNote({ text: "Here’s a start, written only from what you’ve told us. Change anything that isn’t how you’d say it.", error: false });
  }

  return (
    <span
      ref={span}
      className="pe-part-tools"
      data-where="intro"
      data-tools="intro"
      data-spot={placed.spot}
      data-filled={filled ? "" : undefined}
      style={placed.spot === "none" ? undefined : { insetInlineStart: placed.x, insetBlockStart: placed.y, insetInlineEnd: "auto", translate: "none" }}
    >
      {/* Where its full name meets words wherever it goes, only the icon: its name stays its label. */}
      {placed.compact ? (
        <IconButton size={size} onClick={suggest} isLoading={busy} label="Suggest an intro" tooltip="Suggest an intro" icon={<Sparkles aria-hidden size={16} strokeWidth={2} />} />
      ) : (
        <Button size={size} onClick={suggest} loading={busy} disabled={busy} label="Suggest an intro">
          <Sparkles aria-hidden size={15} strokeWidth={2} />
          Suggest an intro
        </Button>
      )}
      <span role="status" className="sr-only">
        {note?.text}
      </span>
      {note && (
        <p aria-hidden className="pe-part-tools-note" data-error={note.error ? "" : undefined} data-intro-note>
          {note.text}
        </p>
      )}
    </span>
  );
}

/** The fields of Your links, in the step builder's order and words. */
const LINKS: { path: HomePath; key: "linkedin" | "github" | "website" | "contactEmail"; label: string; placeholder?: string; description?: string; type?: "url" | "email" }[] = [
  { path: "profile.linkedin", key: "linkedin", label: "LinkedIn", placeholder: "linkedin.com/in/your-name", type: "url" },
  { path: "profile.github", key: "github", label: "GitHub", placeholder: "github.com/your-name", type: "url" },
  { path: "profile.website", key: "website", label: "Website", placeholder: "your-name.co.uk", type: "url" },
  { path: "profile.contactEmail", key: "contactEmail", label: "Email", description: "Shown as text, not a link, so it’s harder to scrape.", type: "email" },
];

function YourLinks(): ReactNode {
  const api = usePortfolioApi();
  const open = usePortfolioUi((u) => u.sheet === "links");
  const size = useBarSize();
  const narrow = useNarrow();
  const themeId = usePortfolioState((s) => s.arrangement.themeId);
  const profile = usePortfolioState((s) => s.profile);
  const span = useRef<HTMLSpanElement>(null);
  const [at, setAt] = useState<{ x: number; y: number } | null>(null);
  // Clear of Get in touch's words and of the corner its own toolbar takes (tools/place.ts, placeLinks).
  const place = useCallback(() => {
    const tool = span.current;
    const section = tool?.parentElement;
    const button = tool?.querySelector("button");
    if (!tool || !section || !button) return;
    const b = button.getBoundingClientRect();
    if (b.width === 0) return;
    const bar = size === "md" ? 44 : 36;
    const next = placeLinks(section, tool, { w: b.width, h: b.height }, bar) ?? { x: section.getBoundingClientRect().width - b.width, y: bar + 16 };
    setAt((now) => (now && Math.abs(now.x - next.x) < 0.5 && Math.abs(now.y - next.y) < 0.5 ? now : next));
  }, [size]);
  useReplace(span, place, [themeId], [profile]);
  return (
    <span
      ref={span}
      className="pe-part-tools"
      data-where="contact"
      data-tools="contact"
      style={at ? { insetInlineStart: at.x, insetBlockStart: at.y, insetInlineEnd: "auto", translate: "none" } : undefined}
    >
      <Popover
        isOpen={open}
        onOpenChange={(next) => (next ? api.open("links") : open && api.close())}
        label="Your links"
        placement="below"
        alignment="end"
        width={narrow ? "100%" : 384}
        padding={4}
        presentation="adaptive"
        content={<LinksPanel />}
      >
        <Button size={size} label="Your links" aria-expanded={open}>
          <Link2 aria-hidden size={16} strokeWidth={2.25} />
          Your links
        </Button>
      </Popover>
    </span>
  );
}

/** The links' fields, for the popover (and for a sheet, where Get in touch is not on the page). */
export function LinksPanel(): ReactNode {
  const api = usePortfolioApi();
  const profile = usePortfolioState((s) => s.profile);
  const showLinkedin = usePortfolioState((s) => s.arrangement.header.linkedin);
  const issues = usePortfolioUi((u) => u.issues);
  return (
    <div className="pe-links" data-links-panel>
      <Text type="body" color="secondary">
        How an employer reaches you. They show in Get in touch, shortened to fit.
      </Text>
      {LINKS.map((l) => (
        <div key={l.key} data-path={l.path}>
          <TextInput
            label={l.label}
            isOptional
            type={l.type}
            inputMode={l.type}
            autoComplete={l.type === "email" ? "email" : "url"}
            placeholder={l.placeholder}
            description={l.description}
            value={profile[l.key] ?? ""}
            onChange={(v) => api.setAt(l.path, v)}
            status={issues[l.path] ? { type: "error", message: issues[l.path] } : undefined}
            statusVariant="detached"
            width="100%"
          />
          {l.key === "linkedin" && (
            <div data-path="arrangement.header.linkedin" className="pe-links-switch">
              <Switch
                label="Show LinkedIn on your page"
                size="sm"
                value={showLinkedin}
                onChange={(on) => api.change((s) => ({ ...s, arrangement: { ...s.arrangement, header: { ...s.arrangement.header, linkedin: on } } }), on ? "showed LinkedIn" : "hid LinkedIn")}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
