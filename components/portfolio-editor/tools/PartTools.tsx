"use client";

import { useState, type ReactNode } from "react";
import { Link2, Sparkles } from "lucide-react";
import { Popover } from "@astryxdesign/core/Popover";
import { Switch } from "@astryxdesign/core/Switch";
import { Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { suggestIntroAction } from "@/app/(app)/portfolio/actions";
import type { HomePath } from "@/components/portfolio/home-ctx";
import { Button } from "@/components/ui/Button";
import { useBarSize, useNarrow } from "../bar/hooks";
import { usePortfolioApi, usePortfolioState, usePortfolioUi } from "../runtime";

/*
 * The corner tools of the two parts with no frame of their own (decision 0031, "What is edited where"),
 * drawn over the page and taking no room:
 *  - "intro": Suggest an intro, the last child of `[data-intro]` (relative while editing). It drafts an
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

function SuggestIntro(): ReactNode {
  const api = usePortfolioApi();
  const profile = usePortfolioState((s) => s.profile);
  const filled = profile.bio.trim().length > 0;
  const size = useBarSize();
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
    <span className="pe-tools" data-where="intro" data-tools="intro" data-filled={filled ? "" : undefined}>
      <Button size={size} onClick={suggest} loading={busy} disabled={busy} label="Suggest an intro">
        <Sparkles aria-hidden size={15} strokeWidth={2} />
        Suggest an intro
      </Button>
      <span role="status" className="sr-only">
        {note?.text}
      </span>
      {note && (
        <p aria-hidden className="pe-tools-note" data-error={note.error ? "" : undefined} data-intro-note>
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
  return (
    <span className="pe-tools" data-where="contact" data-tools="contact">
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
