/* eslint-disable @next/next/no-img-element -- signed Storage URLs change hourly; next/image would cache the wrong one. */
import { ArrowUpRight } from "lucide-react";
import { portfolioHost } from "@/lib/hosts";
import { initialsOf } from "@/lib/portfolio-profile";
import { DEFAULT_THEME, type PortfolioTheme } from "@/lib/portfolio-themes";
import { themeStyle } from "./themeFonts";

/**
 * The top of a person's portfolio: their cover, photo, name, what they do, where they are and what
 * they're after, then their intro in their own words with how to reach them (decision 0016). The
 * public page, the owner's preview and the builder's live preview all draw this, so what the person
 * sees while building is what is published.
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
  coverUrl?: string | null;
  /** Checked https addresses, or null. The email is shown as text, never as a mailto. */
  links?: { linkedin?: string | null; github?: string | null; website?: string | null; email?: string | null };
};

/** The host and path without the scheme: "github.com/amara". */
const shown = (href: string) => href.replace(/^https:\/\/(www\.)?/, "").replace(/\/$/, "");

function Face({ person, theme, size }: { person: PortfolioPerson; theme: PortfolioTheme; size: "lg" | "sm" }) {
  const box = size === "lg" ? "size-24 sm:size-28" : "size-10";
  const corners = theme.photo === "round" ? "rounded-full" : size === "lg" ? "rounded-[22px]" : "rounded-[10px]";
  // The ring is the band's own colour, so the photo reads as sitting on the band where it overlaps the cover.
  const ring = size === "lg" ? "border-4 border-[color:var(--band-bg)]" : "";
  if (person.photoUrl) {
    return <img src={person.photoUrl} alt="" width={112} height={112} data-avatar="photo" className={`${box} ${corners} ${ring} shrink-0 bg-[var(--band-bg)] object-cover`} />;
  }
  return (
    <span
      aria-hidden
      data-avatar="initials"
      className={`${box} ${corners} ${ring} inline-flex shrink-0 items-center justify-center bg-[var(--band-initials-bg)] font-[family-name:var(--font-display)] font-semibold text-[color:var(--band-initials-text)] ${size === "lg" ? "text-[2rem] sm:text-[2.4rem]" : "text-sm"}`}
    >
      {initialsOf(person.name) || "?"}
    </span>
  );
}

function ContactLink({ href }: { href: string }) {
  if (!href.startsWith("https://")) return null;
  return (
    <a href={href} rel="noopener" target="_blank" className="link inline-flex items-center gap-1 break-all">
      {shown(href)} <ArrowUpRight aria-hidden size={14} strokeWidth={2.25} className="shrink-0" />
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  );
}

/** The contact rows a person has filled in, in a fixed order. */
function contactRows(links: PortfolioPerson["links"]) {
  const l = links ?? {};
  return [
    l.linkedin && { label: "LinkedIn", node: <ContactLink href={l.linkedin} /> },
    l.github && { label: "GitHub", node: <ContactLink href={l.github} /> },
    l.website && { label: "Website", node: <ContactLink href={l.website} /> },
    // Text, not a link: a mailto hands the address to every scraper.
    l.email && { label: "Email", node: <span className="break-all">{l.email}</span> },
  ].filter(Boolean) as { label: string; node: React.ReactNode }[];
}

export function PortfolioMasthead({
  person,
  theme = DEFAULT_THEME,
  skills = [],
  projectCount = 0,
  showSkills = true,
  note,
}: {
  person: PortfolioPerson;
  theme?: PortfolioTheme;
  /** Every skill the shown exhbts prove, in order, without repeats. */
  skills?: string[];
  projectCount?: number;
  showSkills?: boolean;
  /** A line above everything, for the owner's preview. */
  note?: React.ReactNode;
}) {
  const facts = [
    person.location && { label: "Based in", value: person.location },
    person.lookingFor && { label: "Looking for", value: person.lookingFor },
  ].filter(Boolean) as { label: string; value: string }[];
  const contact = contactRows(person.links);
  const intro = (person.bio ?? "").split(/\n{2,}/).filter((p) => p.trim());
  const skillList = showSkills ? skills : [];
  const hasAbout = intro.length > 0 || contact.length > 0 || skillList.length > 0;

  return (
    <header data-theme={theme.id} data-masthead style={themeStyle(theme)} className="overflow-hidden rounded-[24px] border border-line bg-surface shadow-pack print:shadow-none">
      {note}
      <div className="bg-[var(--band-bg)] text-[color:var(--band-text)]">
        {person.coverUrl ? (
          <img src={person.coverUrl} alt="" width={1500} height={500} data-cover className="aspect-[3/1] w-full object-cover" />
        ) : (
          <div aria-hidden className="h-10 sm:h-14" />
        )}
        <div className="px-5 pb-7 sm:px-10 sm:pb-9">
          <div className={`flex flex-wrap items-end gap-x-6 gap-y-4 ${person.coverUrl ? "-mt-12 sm:-mt-14" : ""}`}>
            <Face person={person} theme={theme} size="lg" />
            {person.username && (
              <p className="ml-auto self-end rounded-full border border-[color:var(--band-edge)] px-3 py-1 text-[0.8125rem] text-[color:var(--band-soft)] max-sm:hidden">
                {portfolioHost(person.username)}
              </p>
            )}
          </div>
          <h1 className="mt-5 text-[2.25rem] leading-[1.05] tracking-[-0.03em] text-[color:var(--band-text)] sm:text-[3.25rem]">{person.name}</h1>
          {person.headline && <p className="mt-2 max-w-[44rem] text-[1.125rem] leading-snug text-[color:var(--band-soft)] sm:text-[1.25rem]">{person.headline}</p>}
          {facts.length > 0 && (
            <dl className="mt-5 flex flex-wrap gap-x-8 gap-y-2 text-[0.95rem]">
              {facts.map((f) => (
                <div key={f.label} className="flex flex-wrap gap-x-2">
                  <dt className="font-semibold text-[color:var(--band-accent)]">{f.label}</dt>
                  <dd>{f.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </div>

      {hasAbout && (
        <section aria-label={`About ${person.name}`} className="grid gap-x-10 gap-y-6 px-5 py-7 sm:px-10 sm:py-9 lg:grid-cols-[minmax(0,1fr)_16rem]">
          <div className="min-w-0">
            {intro.length > 0 && (
              <div data-intro className="max-w-[40rem] space-y-3 text-[1.125rem] leading-relaxed text-ink sm:text-[1.1875rem]">
                {intro.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            )}
            {skillList.length > 0 && (
              <div className={intro.length ? "mt-6" : ""} data-skills>
                <h2 className="text-[0.95rem] font-semibold font-sans tracking-normal text-graphite">
                  Skills across {projectCount === 1 ? "my exhbt" : `my ${projectCount} exhbts`}
                </h2>
                <ul className="mt-1.5 flex flex-wrap gap-x-1 text-[0.95rem] text-ink" aria-label="Skills proven">
                  {skillList.map((s, i) => (
                    <li key={s}>
                      {s}
                      {i < skillList.length - 1 && <span aria-hidden className="text-slate">,</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          {contact.length > 0 && (
            <div data-contact className="lg:border-l lg:border-line lg:pl-8">
              <h2 className="text-[0.95rem] font-semibold font-sans tracking-normal text-graphite">Get in touch</h2>
              <dl className="mt-2 space-y-2">
                {contact.map((r) => (
                  <div key={r.label}>
                    <dt className="text-[0.8125rem] text-slate">{r.label}</dt>
                    <dd className="min-w-0">{r.node}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </section>
      )}
    </header>
  );
}
