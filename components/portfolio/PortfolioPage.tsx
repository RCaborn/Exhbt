/* eslint-disable @next/next/no-img-element -- signed Storage URLs change hourly; next/image would cache the wrong one. */
import { ArrowUpRight, MapPin } from "lucide-react";
import { initialsOf } from "@/lib/portfolio-profile";
import { DEFAULT_THEME, type PortfolioTheme } from "@/lib/portfolio-themes";
import { themeStyle } from "./themeFonts";

/**
 * The top of a person's portfolio (decision 0016): their photo top left with their name, what they
 * do and their intro in their own words beside it, then, quietly, where they are, what they're
 * after and how to reach them. Few labels and plenty of space between the blocks, so it can be
 * read in a glance. The public page, the owner's preview and the builder's live preview all draw
 * this, so what the person sees while building is what is published.
 *
 * Every colour and the heading face come from the look's CSS variables (`--band-*`,
 * `--font-display`, set by `themeStyle`), never from fixed brand classes, so a later layout template
 * can restyle the page by setting different variables, or swap this component for its own.
 *
 * Plain markup with no hooks, so it renders on the server and inside the builder (a client page).
 */

export type PortfolioPerson = {
  username: string | null;
  name: string;
  headline?: string | null;
  /** The intro, in their words. Paragraphs are separated by a blank line. */
  bio?: string | null;
  location?: string | null;
  lookingFor?: string | null;
  photoUrl?: string | null;
  /** Checked https addresses, or null. The email is shown as text, never as a mailto. */
  links?: { linkedin?: string | null; github?: string | null; website?: string | null; email?: string | null };
};

/** The host and path without the scheme: "github.com/amara". */
const shown = (href: string) => href.replace(/^https:\/\/(www\.)?/, "").replace(/\/$/, "");

function Face({ person, theme }: { person: PortfolioPerson; theme: PortfolioTheme }) {
  const box = "size-20 sm:size-28";
  const corners = theme.photo === "round" ? "rounded-full" : "rounded-[18px] sm:rounded-[22px]";
  if (person.photoUrl) {
    return <img src={person.photoUrl} alt="" width={112} height={112} data-avatar="photo" className={`${box} ${corners} shrink-0 object-cover`} />;
  }
  return (
    <span
      aria-hidden
      data-avatar="initials"
      className={`${box} ${corners} inline-flex shrink-0 items-center justify-center bg-[var(--band-initials-bg)] font-[family-name:var(--font-display)] text-[1.75rem] font-semibold text-[color:var(--band-initials-text)] sm:text-[2.4rem]`}
    >
      {initialsOf(person.name) || "?"}
    </span>
  );
}

const LINK = "inline-flex items-center gap-1 underline decoration-[color:var(--band-edge)] underline-offset-4 hover:decoration-[color:var(--band-accent)]";

function ContactLink({ href, label }: { href: string; label: string }) {
  if (!href.startsWith("https://")) return null;
  return (
    <a href={href} rel="noopener" target="_blank" className={LINK}>
      {label} <ArrowUpRight aria-hidden size={14} strokeWidth={2.25} className="shrink-0 text-[color:var(--band-soft)]" />
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  );
}

/** The ways to reach the person, in a fixed order, each as a short link (the email as text). */
function contactItems(links: PortfolioPerson["links"]) {
  const l = links ?? {};
  return [
    l.linkedin && { key: "linkedin", node: <ContactLink href={l.linkedin} label="LinkedIn" /> },
    l.github && { key: "github", node: <ContactLink href={l.github} label="GitHub" /> },
    l.website && { key: "website", node: <ContactLink href={l.website} label={shown(l.website)} /> },
    // Text, not a link: a mailto hands the address to every scraper.
    l.email && { key: "email", node: <span className="break-all">{l.email}</span> },
  ].filter(Boolean) as { key: string; node: React.ReactNode }[];
}

export function PortfolioMasthead({ person, theme = DEFAULT_THEME }: { person: PortfolioPerson; theme?: PortfolioTheme }) {
  const contact = contactItems(person.links);
  const intro = (person.bio ?? "").split(/\n{2,}/).filter((p) => p.trim());
  const quiet = person.location || person.lookingFor || contact.length > 0;

  return (
    <header
      data-theme={theme.id}
      data-masthead
      style={themeStyle(theme)}
      className="overflow-hidden rounded-[24px] border border-line bg-[var(--band-bg)] text-[color:var(--band-text)] shadow-pack print:shadow-none"
    >
      <div className="grid gap-x-8 gap-y-6 px-5 py-8 sm:grid-cols-[auto_minmax(0,1fr)] sm:px-10 sm:py-12">
        <Face person={person} theme={theme} />
        <div className="min-w-0">
          <h1 className="text-[2.25rem] leading-[1.05] tracking-[-0.03em] text-[color:var(--band-text)] sm:text-[3rem]">{person.name}</h1>
          {person.headline && <p className="mt-3 max-w-[44rem] text-[1.125rem] leading-snug text-[color:var(--band-soft)] sm:text-[1.25rem]">{person.headline}</p>}

          {intro.length > 0 && (
            <div data-intro className="mt-8 max-w-[40rem] space-y-4 text-[1.0625rem] leading-relaxed sm:text-[1.125rem] [&_p]:text-[color:var(--band-text)]">
              {intro.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          )}

          {quiet && (
            <div data-contact className="mt-8 space-y-3 text-[0.95rem] text-[color:var(--band-soft)]">
              {(person.location || person.lookingFor) && (
                <p className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[color:var(--band-soft)]">
                  {person.location && (
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin aria-hidden size={15} strokeWidth={2} />
                      <span className="sr-only">Based in </span>
                      {person.location}
                    </span>
                  )}
                  {person.lookingFor && <span data-looking-for>Looking for {lowerFirst(person.lookingFor)}</span>}
                </p>
              )}
              {contact.length > 0 && (
                <ul aria-label="Contact" className="flex flex-wrap gap-x-5 gap-y-1 text-[color:var(--band-text)]">
                  {contact.map((c) => (
                    <li key={c.key}>{c.node}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

/** "Graduate data roles" reads on after "Looking for"; a name or acronym ("NHS data roles") keeps its capital. */
function lowerFirst(s: string): string {
  const t = s.trim().replace(/^looking for\s+/i, "");
  return /^[A-Z][a-z]/.test(t) ? t.charAt(0).toLowerCase() + t.slice(1) : t;
}
