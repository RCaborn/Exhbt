/* eslint-disable @next/next/no-img-element -- signed Storage URLs change hourly; next/image would cache the wrong one. */
import Link from "next/link";
import { ArrowUpRight, CircleCheck, MapPin } from "lucide-react";
import { Chart } from "@/components/charts/Chart";
import { Logo } from "@/components/brand/Logo";
import type { PortfolioPerson } from "@/components/portfolio/PortfolioPage";
import { portfolioHost } from "@/lib/hosts";
import type { HomeProject, KeyFigure } from "@/lib/portfolio-home";
import { SECTION_HINTS, SECTION_NAMES, splitYear, type SectionKey, type Tiles } from "@/lib/portfolio-layout";
import { initialsOf } from "@/lib/portfolio-profile";
import { DEFAULT_THEME, type PortfolioTheme } from "@/lib/portfolio-themes";
import { themeStyle } from "./themeFonts";

/**
 * A person's portfolio home, as Rory's layout spec draws it (docs/design/portfolio-and-exhbt-layouts.pdf,
 * page 1; decision 0016): a top bar with their address and "Work, About, Get in touch", a hero with
 * their photo, "Hi, I'm", their name large and their intro, then the sections they arranged:
 * their best piece of work in a band, more of their work as cards, about them with education and
 * tools, experience, a quote and how to get in touch. The top bar and hero are fixed; the sections
 * come in any order, and each one looks right wherever it sits.
 *
 * Every colour, corner and face is a CSS variable set by the look (`themeStyle`: `--pf-*`, `--band-*`,
 * `--font-display`), never a fixed brand class, so a look restyles the whole page. Plain markup, no
 * hooks: the public page renders it on the server and the builder's live preview in the browser,
 * where `frame` wraps each section in its drag handle.
 */

export type HomeProps = {
  person: PortfolioPerson;
  theme?: PortfolioTheme;
  /** The exhbts shown, in the person's order. */
  projects: HomeProject[];
  /** The starred exhbt, or null: the band then shows the first. */
  featuredId: string | null;
  sections: SectionKey[];
  tiles: Tiles;
  /** "preview" shows empty sections as outlines that say what goes there; the public page leaves them out. */
  mode?: "public" | "preview";
  /** The builder's drag handle and controls around a section. */
  frame?: (key: SectionKey, section: React.ReactNode) => React.ReactNode;
  /** The sign-off's link to our site (absolute on a person's own host). */
  startHref?: string;
  /** In the builder's preview: the fixed parts (top bar, hero, footer) are a picture, not links. */
  inertChrome?: boolean;
  /** Only the sections, without the top bar, hero and footer (the lifted section while it is dragged). */
  sectionsOnly?: boolean;
};

const WRAP = "mx-auto w-full max-w-[68rem] px-5 @3xl:px-10";
const H2 = "font-[family-name:var(--font-display)] text-[1.75rem] leading-tight font-semibold tracking-[-0.025em] text-[color:var(--pf-ink)] @3xl:text-[2rem]";
const ROWS = "divide-y divide-[color:var(--pf-line)] border-y border-[color:var(--pf-line)]";

/** What each section needs before visitors see it. */
export function sectionHasContent(key: SectionKey, p: Pick<HomeProps, "projects" | "featuredId" | "sections" | "tiles" | "person">): boolean {
  switch (key) {
    case "featured":
      return p.projects.length > 0;
    case "work":
      return workProjects(p).length > 0;
    case "about":
      return Boolean(p.tiles.about?.text.trim() || p.tiles.education?.lines.some((l) => l.trim()) || p.tiles.education?.tools?.trim());
    case "experience":
      return Boolean(p.tiles.experience?.lines.some((l) => l.trim()));
    case "quote":
      return Boolean(p.tiles.quote?.text.trim());
    case "contact":
      return contactRows(p.person, p.tiles).length > 0;
  }
}

export function featuredOf(p: Pick<HomeProps, "projects" | "featuredId">): HomeProject | null {
  return p.projects.find((x) => x.id === p.featuredId) ?? p.projects[0] ?? null;
}

/** The cards: every exhbt but the one in the band, when the band is on the page. */
export function workProjects(p: Pick<HomeProps, "projects" | "featuredId" | "sections">): HomeProject[] {
  if (!p.sections.includes("featured")) return p.projects;
  const f = featuredOf(p);
  return p.projects.filter((x) => x !== f);
}

export function PortfolioHome(props: HomeProps) {
  const { person, theme = DEFAULT_THEME, sections, mode = "public", frame } = props;
  const shown = sections.filter((k) => mode === "preview" || sectionHasContent(k, props));
  const has = (k: SectionKey) => shown.includes(k) && sectionHasContent(k, props);
  const nav = [
    (has("featured") || has("work")) && { href: has("featured") ? "#best-work" : "#work", label: "Work" },
    has("about") && { href: "#about", label: "About" },
  ].filter(Boolean) as { href: string; label: string }[];

  return (
    <div data-portfolio-home data-theme={theme.id} style={themeStyle(theme)} className="@container bg-[var(--pf-ground)] text-[color:var(--pf-ink)]">
      {!props.sectionsOnly && (
        <div inert={props.inertChrome || undefined}>
          <TopBar username={person.username} nav={nav} contact={has("contact")} />
          <Hero person={person} theme={theme} />
        </div>
      )}
      {shown.map((key) => {
        const node = <Section key={key} sectionKey={key} {...props} />;
        return frame ? <div key={key}>{frame(key, node)}</div> : node;
      })}
      {!props.sectionsOnly && (
      <footer inert={props.inertChrome || undefined} className={`${WRAP} pt-10 pb-12`}>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.8125rem] text-[color:var(--pf-faint)]">
          <span className="inline-flex items-center gap-1.5">
            Made with <Logo size="sm" className="text-[color:var(--pf-ink)]" />
          </span>
          <Link href={props.startHref ?? "/start"} className="underline decoration-[color:var(--pf-line)] underline-offset-4 hover:text-[color:var(--pf-ink)]">
            Build your own roadmap
          </Link>
        </p>
      </footer>
      )}
    </div>
  );
}

function TopBar({ username, nav, contact }: { username: string | null; nav: { href: string; label: string }[]; contact: boolean }) {
  return (
    <nav aria-label="Portfolio" className={`${WRAP} flex flex-wrap items-center justify-between gap-3 pt-5 pb-2`}>
      {username ? (
        <p className="rounded-full border border-[color:var(--pf-line)] px-3 py-1 text-[0.8125rem] text-[color:var(--pf-soft)]">{portfolioHost(username)}</p>
      ) : (
        <span />
      )}
      <ul className="flex items-center gap-1 text-[0.9375rem] font-medium">
        {nav.map((n) => (
          <li key={n.href}>
            <a href={n.href} className="rounded-full px-3 py-2 hover:bg-[var(--pf-well)]">
              {n.label}
            </a>
          </li>
        ))}
        {contact && (
          <li>
            <a href="#contact" className="ml-1 inline-flex rounded-full bg-[var(--pf-button-bg)] px-4 py-2 font-semibold text-[color:var(--pf-button-text)] hover:opacity-90">
              Get in touch
            </a>
          </li>
        )}
      </ul>
    </nav>
  );
}

function Hero({ person, theme }: { person: PortfolioPerson; theme: PortfolioTheme }) {
  const intro = (person.bio ?? "").split(/\n{2,}/).filter((p) => p.trim());
  const corners = theme.photo === "round" ? "rounded-full" : "rounded-[var(--pf-radius-lg)]";
  const face = "size-28 @3xl:size-40";
  return (
    <header className={`${WRAP} grid items-center gap-x-12 gap-y-6 pt-10 pb-14 @3xl:grid-cols-[auto_minmax(0,1fr)] @3xl:pt-14 @3xl:pb-20`}>
      {person.photoUrl ? (
        <img src={person.photoUrl} alt="" width={160} height={160} data-avatar="photo" className={`${face} ${corners} object-cover`} />
      ) : (
        <span
          aria-hidden
          data-avatar="initials"
          className={`${face} ${corners} inline-flex items-center justify-center bg-[var(--band-initials-bg)] font-[family-name:var(--font-display)] text-[2.5rem] font-semibold text-[color:var(--band-initials-text)] @3xl:text-[3.25rem]`}
        >
          {initialsOf(person.name) || "?"}
        </span>
      )}
      <div className="min-w-0">
        <p className="text-[1rem] text-[color:var(--pf-soft)]">Hi, I&rsquo;m</p>
        <h1 className="mt-1 font-[family-name:var(--font-display)] text-[clamp(3rem,11cqw,7.25rem)] leading-[0.92] font-semibold tracking-[-0.045em] break-words text-[color:var(--pf-ink)]">
          {person.name}
        </h1>
        {person.headline && <p className="mt-4 text-[1.0625rem] font-medium text-[color:var(--pf-ink)]">{person.headline}</p>}
        {intro.length > 0 && (
          <div data-intro className="mt-5 max-w-[36rem] space-y-3 text-[1.125rem] leading-relaxed text-[color:var(--pf-soft)] @3xl:text-[1.25rem]">
            {intro.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        )}
        {(person.location || person.lookingFor) && (
          <p className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-1 text-[0.95rem] text-[color:var(--pf-faint)]">
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
      </div>
    </header>
  );
}

function Section(props: HomeProps & { sectionKey: SectionKey }) {
  const key = props.sectionKey;
  if (!sectionHasContent(key, props)) return <EmptySection sectionKey={key} />;
  switch (key) {
    case "featured":
      return <Featured project={featuredOf(props)!} />;
    case "work":
      return <Work projects={workProjects(props)} more={props.sections.includes("featured")} />;
    case "about":
      return <About tiles={props.tiles} />;
    case "experience":
      return (
        <section data-section="experience" aria-labelledby="experience-h" className={`${WRAP} py-12 @3xl:py-16`}>
          <h2 id="experience-h" className={H2}>
            Experience
          </h2>
          <Rows lines={props.tiles.experience?.lines ?? []} className="mt-6 @3xl:max-w-[44rem]" />
        </section>
      );
    case "quote": {
      const q = props.tiles.quote!;
      return (
        <section data-section="quote" aria-label="A quote" className={`${WRAP} py-12 @3xl:py-16`}>
          <figure className="max-w-[48rem]">
            <blockquote className="font-[family-name:var(--font-display)] text-[1.6rem] leading-snug font-semibold tracking-[-0.02em] @3xl:text-[2rem]">
              &ldquo;{q.text.trim()}&rdquo;
            </blockquote>
            {(q.name.trim() || q.role.trim()) && (
              <figcaption className="mt-4 text-[color:var(--pf-soft)]">
                {q.name.trim() && <span className="font-semibold text-[color:var(--pf-ink)]">{q.name.trim()}</span>}
                {q.name.trim() && q.role.trim() && ", "}
                {q.role.trim()}
              </figcaption>
            )}
          </figure>
        </section>
      );
    }
    case "contact":
      return <Contact rows={contactRows(props.person, props.tiles)} />;
  }
}

function Featured({ project: p }: { project: HomeProject }) {
  return (
    <section data-section="featured" id="best-work" aria-labelledby="best-work-h" data-band className="bg-[var(--band-bg)] text-[color:var(--band-text)]">
      <div className={`${WRAP} grid items-center gap-x-12 gap-y-8 py-14 @3xl:grid-cols-2 @3xl:py-20`}>
        <div className="min-w-0">
          <p className="text-[0.8125rem] font-semibold text-[color:var(--band-accent)]">My best piece of work</p>
          <h2 id="best-work-h" className="mt-3 font-[family-name:var(--font-display)] text-[clamp(1.85rem,4.4cqw,2.75rem)] leading-[1.08] font-semibold tracking-[-0.03em] text-[color:var(--band-text)]">
            {p.title}
          </h2>
          {p.summary && <p className="mt-4 max-w-[34rem] text-[1.0625rem] leading-relaxed text-[color:var(--band-soft)]">{p.summary}</p>}
          <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-3">
            {p.href && (
              <Link
                href={p.href}
                className="inline-flex items-center rounded-full bg-[var(--band-text)] px-5 py-3 text-[0.95rem] font-semibold text-[color:var(--band-bg)] hover:opacity-90"
              >
                See how I did it
              </Link>
            )}
            <p className="inline-flex items-center gap-1.5 text-[0.875rem] font-semibold text-[color:var(--band-accent)]">
              <CircleCheck aria-hidden size={16} strokeWidth={2.25} />
              {p.sourceAttached ? "Source attached and checked" : "Checked by exhbt"}
            </p>
          </div>
        </div>
        <div className="min-w-0 rounded-[var(--pf-radius-lg)] bg-[var(--pf-card)] p-5 text-[color:var(--pf-ink)] shadow-pack @3xl:p-7">
          <Figure project={p} large />
        </div>
      </div>
    </section>
  );
}

function Work({ projects, more }: { projects: HomeProject[]; more: boolean }) {
  return (
    <section data-section="work" id="work" aria-labelledby="work-h" className={`${WRAP} py-12 @3xl:py-16`}>
      <h2 id="work-h" className={H2}>
        {more ? "More of my work" : "My work"}
      </h2>
      <ul className="mt-6 grid gap-5 @2xl:grid-cols-2">
        {projects.map((p) => {
          const body = (
            <>
              <div className="flex min-h-48 items-center justify-center border-b border-[color:var(--pf-line)] bg-[var(--pf-well)] p-5">
                <Figure project={p} />
              </div>
              <div className="p-5">
                <h3 className="text-[1.0625rem] leading-snug font-semibold tracking-[-0.01em] text-[color:var(--pf-ink)]">{p.title}</h3>
                {p.summary && <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-[color:var(--pf-soft)]">{p.summary}</p>}
              </div>
            </>
          );
          const card =
            "flex h-full flex-col overflow-hidden rounded-[var(--pf-radius)] border border-[color:var(--pf-line)] bg-[var(--pf-card)] transition-[transform,border-color] duration-150";
          return (
            <li key={p.id} data-card={p.id}>
              {p.href ? (
                <Link href={p.href} className={`${card} hover:-translate-y-0.5 hover:border-[color:var(--pf-ink)] motion-reduce:hover:translate-y-0`}>
                  {body}
                </Link>
              ) : (
                <div className={card}>{body}</div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function About({ tiles }: { tiles: Tiles }) {
  const text = (tiles.about?.text ?? "").trim();
  const lines = (tiles.education?.lines ?? []).filter((l) => l.trim());
  const tools = tiles.education?.tools?.trim();
  const rows = lines.length > 0 || tools;
  return (
    <section data-section="about" id="about" aria-labelledby="about-h" className={`${WRAP} grid gap-x-12 gap-y-6 py-12 @3xl:grid-cols-2 @3xl:py-16`}>
      <div>
        <h2 id="about-h" className={H2}>
          About me
        </h2>
        {text && <p className="mt-4 max-w-[34rem] text-[1.0625rem] leading-relaxed text-[color:var(--pf-soft)]">{text}</p>}
      </div>
      {rows && <Rows lines={lines} extra={tools ? { label: "Tools", value: tools } : undefined} className="@3xl:mt-2" />}
    </section>
  );
}

function Rows({ lines, extra, className = "" }: { lines: string[]; extra?: { label: string; value: string }; className?: string }) {
  return (
    <dl className={`${ROWS} text-[0.95rem] ${className}`}>
      {lines
        .filter((l) => l.trim())
        .map((l, i) => {
          const { label, year } = splitYear(l);
          return (
            <div key={i} className="flex items-baseline justify-between gap-6 py-3">
              <dt className="min-w-0 font-semibold text-[color:var(--pf-ink)]">{label}</dt>
              <dd className="shrink-0 text-[color:var(--pf-faint)] tabular-nums">{year}</dd>
            </div>
          );
        })}
      {extra && (
        <div className="flex items-baseline justify-between gap-6 py-3">
          <dt className="font-semibold text-[color:var(--pf-ink)]">{extra.label}</dt>
          <dd className="min-w-0 text-right text-[color:var(--pf-faint)]">{extra.value}</dd>
        </div>
      )}
    </dl>
  );
}

type ContactRow = { label: string; href?: string; text: string };

/** The person's links from the first step; a links tile saved by the old customiser fills any gaps. */
export function contactRows(person: PortfolioPerson, tiles: Tiles): ContactRow[] {
  const l = person.links ?? {};
  const t = tiles.links;
  const linkedin = l.linkedin ?? t?.linkedin;
  const github = l.github ?? t?.github;
  const website = l.website ?? t?.website;
  const email = l.email ?? t?.email;
  const shown = (href: string) => href.replace(/^https:\/\/(www\.)?/, "").replace(/\/$/, "");
  return [
    linkedin?.startsWith("https://") && { label: "LinkedIn", href: linkedin, text: shown(linkedin) },
    github?.startsWith("https://") && { label: "GitHub", href: github, text: shown(github) },
    website?.startsWith("https://") && { label: "Website", href: website, text: shown(website) },
    // Text, not a link: a mailto hands the address to every scraper.
    email && { label: "Email", text: email },
  ].filter(Boolean) as ContactRow[];
}

function Contact({ rows }: { rows: ContactRow[] }) {
  return (
    <section data-section="contact" id="contact" aria-labelledby="contact-h" className={`${WRAP} grid gap-x-12 gap-y-6 py-12 @3xl:grid-cols-2 @3xl:py-16`}>
      <h2 id="contact-h" className={H2}>
        Get in touch
      </h2>
      <dl className={`${ROWS} text-[0.95rem]`} aria-label="Contact">
        {rows.map((r) => (
          <div key={r.label} className="flex items-baseline justify-between gap-6 py-3">
            <dt className="font-semibold text-[color:var(--pf-ink)]">{r.label}</dt>
            <dd className="min-w-0 text-right break-all">
              {r.href ? (
                <a href={r.href} rel="noopener" target="_blank" className="inline-flex items-center gap-1 text-[color:var(--pf-accent)] underline underline-offset-4">
                  {r.text} <ArrowUpRight aria-hidden size={14} strokeWidth={2.25} className="shrink-0" />
                  <span className="sr-only">(opens in a new tab)</span>
                </a>
              ) : (
                <span className="text-[color:var(--pf-soft)]">{r.text}</span>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/** A section with nothing in it yet, in the builder's preview only: what goes there. */
function EmptySection({ sectionKey }: { sectionKey: SectionKey }) {
  return (
    <section data-section={sectionKey} data-empty className={`${WRAP} py-8`}>
      <div className="rounded-[var(--pf-radius)] border border-dashed border-[color:var(--pf-faint)] px-5 py-8 text-center">
        <p className="font-semibold">{SECTION_NAMES[sectionKey]}</p>
        <p className="mt-1 text-[0.9375rem] text-[color:var(--pf-soft)]">
          {SECTION_HINTS[sectionKey]}. Empty, so visitors don&rsquo;t see it.
        </p>
      </div>
    </section>
  );
}

/** The key figure: a graph as the exhbt page draws it, an image, or the steps of the process. */
function Figure({ project: p, large = false }: { project: HomeProject; large?: boolean }) {
  return <KeyFigureView figure={p.figure} imageUrl={p.imageUrl} large={large} />;
}

function KeyFigureView({ figure, imageUrl, large }: { figure: KeyFigure; imageUrl?: string | null; large: boolean }) {
  switch (figure.kind) {
    case "chart":
      return (
        <div className="@container w-full min-w-0" data-key-figure="chart">
          <Chart data={figure.chart} />
        </div>
      );
    case "image":
      return imageUrl ? (
        <img src={imageUrl} alt={figure.alt} data-key-figure="image" className={`w-full rounded-[calc(var(--pf-radius)-6px)] object-contain ${large ? "max-h-[22rem]" : "max-h-56"}`} />
      ) : (
        <p className="text-[0.875rem] text-[color:var(--pf-faint)]">{figure.alt}</p>
      );
    case "flow":
      return (
        <ol aria-label="Process" data-key-figure="flow" className="flex w-full flex-col gap-1.5 text-[0.875rem]">
          {figure.steps.map((s, i) => (
            <li
              key={`${i}-${s}`}
              className={`rounded-[calc(var(--pf-radius)-6px)] border px-3 py-2 font-medium ${
                i === figure.steps.length - 1
                  ? "border-[color:var(--pf-button-bg)] bg-[var(--pf-button-bg)] text-[color:var(--pf-button-text)]"
                  : "border-[color:var(--pf-line)] bg-[var(--pf-card)]"
              }`}
            >
              {s}
            </li>
          ))}
        </ol>
      );
  }
}

/** "Graduate data roles" reads on after "Looking for"; a name or acronym ("NHS data roles") keeps its capital. */
function lowerFirst(s: string): string {
  const t = s.trim().replace(/^looking for\s+/i, "");
  return /^[A-Z][a-z]/.test(t) ? t.charAt(0).toLowerCase() + t.slice(1) : t;
}
