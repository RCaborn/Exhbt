/* eslint-disable @next/next/no-img-element -- signed Storage URLs change hourly; next/image would cache the wrong one. */
import { Fragment, memo } from "react";
import Link from "next/link";
import { ArrowUpRight, ChevronRight, CircleCheck, MapPin } from "lucide-react";
import { Chart } from "@/components/charts/Chart";
import { Logo } from "@/components/brand/Logo";
import type { PortfolioPerson } from "@/components/portfolio/PortfolioPage";
import { portfolioHost } from "@/lib/hosts";
import { topSkills, type HomeProject, type KeyFigure } from "@/lib/portfolio-home";
import { SECTION_HINTS, SECTION_NAMES, splitYear, TILE_LIMITS, type SectionKey, type Tiles } from "@/lib/portfolio-layout";
import { initialsOf } from "@/lib/portfolio-profile";
import { DEFAULT_THEME, type FontKey, type PortfolioTheme } from "@/lib/portfolio-themes";
import type { HomeEdit, HomeTextSlot } from "./home-ctx";
import { lookAttrs, printStyle, themeStyle } from "./themeFonts";

/**
 * A person's portfolio home, as Rory's layout spec draws it (docs/design/portfolio-and-exhbt-layouts.pdf,
 * page 1; decision 0016): a top bar with their address and "Work, About, Get in touch", a hero with
 * their photo, their name large and their intro, then the sections they arranged: their best piece
 * of work in a band, more of their work, about them with education and tools, experience, a quote
 * and how to get in touch. The top bar and hero are fixed; the sections come in any order.
 *
 * The look (pages 3 and 4 of the spec; decision 0018) sets every colour, corner and face through CSS
 * variables (`themeStyle`), and arranges the same words its own way through a few treatments: the
 * hero (`theme.treatment.hero`), the band, the list of work and the band's button. Plain markup,
 * no hooks: the public page renders it on the server and the builder's live preview in the browser,
 * where `frame` wraps each section in its drag handle.
 *
 * The portfolio editor draws this same page (decision 0031, "The adapter"; decision 0026, "One page,
 * one renderer"): it passes `edit`, and each part asks `edit ? edit.text({ … }) : value`. Without
 * `edit` nothing here changes what a page draws.
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
  /** The top bar, the hero and the best-work band, with no anchors: a picture of the page (the builder's look previews). */
  thumbnail?: boolean;
  /**
   * The portfolio editor's slots (decision 0031, "The adapter"; types in ./home-ctx.ts). No public page
   * passes it, so the server draws exactly what it drew before; with it, each part asks the adapter for
   * its editing version.
   */
  edit?: HomeEdit;
};

export const WRAP = "mx-auto w-full max-w-[68rem] px-5 @3xl:px-10";
const H2 = "pf-display text-[1.75rem] leading-tight [letter-spacing:calc(var(--pf-tracking)*0.6)] @3xl:text-[2rem]";
export const ROWS = "pf-rows border-y border-[color:var(--pf-line)] [border-style:var(--pf-rule-style)]";
export const CARD = "border-[length:var(--pf-edge-width)] border-[color:var(--pf-edge)] bg-[var(--pf-card)]";

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

/* ---------------- The fields the editor types in ---------------- */

/**
 * Each field's path in the editor's state, its name read out and what it says while empty (decision
 * 0031, "Fields, and the path each one has"). The page draws `edit.text` or `edit.paras` where the
 * words sit; the links are not here (Get in touch's "Your links", `tools("contact")`).
 */
type Field = Pick<HomeTextSlot, "path" | "label" | "placeholder">;
const FIELD = {
  name: { path: "profile.name", label: "Your name", placeholder: "Your name" },
  headline: { path: "profile.headline", label: "One line about you", placeholder: "One line about you" },
  bio: { path: "profile.bio", label: "Your intro", placeholder: "A few lines about you, in your own words" },
  location: { path: "profile.location", label: "Where you're based", placeholder: "e.g. Leeds" },
  lookingFor: { path: "profile.lookingFor", label: "What you're looking for", placeholder: "e.g. graduate data roles" },
  about: { path: "arrangement.tiles.about.text", label: "About you", placeholder: "A few sentences about you" },
  tools: { path: "arrangement.tiles.education.tools", label: "Tools you use", placeholder: "e.g. Python, SQL, Power BI" },
  quote: { path: "arrangement.tiles.quote.text", label: "The quote, word for word", placeholder: "The quote, word for word" },
  quoteName: { path: "arrangement.tiles.quote.name", label: "Who said it", placeholder: "Who said it" },
  quoteRole: { path: "arrangement.tiles.quote.role", label: "Their role (optional)", placeholder: "Their role (optional)" },
} satisfies Record<string, Field>;

/** A line of education or experience: its two halves, each a field at the line's path (`joinYear` writes the line back). */
const LINE = {
  education: { label: (n: number) => `Course or qualification ${n}`, year: "Year", placeholder: "e.g. BSc Data Science, University of Leeds", yearPlaceholder: "e.g. 2026" },
  experience: { label: (n: number) => `Role ${n}`, year: "Years", placeholder: "e.g. Retail supervisor, Example Stores", yearPlaceholder: "e.g. 2023 to 2025" },
} as const;

export function PortfolioHome(props: HomeProps) {
  const { person, theme = DEFAULT_THEME, sections, mode = "public", frame, edit } = props;
  // Editing (decision 0031, "The adapter"): every section in `sections` is drawn, an empty one with its
  // heading and its fields (`Section`), never EmptySection's outline; the top bar and the footer are a
  // picture, as `inertChrome` makes them; the links inside the sections are inert (a click on a card
  // reaches the editor's frame); and the owner's places are asked for. The nav still follows what has
  // words, so the top bar is the visitor's.
  const shown = edit ? sections : sections.filter((k) => mode === "preview" || sectionHasContent(k, props));
  const has = (k: SectionKey) => shown.includes(k) && sectionHasContent(k, props);
  const nav = [
    (has("featured") || has("work")) && { href: has("featured") ? "#best-work" : "#work", label: "Work" },
    has("about") && { href: "#about", label: "About" },
  ].filter(Boolean) as { href: string; label: string }[];
  const paper = printStyle(theme);

  return (
    <div data-portfolio-home {...lookAttrs(theme)} style={themeStyle(theme)} className={`@container bg-[var(--pf-ground)] text-[color:var(--pf-ink)] ${mode === "public" && !props.thumbnail && !props.sectionsOnly ? "min-h-svh" : ""}`}>
      {paper && <style>{paper}</style>}
      {!props.sectionsOnly &&
        (edit ? (
          // The hero holds fields, so only the top bar is inert.
          <div>
            <TopBar username={person.username} nav={nav} contact={has("contact")} chip={theme.treatment.hero !== "terminal"} inert />
            <Hero {...props} theme={theme} />
          </div>
        ) : (
          <div inert={props.inertChrome || undefined}>
            <TopBar username={person.username} nav={nav} contact={has("contact")} chip={theme.treatment.hero !== "terminal"} />
            <Hero {...props} theme={theme} />
          </div>
        ))}
      {props.thumbnail
        ? featuredOf(props) && <Featured project={featuredOf(props)!} theme={theme} anchors={false} />
        : shown.map((key, index) => {
            const node = <Section key={key} sectionKey={key} {...props} theme={theme} />;
            if (edit) return <Fragment key={key}>{edit.section({ key, index, count: shown.length }, node)}</Fragment>;
            return frame ? <div key={key}>{frame(key, node)}</div> : node;
          })}
      {edit && !props.sectionsOnly && !props.thumbnail && !sections.includes("work") && edit.owner("page-end")}
      {!props.sectionsOnly && !props.thumbnail && (
        <footer inert={props.inertChrome || (edit ? true : undefined)} className={`${WRAP} pt-10 pb-12`}>
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

function TopBar({ username, nav, contact, chip, inert }: { username: string | null; nav: { href: string; label: string }[]; contact: boolean; chip: boolean; inert?: boolean }) {
  return (
    <nav aria-label="Portfolio" inert={inert || undefined} className={`${WRAP} flex flex-wrap items-center justify-between gap-3 pt-5 pb-2`}>
      {username && chip ? (
        <p className="rounded-[var(--pf-radius-button)] border border-[color:var(--pf-line)] px-3 py-1 text-[0.8125rem] text-[color:var(--pf-soft)]">{portfolioHost(username)}</p>
      ) : (
        <span />
      )}
      <ul className="flex items-center gap-1 text-[0.9375rem] font-medium">
        {nav.map((n) => (
          <li key={n.href}>
            <a href={n.href} className="rounded-[var(--pf-radius-button)] px-3 py-2 hover:bg-[var(--pf-well)]">
              {n.label}
            </a>
          </li>
        ))}
        {contact && (
          <li>
            <a
              href="#contact"
              className="ml-1 inline-flex rounded-[var(--pf-radius-button)] bg-[var(--pf-button-bg)] px-4 py-2 font-semibold text-[color:var(--pf-button-text)] hover:opacity-90"
            >
              Get in touch
            </a>
          </li>
        )}
      </ul>
    </nav>
  );
}

/* ---------------- The hero, in the look's arrangement ---------------- */

/** About how wide a face's letters run, in ems, at display size and tracking. */
const CHAR_EM: Record<FontKey, number> = { bricolage: 0.52, inter: 0.56, "inter-tight": 0.56, newsreader: 0.5, "jetbrains-mono": 0.6, "plex-sans": 0.55, nunito: 0.58 };

/**
 * Shrinks a very large name so its longest word fits its column instead of breaking mid-word:
 * `--fit` is 1 for most names and less for a long one ("Adebayo-Montgomery-Fitzwilliam" breaks
 * after its hyphens). `room` is how many ems of the face's letters the hero's column holds at full size.
 */
function nameFit(name: string, theme: PortfolioTheme, room: number): React.CSSProperties {
  const longest = Math.max(1, ...name.trim().split(/\s+/).flatMap((w) => w.split(/(?<=-)/)).map((w) => w.length));
  const em = CHAR_EM[theme.type.display] * (theme.type.displayWeight >= 800 ? 1.12 : 1);
  return { "--fit": Math.min(1, room / (longest * em)).toFixed(3) } as React.CSSProperties;
}

type HeroProps = HomeProps & { theme: PortfolioTheme };

function Hero(props: HeroProps) {
  switch (props.theme.treatment.hero) {
    case "portrait":
      return <PortraitHero {...props} />;
    case "greeting":
      return <PortraitHero {...props} greeting />;
    case "masthead":
      return <MastheadHero {...props} />;
    case "notes":
      return <NotesHero {...props} />;
    case "terminal":
      return <TerminalHero {...props} />;
    case "block":
      return <BlockHero {...props} />;
    case "ledger":
      return <LedgerHero {...props} />;
  }
}

/** The name, typed in where it sits while editing. */
const nameOf = ({ person, edit }: Pick<HomeProps, "person" | "edit">) => (edit ? edit.text({ ...FIELD.name, value: person.name, as: "block" }) : person.name);

/**
 * The headline under the name: a <p> with the hero's own classes. While editing it is always drawn,
 * its placeholder showing when it is empty.
 */
function Headline({ person, edit, className }: Pick<HomeProps, "person" | "edit"> & { className: string }) {
  if (edit) return <p className={className}>{edit.text({ ...FIELD.headline, value: person.headline ?? "", as: "block" })}</p>;
  return person.headline ? <p className={className}>{person.headline}</p> : null;
}

/** The photo, or the initials in the look's colours, in the look's shape. While editing, with the button that opens the photo sheet. */
function Face(props: { person: PortfolioPerson; theme: PortfolioTheme; className: string; initialsClass?: string; edit?: HomeEdit }) {
  const face = <FaceOnly {...props} />;
  return props.edit ? props.edit.photo(face) : face;
}

function FaceOnly({ person, theme, className, initialsClass = "" }: { person: PortfolioPerson; theme: PortfolioTheme; className: string; initialsClass?: string }) {
  const corners = theme.photo === "round" ? "rounded-full" : "rounded-[var(--pf-radius)]";
  if (person.photoUrl) return <img src={person.photoUrl} alt="" width={160} height={160} data-avatar="photo" className={`${className} ${corners} shrink-0 object-cover`} />;
  return (
    <span
      aria-hidden
      data-avatar="initials"
      className={`${className} ${corners} ${initialsClass} pf-display inline-flex shrink-0 items-center justify-center bg-[var(--pf-avatar)] !text-[color:var(--pf-avatar-ink)]`}
    >
      {initialsOf(person.name) || "?"}
    </span>
  );
}

const introOf = (person: PortfolioPerson) => (person.bio ?? "").split(/\n{2,}/).filter((p) => p.trim());

const INTRO = "pf-lead max-w-[38rem] text-[1.125rem] leading-relaxed text-[color:var(--pf-soft)] @3xl:text-[1.3rem]";

function Intro({ person, className = "", edit }: { person: PortfolioPerson; className?: string; edit?: HomeEdit }) {
  if (edit) {
    // Always drawn while editing. The paragraphs are the field's, so each carries the gap the page's
    // `space-y-3` gives it (a margin above all but the first); Suggest an intro sits over the corner.
    return (
      <div data-intro className={`${INTRO} relative ${className}`}>
        {edit.paras({ ...FIELD.bio, value: person.bio ?? "", paraClass: "mt-3 first:mt-0" })}
        {edit.tools("intro")}
      </div>
    );
  }
  const intro = introOf(person);
  if (intro.length === 0) return null;
  return (
    <div data-intro className={`pf-lead max-w-[38rem] space-y-3 text-[1.125rem] leading-relaxed text-[color:var(--pf-soft)] @3xl:text-[1.3rem] ${className}`}>
      {intro.map((p, i) => (
        <p key={i}>{p}</p>
      ))}
    </div>
  );
}

/** Where they are and what they're looking for, quietly, under the intro. */
function Meta({ person, className = "mt-5", edit }: { person: PortfolioPerson; className?: string; edit?: HomeEdit }) {
  if (edit) {
    // Both, always, each typed in where it sits. The field holds the words as stored; the visitor's
    // page prints "Looking for" with the first letter of the words lowered (`lowerFirst`).
    return (
      <p className={`flex flex-wrap items-center gap-x-5 gap-y-1 text-[0.95rem] text-[color:var(--pf-faint)] ${className}`}>
        <span className="inline-flex items-center gap-1.5">
          <MapPin aria-hidden size={15} strokeWidth={2} />
          <span className="sr-only">Based in </span>
          {edit.text({ ...FIELD.location, value: person.location ?? "", as: "inline" })}
        </span>
        <span data-looking-for>Looking for {edit.text({ ...FIELD.lookingFor, value: person.lookingFor ?? "", as: "inline" })}</span>
      </p>
    );
  }
  if (!person.location && !person.lookingFor) return null;
  return (
    <p className={`flex flex-wrap items-center gap-x-5 gap-y-1 text-[0.95rem] text-[color:var(--pf-faint)] ${className}`}>
      {person.location && (
        <span className="inline-flex items-center gap-1.5">
          <MapPin aria-hidden size={15} strokeWidth={2} />
          <span className="sr-only">Based in </span>
          {person.location}
        </span>
      )}
      {person.lookingFor && <span data-looking-for>Looking for {lowerFirst(person.lookingFor)}</span>}
    </p>
  );
}

/** Exhbt and Night (the photo beside "Hi, I'm" and the name very large), and Bloom's friendlier greeting. */
function PortraitHero({ person, theme, edit, greeting = false }: HeroProps & { greeting?: boolean }) {
  return (
    <header className={`${WRAP} grid items-center gap-x-12 gap-y-6 pt-10 pb-14 @3xl:grid-cols-[auto_minmax(0,1fr)] @3xl:pt-14 @3xl:pb-20`}>
      <div className={greeting ? "pf-ring w-fit rounded-full" : "w-fit"}>
        <Face person={person} theme={theme} edit={edit} className="size-28 @3xl:size-40 @5xl:size-44" initialsClass="text-[2.5rem] @3xl:text-[3.25rem]" />
      </div>
      <div className="min-w-0">
        <p className={greeting ? "text-[1.25rem] text-[color:var(--pf-soft)] @3xl:text-[1.5rem]" : "text-[1rem] text-[color:var(--pf-soft)]"}>Hi, I&rsquo;m</p>
        <h1
          style={nameFit(person.name, theme, greeting ? 8 : 5.5)}
          className={`pf-display mt-1 break-words ${
            greeting
              ? "text-[calc(clamp(2.75rem,8cqw,5.25rem)*var(--fit))] leading-[1]"
              : "text-[calc(clamp(3rem,11.5cqw,8.5rem)*var(--fit))] leading-[0.92] [letter-spacing:calc(var(--pf-tracking)-0.01em)]"
          }`}
        >
          {nameOf({ person, edit })}
        </h1>
        <Headline person={person} edit={edit} className="mt-4 text-[1.0625rem] font-medium" />
        <Intro person={person} edit={edit} className="mt-6" />
        <Meta person={person} edit={edit} />
      </div>
    </header>
  );
}

/** Classic: a rule over a serif name, the headline in the serif beneath, the photo square at the side. */
function MastheadHero({ person, theme, edit }: HeroProps) {
  return (
    <header className={`${WRAP} pt-10 pb-14 @3xl:pt-14 @3xl:pb-20`}>
      <div className="grid gap-x-12 gap-y-8 border-t-[3px] border-[color:var(--pf-rule)] pt-8 @3xl:grid-cols-[minmax(0,1fr)_auto] @3xl:pt-10">
        <div className="min-w-0">
          <h1 style={nameFit(person.name, theme, 7.5)} className="pf-display text-[calc(clamp(2.75rem,8.5cqw,6rem)*var(--fit))] leading-[1] break-words">
            {nameOf({ person, edit })}
          </h1>
          <Headline person={person} edit={edit} className="pf-lead mt-4 text-[1.375rem] leading-snug text-[color:var(--pf-soft)] @3xl:text-[1.625rem]" />
          <Intro person={person} edit={edit} className="mt-6 !text-[1.125rem] @3xl:!text-[1.25rem]" />
          <Meta person={person} edit={edit} className="mt-6" />
        </div>
        <Face person={person} theme={theme} edit={edit} className="order-first size-20 @3xl:order-none @3xl:size-44" initialsClass="text-[1.8rem] @3xl:text-[3.5rem]" />
      </div>
    </header>
  );
}

/**
 * Rows of facts under the name: what Notebook and Ledger show. Only the ones the person filled in;
 * while editing, where they are and what they're looking for always, as fields (the education line
 * stays words: it is typed in About).
 */
function factsOf({ person, tiles, projects, edit }: HeroProps): { label: string; value: React.ReactNode; figure?: string | null }[] {
  const education = (tiles.education?.lines ?? []).map((l) => l.trim()).filter(Boolean)[0];
  const skills = topSkills(projects, 4);
  return [
    edit
      ? { label: "Looking for", value: edit.text({ ...FIELD.lookingFor, value: person.lookingFor ?? "", as: "block" }) }
      : person.lookingFor && { label: "Looking for", value: upperFirst(person.lookingFor.trim().replace(/^looking for\s+/i, "")) },
    edit ? { label: "Based in", value: edit.text({ ...FIELD.location, value: person.location ?? "", as: "block" }) } : person.location && { label: "Based in", value: person.location },
    education && { label: "Education", value: splitYear(education).label, figure: splitYear(education).year },
    skills.length > 0 && {
      label: "Skills",
      value: (
        <span className="flex flex-wrap gap-1.5">
          {skills.map((s) => (
            <span key={s} className="rounded-[var(--pf-radius-pill)] border border-[color:var(--pf-pill-edge)] bg-[var(--pf-pill)] px-2 py-0.5 text-[0.9rem] text-[color:var(--pf-pill-ink)]">
              {s}
            </span>
          ))}
        </span>
      ),
    },
  ].filter(Boolean) as { label: string; value: React.ReactNode; figure?: string | null }[];
}

/** Notebook: a small photo like a page icon, the name, then property rows, then the intro, as a notes page. */
function NotesHero(props: HeroProps) {
  const { person, theme, edit } = props;
  const facts = factsOf(props);
  return (
    <header className={`${WRAP} pt-10 pb-12 @3xl:pt-16 @3xl:pb-16`}>
      <div className="max-w-[46rem]">
        <Face person={person} theme={theme} edit={edit} className="size-[4.5rem]" initialsClass="text-[1.6rem]" />
        <h1 style={nameFit(person.name, theme, 10)} className="pf-display mt-5 text-[calc(clamp(2.5rem,7cqw,4rem)*var(--fit))] leading-[1.02] break-words">
          {nameOf({ person, edit })}
        </h1>
        <Headline person={person} edit={edit} className="mt-2 text-[1.125rem] text-[color:var(--pf-soft)]" />
        {facts.length > 0 && (
          <dl className="mt-7 grid grid-cols-[minmax(6.5rem,auto)_minmax(0,1fr)] gap-x-6 gap-y-2.5 text-[1rem] @3xl:grid-cols-[9rem_minmax(0,1fr)]">
            {facts.map((f) => (
              <div key={f.label} className="contents">
                <dt className="pt-0.5 text-[color:var(--pf-faint)]">{f.label}</dt>
                <dd className="min-w-0">
                  {f.value}
                  {f.figure && <span className="text-[color:var(--pf-faint)]">, {f.figure}</span>}
                </dd>
              </div>
            ))}
          </dl>
        )}
        <Intro person={person} edit={edit} className="mt-8 border-t border-[color:var(--pf-line)] pt-7 !text-[1.0625rem] @3xl:!text-[1.125rem]" />
      </div>
    </header>
  );
}

/** Mono: the address as a path over the name, the skills in hairline boxes, the photo outlined. */
function TerminalHero(props: HeroProps) {
  const { person, theme, edit } = props;
  const skills = topSkills(props.projects, 5);
  const path = person.username ? `~/${person.username}` : `~/${person.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
  return (
    <header className={`${WRAP} pt-10 pb-14 @3xl:pt-14 @3xl:pb-16`}>
      <div className="grid gap-x-12 gap-y-8 @3xl:grid-cols-[minmax(0,1fr)_auto]">
        <div className="min-w-0">
          <p className="text-[0.95rem] text-[color:var(--pf-faint)]" aria-hidden={!person.username || undefined}>
            {person.username ? <span className="sr-only">Address: </span> : null}
            {path}
          </p>
          <h1 style={nameFit(person.name, theme, 9)} className="pf-display mt-4 text-[calc(clamp(2.25rem,7cqw,4.25rem)*var(--fit))] leading-[1.05] break-words">
            {nameOf({ person, edit })}
          </h1>
          <Headline person={person} edit={edit} className="mt-4 text-[1.0625rem] text-[color:var(--pf-soft)]" />
          <Intro person={person} edit={edit} className="mt-6 !text-[1rem] !leading-[1.75] @3xl:!text-[1.0625rem]" />
          <Meta person={person} edit={edit} className="mt-6" />
        </div>
        <Face person={person} theme={theme} edit={edit} className="order-first size-20 border border-[color:var(--pf-edge)] @3xl:order-none @3xl:size-32" initialsClass="text-[1.6rem] @3xl:text-[2rem]" />
      </div>
      {skills.length > 0 && (
        <ul aria-label="Skills" className="mt-10 flex flex-wrap gap-2.5 border-b border-dashed border-[color:var(--pf-line)] pb-6">
          {skills.map((s) => (
            <li key={s} className="border border-[color:var(--pf-pill-edge)] bg-[var(--pf-pill)] px-3 py-1 text-[0.9rem] text-[color:var(--pf-pill-ink)]">
              {s}
            </li>
          ))}
        </ul>
      )}
    </header>
  );
}

/** Studio: one loud block of the person's colour holding their photo or initials, the name very heavy beside it. */
function BlockHero({ person, theme, edit }: HeroProps) {
  const words = person.name.trim().split(/\s+/);
  const face = person.photoUrl ? (
    <img src={person.photoUrl} alt="" data-avatar="photo" className="size-28 border-2 border-[color:var(--band-text)] object-cover @3xl:size-44" />
  ) : (
    <span aria-hidden data-avatar="initials" className="pf-display text-[4.5rem] leading-none !text-[color:var(--band-text)] @3xl:text-[7rem]">
      {initialsOf(person.name) || "?"}
    </span>
  );
  return (
    <header className={`${WRAP} pt-6 pb-14 @3xl:pt-8 @3xl:pb-20`}>
      <div className="grid border-2 border-[color:var(--pf-edge)] @3xl:grid-cols-[minmax(13rem,0.4fr)_minmax(0,1fr)]">
        <div data-band-block className="relative flex min-h-40 items-end overflow-hidden bg-[var(--band-bg)] p-6 @3xl:min-h-[26rem] @3xl:p-8">
          {edit ? edit.photo(face) : face}
        </div>
        <div className="min-w-0 border-t-2 border-[color:var(--pf-edge)] p-6 @3xl:border-t-0 @3xl:border-l-2 @3xl:p-10">
          {/*
            One word per line. While editing, the name is one field (decision 0031's sixth difference), and a
            space as wide as the page breaks the line after every word, so the name keeps its lines and the
            hero its height as it is typed. (A field that is a <textarea> must take `word-spacing: inherit`.)
          */}
          {edit ? (
            <h1 style={nameFit(person.name, theme, 4.2)} className="pf-display text-[calc(clamp(3rem,10cqw,7.5rem)*var(--fit))] leading-[0.88] break-words [word-spacing:100cqw]">
              {nameOf({ person, edit })}
            </h1>
          ) : (
            <h1 style={nameFit(person.name, theme, 4.2)} className="pf-display text-[calc(clamp(3rem,10cqw,7.5rem)*var(--fit))] leading-[0.88] break-words">
              {words.map((w, i) => (
                <span key={i} className="block">
                  {w}
                </span>
              ))}
            </h1>
          )}
          <Headline person={person} edit={edit} className="mt-6 text-[1.125rem] font-semibold" />
          <Intro person={person} edit={edit} className="mt-4" />
          <Meta person={person} edit={edit} />
        </div>
      </div>
    </header>
  );
}

/** Ledger: the name in deep green, then ruled rows with their figures aligned on the right, closed by a double rule. */
function LedgerHero(props: HeroProps) {
  const { person, theme, projects, edit } = props;
  const education = (props.tiles.education?.lines ?? []).map((l) => l.trim()).filter(Boolean).slice(0, 3);
  // With no education, the rows say what they're looking for and where they are; while editing, always, as fields.
  const rows: { label: React.ReactNode; figure: React.ReactNode }[] = edit
    ? [
        ...education.map((l) => ({ label: splitYear(l).label, figure: splitYear(l).year })),
        ...(education.length === 0
          ? [
              { label: <>Looking for {edit.text({ ...FIELD.lookingFor, value: person.lookingFor ?? "", as: "inline" })}</>, figure: "" },
              { label: "Based in", figure: edit.text({ ...FIELD.location, value: person.location ?? "", as: "block" }) },
            ]
          : []),
      ]
    : [
        ...education.map((l) => ({ label: splitYear(l).label, figure: splitYear(l).year })),
        ...(education.length === 0 && person.lookingFor ? [{ label: `Looking for ${lowerFirst(person.lookingFor)}`, figure: "" }] : []),
        ...(education.length === 0 && person.location ? [{ label: "Based in", figure: person.location }] : []),
      ];
  return (
    <header className={`${WRAP} pt-10 pb-14 @3xl:pt-14 @3xl:pb-16`}>
      <div className="grid gap-x-12 gap-y-8 @3xl:grid-cols-[minmax(0,1fr)_auto]">
        <div className="min-w-0">
          <h1 style={nameFit(person.name, theme, 8.5)} className="pf-display text-[calc(clamp(2.75rem,8cqw,5.5rem)*var(--fit))] leading-[1] break-words">
            {nameOf({ person, edit })}
          </h1>
          <Headline person={person} edit={edit} className="mt-4 text-[1.25rem] text-[color:var(--pf-soft)]" />
          <Intro person={person} edit={edit} className="mt-5 !text-[1.0625rem] @3xl:!text-[1.1875rem]" />
          {education.length > 0 && <Meta person={person} edit={edit} />}
        </div>
        <Face person={person} theme={theme} edit={edit} className="order-first size-20 @3xl:order-none @3xl:size-32" initialsClass="text-[1.6rem] @3xl:text-[2rem]" />
      </div>
      <dl data-ledger className="pf-rows mt-10 border-t border-b-[3px] border-[color:var(--pf-rule)] [border-bottom-style:double] tabular-nums">
          {rows.map((r, i) => (
            <div key={i} className="flex items-baseline justify-between gap-6 py-3.5">
              <dt className="min-w-0">{r.label}</dt>
              <dd className="shrink-0 text-right text-[color:var(--pf-faint)]">{r.figure}</dd>
            </div>
          ))}
          <div className="flex items-baseline justify-between gap-6 py-3.5 font-semibold">
            <dt>Pieces of work</dt>
            <dd>{projects.length}</dd>
          </div>
      </dl>
    </header>
  );
}

/* ---------------- Sections ---------------- */

function Section(props: HomeProps & { sectionKey: SectionKey; theme: PortfolioTheme }) {
  const key = props.sectionKey;
  const { edit } = props;
  if (!edit && !sectionHasContent(key, props)) return <EmptySection sectionKey={key} />;
  switch (key) {
    case "featured": {
      const f = featuredOf(props);
      // Editing with no exhbt yet: the band is the owner's place (the vision).
      if (!f) return <Vision theme={props.theme} edit={edit!} />;
      const band = <Featured project={f} theme={props.theme} edit={edit} />;
      return edit ? edit.tile({ id: f.id, where: "band", index: 0, count: 1 }, band) : band;
    }
    case "work":
      return <Work projects={workProjects(props)} more={props.sections.includes("featured")} theme={props.theme} edit={edit} />;
    case "about":
      return edit ? <AboutEditing tiles={props.tiles} edit={edit} /> : <About tiles={props.tiles} />;
    case "experience":
      return (
        <section data-section="experience" aria-labelledby="experience-h" className={`${WRAP} py-12 @3xl:py-16`}>
          <h2 id="experience-h" className={H2}>
            Experience
          </h2>
          {edit ? (
            <LinesEditing kind="experience" lines={props.tiles.experience?.lines ?? []} edit={edit} className="mt-6 @3xl:max-w-[44rem]" />
          ) : (
            <Rows lines={props.tiles.experience?.lines ?? []} className="mt-6 @3xl:max-w-[44rem]" />
          )}
        </section>
      );
    case "quote": {
      if (edit) return <QuoteEditing quote={props.tiles.quote} edit={edit} />;
      const q = props.tiles.quote!;
      return (
        <section data-section="quote" aria-label="A quote" className={`${WRAP} py-12 @3xl:py-16`}>
          <figure className="max-w-[48rem] border-l-[3px] border-[color:var(--pf-tick)] pl-6">
            <blockquote className="pf-display text-[1.6rem] leading-snug [letter-spacing:-0.015em] @3xl:text-[2rem]">&ldquo;{q.text.trim()}&rdquo;</blockquote>
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
      return <Contact rows={contactRows(props.person, props.tiles)} edit={edit} />;
  }
}

/** The band's "See how I did it", in the look's way: the band's colours turned round, the main button, or an underlined link. */
function SeeHow({ href, cta, inert }: { href: string; cta: PortfolioTheme["treatment"]["cta"]; inert?: boolean }) {
  return (
    <Link href={href} inert={inert || undefined} className={bandButtonClass(cta)}>
      See how I did it
    </Link>
  );
}

/**
 * The classes of the band's button in a look (`treatment.cta`). Exported for the editor's vision
 * (`owner("band")`), whose "Add an exhbt" is the look's own button.
 */
export function bandButtonClass(cta: PortfolioTheme["treatment"]["cta"]): string {
  return cta === "link"
    ? "inline-flex items-center py-1 text-[1rem] font-semibold text-[color:var(--band-text)] underline decoration-[color:var(--band-accent)] decoration-[3px] underline-offset-[6px] hover:decoration-[color:var(--band-text)]"
    : cta === "action"
      ? "inline-flex items-center rounded-[var(--pf-radius-button)] bg-[var(--pf-action)] px-6 py-3 text-[0.95rem] font-semibold text-[color:var(--pf-action-ink)] hover:bg-[var(--pf-action-hover)]"
      : "inline-flex items-center rounded-[var(--pf-radius-button)] bg-[var(--band-text)] px-6 py-3 text-[0.95rem] font-semibold text-[color:var(--band-bg)] hover:opacity-90";
}

/** The band in the look's treatment (inset, ruled or bleed), around its content. */
function Band({ theme, ids, children }: { theme: PortfolioTheme; ids: { id?: string; "aria-labelledby"?: string }; children: React.ReactNode }) {
  const band = theme.treatment.band;
  if (band === "inset") {
    return (
      <section data-section="featured" {...ids} data-band className={`${WRAP} py-6 @3xl:py-8`}>
        <div className="rounded-[var(--pf-radius-lg)] border-[length:var(--pf-edge-width)] border-[color:var(--band-edge)] bg-[var(--band-bg)] text-[color:var(--band-text)]">{children}</div>
      </section>
    );
  }
  if (band === "ruled") {
    return (
      <section data-section="featured" {...ids} data-band className={`${WRAP} bg-[var(--band-bg)] text-[color:var(--band-text)]`}>
        <div className="border-t-2 border-b border-[color:var(--band-edge)]">{children}</div>
      </section>
    );
  }
  return (
    <section data-section="featured" {...ids} data-band className="bg-[var(--band-bg)] text-[color:var(--band-text)]">
      <div className={WRAP}>{children}</div>
    </section>
  );
}

/** The band's padding in each treatment. */
const bandPad = (band: PortfolioTheme["treatment"]["band"]) => (band === "inset" ? "p-6 @3xl:p-12" : band === "ruled" ? "py-12 @3xl:py-16" : "py-14 @3xl:py-20");

function Featured({ project: p, theme, anchors = true, edit }: { project: HomeProject; theme: PortfolioTheme; /** False in a picture of the page, which has no ids. */ anchors?: boolean; edit?: HomeEdit }) {
  const ids = anchors ? { id: "best-work", "aria-labelledby": "best-work-h" } : {};
  const band = theme.treatment.band;
  return (
    <Band theme={theme} ids={ids}>
      <div className={`grid items-center gap-x-12 gap-y-8 ${hasFigure(p.figure) ? "@3xl:grid-cols-2" : ""} ${bandPad(band)}`}>
        <div className="min-w-0">
          <p className="text-[0.8125rem] font-semibold text-[color:var(--band-accent)]">My best piece of work</p>
          <h2 id={anchors ? "best-work-h" : undefined} className="pf-display mt-3 text-[clamp(1.85rem,4.4cqw,2.75rem)] leading-[1.08] text-[color:var(--band-text)] [letter-spacing:calc(var(--pf-tracking)*0.75)]">
            {p.title}
          </h2>
          {p.summary && <p className="pf-lead mt-4 max-w-[34rem] text-[1.0625rem] leading-relaxed text-[color:var(--band-soft)]">{p.summary}</p>}
          <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-3">
            {p.href && <SeeHow href={p.href} cta={theme.treatment.cta} inert={Boolean(edit)} />}
            <p className="inline-flex items-center gap-1.5 text-[0.875rem] font-semibold text-[color:var(--band-accent)]">
              <CircleCheck aria-hidden size={16} strokeWidth={2.25} />
              {p.sourceAttached ? "Source attached and checked" : "Checked by exhbt"}
            </p>
          </div>
        </div>
        {hasFigure(p.figure) && (
          <div
            className={`min-w-0 rounded-[var(--pf-radius-lg)] border-[length:var(--pf-edge-width)] border-[color:var(--pf-edge)] bg-[var(--pf-figure)] p-5 text-[color:var(--pf-ink)] @3xl:p-7 ${band === "bleed" ? "shadow-pack" : ""}`}
          >
            <Figure project={p} large />
          </div>
        )}
      </div>
    </Band>
  );
}

/**
 * The band while editing with no exhbt yet (decision 0031, "The vision"): full size in the look's band,
 * "Your best project goes here", and the owner's part (`owner("band")`, the look's own button, "Add an
 * exhbt") where "See how I did it" sits.
 */
function Vision({ theme, edit }: { theme: PortfolioTheme; edit: HomeEdit }) {
  return (
    <Band theme={theme} ids={{ id: "best-work", "aria-labelledby": "best-work-h" }}>
      <div data-vision className={`grid items-center gap-x-12 gap-y-8 ${bandPad(theme.treatment.band)}`}>
        <div className="min-w-0">
          <p className="text-[0.8125rem] font-semibold text-[color:var(--band-accent)]">My best piece of work</p>
          <h2 id="best-work-h" className="pf-display mt-3 text-[clamp(1.85rem,4.4cqw,2.75rem)] leading-[1.08] text-[color:var(--band-text)] [letter-spacing:calc(var(--pf-tracking)*0.75)]">
            Your best project goes here
          </h2>
          <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-3">{edit.owner("band")}</div>
        </div>
      </div>
    </Band>
  );
}

/**
 * One row of the work in the list and index looks: what sits inside each `<li>` of the list. `n` is the
 * row's place in the list from 0 (the index look prints it as [01]). `inert` while editing: a click
 * reaches the editor's frame, not the link. Exported so the editor draws its owner-only rows (a draft,
 * a hidden exhbt) in the look's own row; it must draw for visitors exactly as it did inside `Work`.
 */
export function WorkRow({ project: p, n, look, inert }: { project: Pick<HomeProject, "title" | "summary" | "href">; n: number; look: "list" | "index"; inert?: boolean }) {
  const body = (
    <>
      {look === "index" ? (
        <span aria-hidden className="shrink-0 font-semibold text-[color:var(--pf-faint)] tabular-nums">
          [{String(n + 1).padStart(2, "0")}]
        </span>
      ) : (
        <ChevronRight aria-hidden size={18} strokeWidth={2} className="mt-[0.2em] shrink-0 text-[color:var(--pf-faint)]" />
      )}
      <span className="min-w-0">
        <span
          className={`block text-[1.125rem] leading-snug font-semibold ${p.href ? "underline decoration-[color:var(--pf-line)] decoration-2 underline-offset-[5px] group-hover:decoration-[color:var(--pf-ink)]" : ""}`}
        >
          {p.title}
        </span>
        {p.summary && <span className="mt-1 block text-[0.95rem] leading-relaxed text-[color:var(--pf-soft)]">{p.summary}</span>}
      </span>
    </>
  );
  return p.href ? (
    <Link href={p.href} inert={inert || undefined} className="group flex gap-3 py-4">
      {body}
    </Link>
  ) : (
    <div className="flex gap-3 py-4">{body}</div>
  );
}

function Work({ projects, more, theme, edit }: { projects: HomeProject[]; more: boolean; theme: PortfolioTheme; edit?: HomeEdit }) {
  const heading = (
    <h2 id="work-h" className={H2}>
      {more ? "More of my work" : "My work"}
    </h2>
  );
  // While editing, the owner's tiles follow the last one, inside the list (they are its items).
  const end = edit ? edit.owner("work-end") : null;
  if (theme.treatment.work !== "cards") {
    const index = theme.treatment.work === "index";
    const List = index ? "ol" : "ul";
    return (
      <section data-section="work" id="work" aria-labelledby="work-h" className={`${WRAP} py-12 @3xl:py-16`}>
        {heading}
        <List className={`mt-6 max-w-[48rem] ${ROWS}`}>
          {projects.map((p, i) => {
            const row = <WorkRow project={p} n={i} look={index ? "index" : "list"} inert={Boolean(edit)} />;
            return (
              <li key={p.id} data-card={p.id}>
                {edit ? edit.tile({ id: p.id, where: "row", index: i, count: projects.length }, row) : row}
              </li>
            );
          })}
          {end}
        </List>
      </section>
    );
  }
  return (
    <section data-section="work" id="work" aria-labelledby="work-h" className={`${WRAP} py-12 @3xl:py-16`}>
      {heading}
      <ul className="mt-6 grid gap-5 @2xl:grid-cols-2">
        {projects.map((p, i) => (
          <li key={p.id} data-card={p.id}>
            {edit ? edit.tile({ id: p.id, where: "card", index: i, count: projects.length }, <ProjectCard project={p} inert />) : <ProjectCard project={p} />}
          </li>
        ))}
        {end}
      </ul>
    </section>
  );
}

/**
 * One of the cards under "More of my work": the key figure on top, then the title and one sentence. Also drawn on a per-job page.
 * Memoised on the exhbt, which the loader gives and typing never changes, so a key typed in the editor draws no card again.
 * `inert` while editing: a click on the card reaches the editor's frame, not the link.
 */
export const ProjectCard = memo(function ProjectCard({ project: p, inert }: { project: HomeProject; inert?: boolean }) {
  const body = (
    <>
      {/* A graph sits on the look's figure ground (graphs never on a grey well, DESIGN.md); a picture or the steps on the well. */}
      {hasFigure(p.figure) && (
        <div
          className={`flex min-h-48 items-center justify-center border-b border-[color:var(--pf-line)] p-5 ${p.figure.kind === "chart" ? "bg-[var(--pf-figure)]" : "bg-[var(--pf-well)]"}`}
        >
          <Figure project={p} />
        </div>
      )}
      <div className="p-5">
        <h3 className="pf-display text-[1.125rem] leading-snug [letter-spacing:calc(var(--pf-tracking)*0.3)]">{p.title}</h3>
        {p.summary && <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-[color:var(--pf-soft)]">{p.summary}</p>}
      </div>
    </>
  );
  const card = `${CARD} flex h-full flex-col overflow-hidden rounded-[var(--pf-radius)] transition-[transform,border-color] duration-150`;
  return p.href ? (
    <Link href={p.href} inert={inert || undefined} className={`${card} hover:-translate-y-0.5 hover:border-[color:var(--pf-ink)] motion-reduce:hover:translate-y-0`}>
      {body}
    </Link>
  ) : (
    <div className={card}>{body}</div>
  );
});

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

/** About while editing: the heading, the words, every stored line of education (two fields each) and the tools line, empty or not. */
function AboutEditing({ tiles, edit }: { tiles: Tiles; edit: HomeEdit }) {
  return (
    <section data-section="about" id="about" aria-labelledby="about-h" className={`${WRAP} grid gap-x-12 gap-y-6 py-12 @3xl:grid-cols-2 @3xl:py-16`}>
      <div>
        <h2 id="about-h" className={H2}>
          About me
        </h2>
        {edit.paras({ ...FIELD.about, value: tiles.about?.text ?? "", paraClass: "mt-4 max-w-[34rem] text-[1.0625rem] leading-relaxed text-[color:var(--pf-soft)]" })}
      </div>
      <LinesEditing
        kind="education"
        lines={tiles.education?.lines ?? []}
        edit={edit}
        extra={{ label: "Tools", value: edit.text({ ...FIELD.tools, value: tiles.education?.tools ?? "", as: "block" }) }}
        className="@3xl:mt-2"
      />
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
              <dt className="min-w-0 font-semibold">{label}</dt>
              <dd className="shrink-0 text-[color:var(--pf-faint)] tabular-nums">{year}</dd>
            </div>
          );
        })}
      {extra && (
        <div className="flex items-baseline justify-between gap-6 py-3">
          <dt className="font-semibold">{extra.label}</dt>
          <dd className="min-w-0 text-right text-[color:var(--pf-faint)]">{extra.value}</dd>
        </div>
      )}
    </dl>
  );
}

/**
 * The rows while editing: every stored line, empty ones too, so a line's path is its place in the
 * stored list (`arrangement.tiles.education.lines.0` is the first), each as two fields at that path,
 * the words and the year; then the extra row. The controls over the list (`lineTools`) come right after
 * the </dl>, in a wrapper that takes the list's place and margins, so the list holds only its lines (a
 * <dl> may hold nothing else) and the Tab order reaches the controls right after the lines they act on.
 */
function LinesEditing({ kind, lines, edit, extra, className = "" }: { kind: "education" | "experience"; lines: string[]; edit: HomeEdit; extra?: { label: string; value: React.ReactNode }; className?: string }) {
  const path = `arrangement.tiles.${kind}.lines`;
  const words = LINE[kind];
  return (
    <div className={`relative ${className}`} data-lines-box={kind}>
      <dl className={`${ROWS} relative text-[0.95rem]`}>
        {lines.map((l, i) => {
          const { label, year } = splitYear(l);
          const at = `${path}.${i}`;
          return (
            <div key={i} className="flex items-baseline justify-between gap-6 py-3">
              <dt className="min-w-0 font-semibold">{edit.text({ path: at, value: label, label: words.label(i + 1), placeholder: words.placeholder, as: "block", part: "label" })}</dt>
              <dd className="shrink-0 text-[color:var(--pf-faint)] tabular-nums">{edit.text({ path: at, value: year ?? "", label: words.year, placeholder: words.yearPlaceholder, as: "block", part: "year" })}</dd>
            </div>
          );
        })}
        {extra && (
          <div className="flex items-baseline justify-between gap-6 py-3">
            <dt className="font-semibold">{extra.label}</dt>
            <dd className="min-w-0 text-right text-[color:var(--pf-faint)]">{extra.value}</dd>
          </div>
        )}
      </dl>
      {edit.lineTools({ path, kind, count: lines.length, max: TILE_LIMITS.lines })}
    </div>
  );
}

/** The quote while editing: its words between the look's marks, who said it and their role on one line, each typed in place. */
function QuoteEditing({ quote, edit }: { quote: Tiles["quote"]; edit: HomeEdit }) {
  const q = quote ?? { text: "", name: "", role: "" };
  return (
    <section data-section="quote" aria-label="A quote" className={`${WRAP} py-12 @3xl:py-16`}>
      <figure className="max-w-[48rem] border-l-[3px] border-[color:var(--pf-tick)] pl-6">
        <blockquote className="pf-display text-[1.6rem] leading-snug [letter-spacing:-0.015em] @3xl:text-[2rem]">&ldquo;{edit.text({ ...FIELD.quote, value: q.text, as: "inline" })}&rdquo;</blockquote>
        <figcaption className="mt-4 text-[color:var(--pf-soft)]">
          <span className="font-semibold text-[color:var(--pf-ink)]">{edit.text({ ...FIELD.quoteName, value: q.name, as: "inline" })}</span>
          {", "}
          {edit.text({ ...FIELD.quoteRole, value: q.role, as: "inline" })}
        </figcaption>
      </figure>
    </section>
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

/** Get in touch. While editing its links are inert and "Your links" sits over its corner (`tools("contact")`). */
function Contact({ rows, edit }: { rows: ContactRow[]; edit?: HomeEdit }) {
  return (
    <section
      data-section="contact"
      id="contact"
      aria-labelledby="contact-h"
      className={`${WRAP} ${edit ? "relative " : ""}grid gap-x-12 gap-y-6 py-12 @3xl:grid-cols-2 @3xl:py-16`}
    >
      <h2 id="contact-h" className={H2}>
        Get in touch
      </h2>
      <dl className={`${ROWS} text-[0.95rem]`} aria-label="Contact">
        {rows.map((r) => (
          <div key={r.label} className="flex items-baseline justify-between gap-6 py-3">
            <dt className="font-semibold">{r.label}</dt>
            <dd className="min-w-0 text-right break-all">
              {r.href ? (
                <a href={r.href} rel="noopener" target="_blank" inert={edit ? true : undefined} className="inline-flex items-center gap-1 text-[color:var(--pf-accent)] underline underline-offset-4">
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
      {edit?.tools("contact")}
    </section>
  );
}

/** A section with nothing in it yet, in the builder's preview only: what goes there. */
function EmptySection({ sectionKey }: { sectionKey: SectionKey }) {
  return (
    <section data-section={sectionKey} data-empty className={`${WRAP} py-8`}>
      <div className="rounded-[var(--pf-radius)] border border-dashed border-[color:var(--pf-faint)] px-5 py-8 text-center">
        <p className="font-semibold">{SECTION_NAMES[sectionKey]}</p>
        <p className="mt-1 text-[0.9375rem] text-[color:var(--pf-soft)]">{SECTION_HINTS[sectionKey]}. Empty, so visitors don&rsquo;t see it.</p>
      </div>
    </section>
  );
}

/**
 * Whether there is a figure to draw. An exhbt with no graph, no picture and its flowchart taken off
 * the page (decision 0027) has none: keyFigureOf gives a flowchart with no steps, and the card and
 * the band then leave the figure's well out rather than draw an empty grey box.
 */
const hasFigure = (f: KeyFigure) => f.kind !== "flow" || f.steps.length > 0;

/** The key figure: a graph as the exhbt page draws it, an image, or the steps of the process. Memoised on the exhbt, as the card is. */
const Figure = memo(function Figure({ project: p, large = false }: { project: HomeProject; large?: boolean }) {
  return <KeyFigureView figure={p.figure} imageUrl={p.imageUrl} large={large} />;
});

const KeyFigureView = memo(function KeyFigureView({ figure, imageUrl, large }: { figure: KeyFigure; imageUrl?: string | null; large: boolean }) {
  switch (figure.kind) {
    case "chart":
      return (
        <div className="@container w-full min-w-0" data-key-figure="chart">
          <Chart data={figure.chart} />
        </div>
      );
    case "image":
      return imageUrl ? (
        <img
          src={imageUrl}
          alt={figure.alt}
          data-key-figure="image"
          className={`w-full rounded-[max(0px,calc(var(--pf-radius)-6px))] object-contain ${large ? "max-h-[22rem]" : "max-h-56"}`}
        />
      ) : (
        <p className="text-[0.875rem] text-[color:var(--pf-soft)]">{figure.alt}</p>
      );
    case "flow":
      return (
        <ol aria-label="Process" data-key-figure="flow" className="flex w-full flex-col gap-1.5 text-[0.875rem]">
          {figure.steps.map((s, i) => (
            <li
              key={`${i}-${s}`}
              className={`rounded-[var(--pf-radius-box)] border-[length:var(--pf-edge-width)] px-3 py-2 font-medium ${
                i === figure.steps.length - 1
                  ? "border-[color:var(--pf-flow-end)] bg-[var(--pf-flow-end)] text-[color:var(--pf-flow-end-ink)]"
                  : "border-[color:var(--pf-edge)] bg-[var(--pf-card)]"
              }`}
            >
              {s}
            </li>
          ))}
        </ol>
      );
  }
});

/** "Graduate data roles" reads on after "Looking for"; a name or acronym ("NHS data roles") keeps its capital. */
function lowerFirst(s: string): string {
  const t = s.trim().replace(/^looking for\s+/i, "");
  return /^[A-Z][a-z]/.test(t) ? t.charAt(0).toLowerCase() + t.slice(1) : t;
}

const upperFirst = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
