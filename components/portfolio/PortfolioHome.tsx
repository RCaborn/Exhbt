/* eslint-disable @next/next/no-img-element -- signed Storage URLs change hourly; next/image would cache the wrong one. */
import Link from "next/link";
import { ArrowUpRight, ChevronRight, CircleCheck, MapPin } from "lucide-react";
import { Chart } from "@/components/charts/Chart";
import { Logo } from "@/components/brand/Logo";
import type { PortfolioPerson } from "@/components/portfolio/PortfolioPage";
import { portfolioHost } from "@/lib/hosts";
import { topSkills, type HomeProject, type KeyFigure } from "@/lib/portfolio-home";
import { SECTION_HINTS, SECTION_NAMES, splitYear, type SectionKey, type Tiles } from "@/lib/portfolio-layout";
import { initialsOf } from "@/lib/portfolio-profile";
import { DEFAULT_THEME, type FontKey, type PortfolioTheme } from "@/lib/portfolio-themes";
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
};

const WRAP = "mx-auto w-full max-w-[68rem] px-5 @3xl:px-10";
const H2 = "pf-display text-[1.75rem] leading-tight [letter-spacing:calc(var(--pf-tracking)*0.6)] @3xl:text-[2rem]";
const ROWS = "pf-rows border-y border-[color:var(--pf-line)] [border-style:var(--pf-rule-style)]";
const CARD = "border-[length:var(--pf-edge-width)] border-[color:var(--pf-edge)] bg-[var(--pf-card)]";

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
  const paper = printStyle(theme);

  return (
    <div data-portfolio-home {...lookAttrs(theme)} style={themeStyle(theme)} className={`@container bg-[var(--pf-ground)] text-[color:var(--pf-ink)] ${mode === "public" && !props.thumbnail && !props.sectionsOnly ? "min-h-svh" : ""}`}>
      {paper && <style>{paper}</style>}
      {!props.sectionsOnly && (
        <div inert={props.inertChrome || undefined}>
          <TopBar username={person.username} nav={nav} contact={has("contact")} chip={theme.treatment.hero !== "terminal"} />
          <Hero {...props} theme={theme} />
        </div>
      )}
      {props.thumbnail
        ? featuredOf(props) && <Featured project={featuredOf(props)!} theme={theme} anchors={false} />
        : shown.map((key) => {
            const node = <Section key={key} sectionKey={key} {...props} theme={theme} />;
            return frame ? <div key={key}>{frame(key, node)}</div> : node;
          })}
      {!props.sectionsOnly && !props.thumbnail && (
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

function TopBar({ username, nav, contact, chip }: { username: string | null; nav: { href: string; label: string }[]; contact: boolean; chip: boolean }) {
  return (
    <nav aria-label="Portfolio" className={`${WRAP} flex flex-wrap items-center justify-between gap-3 pt-5 pb-2`}>
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

/** The photo, or the initials in the look's colours, in the look's shape. */
function Face({ person, theme, className, initialsClass = "" }: { person: PortfolioPerson; theme: PortfolioTheme; className: string; initialsClass?: string }) {
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

function Intro({ person, className = "" }: { person: PortfolioPerson; className?: string }) {
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
function Meta({ person, className = "mt-5" }: { person: PortfolioPerson; className?: string }) {
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
function PortraitHero({ person, theme, greeting = false }: HeroProps & { greeting?: boolean }) {
  return (
    <header className={`${WRAP} grid items-center gap-x-12 gap-y-6 pt-10 pb-14 @3xl:grid-cols-[auto_minmax(0,1fr)] @3xl:pt-14 @3xl:pb-20`}>
      <div className={greeting ? "pf-ring w-fit rounded-full" : "w-fit"}>
        <Face person={person} theme={theme} className="size-28 @3xl:size-40 @5xl:size-44" initialsClass="text-[2.5rem] @3xl:text-[3.25rem]" />
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
          {person.name}
        </h1>
        {person.headline && <p className="mt-4 text-[1.0625rem] font-medium">{person.headline}</p>}
        <Intro person={person} className="mt-6" />
        <Meta person={person} />
      </div>
    </header>
  );
}

/** Classic: a rule over a serif name, the headline in the serif beneath, the photo square at the side. */
function MastheadHero({ person, theme }: HeroProps) {
  return (
    <header className={`${WRAP} pt-10 pb-14 @3xl:pt-14 @3xl:pb-20`}>
      <div className="grid gap-x-12 gap-y-8 border-t-[3px] border-[color:var(--pf-rule)] pt-8 @3xl:grid-cols-[minmax(0,1fr)_auto] @3xl:pt-10">
        <div className="min-w-0">
          <h1 style={nameFit(person.name, theme, 7.5)} className="pf-display text-[calc(clamp(2.75rem,8.5cqw,6rem)*var(--fit))] leading-[1] break-words">
            {person.name}
          </h1>
          {person.headline && <p className="pf-lead mt-4 text-[1.375rem] leading-snug text-[color:var(--pf-soft)] @3xl:text-[1.625rem]">{person.headline}</p>}
          <Intro person={person} className="mt-6 !text-[1.125rem] @3xl:!text-[1.25rem]" />
          <Meta person={person} className="mt-6" />
        </div>
        <Face person={person} theme={theme} className="order-first size-20 @3xl:order-none @3xl:size-44" initialsClass="text-[1.8rem] @3xl:text-[3.5rem]" />
      </div>
    </header>
  );
}

/** Rows of facts under the name: what Notebook and Ledger show. Only the ones the person filled in. */
function factsOf({ person, tiles, projects }: HeroProps): { label: string; value: React.ReactNode; figure?: string | null }[] {
  const education = (tiles.education?.lines ?? []).map((l) => l.trim()).filter(Boolean)[0];
  const skills = topSkills(projects, 4);
  return [
    person.lookingFor && { label: "Looking for", value: upperFirst(person.lookingFor.trim().replace(/^looking for\s+/i, "")) },
    person.location && { label: "Based in", value: person.location },
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
  const { person, theme } = props;
  const facts = factsOf(props);
  return (
    <header className={`${WRAP} pt-10 pb-12 @3xl:pt-16 @3xl:pb-16`}>
      <div className="max-w-[46rem]">
        <Face person={person} theme={theme} className="size-[4.5rem]" initialsClass="text-[1.6rem]" />
        <h1 style={nameFit(person.name, theme, 10)} className="pf-display mt-5 text-[calc(clamp(2.5rem,7cqw,4rem)*var(--fit))] leading-[1.02] break-words">
          {person.name}
        </h1>
        {person.headline && <p className="mt-2 text-[1.125rem] text-[color:var(--pf-soft)]">{person.headline}</p>}
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
        <Intro person={person} className="mt-8 border-t border-[color:var(--pf-line)] pt-7 !text-[1.0625rem] @3xl:!text-[1.125rem]" />
      </div>
    </header>
  );
}

/** Mono: the address as a path over the name, the skills in hairline boxes, the photo outlined. */
function TerminalHero(props: HeroProps) {
  const { person, theme } = props;
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
            {person.name}
          </h1>
          {person.headline && <p className="mt-4 text-[1.0625rem] text-[color:var(--pf-soft)]">{person.headline}</p>}
          <Intro person={person} className="mt-6 !text-[1rem] !leading-[1.75] @3xl:!text-[1.0625rem]" />
          <Meta person={person} className="mt-6" />
        </div>
        <Face person={person} theme={theme} className="order-first size-20 border border-[color:var(--pf-edge)] @3xl:order-none @3xl:size-32" initialsClass="text-[1.6rem] @3xl:text-[2rem]" />
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
function BlockHero({ person, theme }: HeroProps) {
  const words = person.name.trim().split(/\s+/);
  return (
    <header className={`${WRAP} pt-6 pb-14 @3xl:pt-8 @3xl:pb-20`}>
      <div className="grid border-2 border-[color:var(--pf-edge)] @3xl:grid-cols-[minmax(13rem,0.4fr)_minmax(0,1fr)]">
        <div data-band-block className="relative flex min-h-40 items-end overflow-hidden bg-[var(--band-bg)] p-6 @3xl:min-h-[26rem] @3xl:p-8">
          {person.photoUrl ? (
            <img src={person.photoUrl} alt="" data-avatar="photo" className="size-28 border-2 border-[color:var(--band-text)] object-cover @3xl:size-44" />
          ) : (
            <span aria-hidden data-avatar="initials" className="pf-display text-[4.5rem] leading-none !text-[color:var(--band-text)] @3xl:text-[7rem]">
              {initialsOf(person.name) || "?"}
            </span>
          )}
        </div>
        <div className="min-w-0 border-t-2 border-[color:var(--pf-edge)] p-6 @3xl:border-t-0 @3xl:border-l-2 @3xl:p-10">
          <h1 style={nameFit(person.name, theme, 4.2)} className="pf-display text-[calc(clamp(3rem,10cqw,7.5rem)*var(--fit))] leading-[0.88] break-words">
            {words.map((w, i) => (
              <span key={i} className="block">
                {w}
              </span>
            ))}
          </h1>
          {person.headline && <p className="mt-6 text-[1.125rem] font-semibold">{person.headline}</p>}
          <Intro person={person} className="mt-4" />
          <Meta person={person} />
        </div>
      </div>
    </header>
  );
}

/** Ledger: the name in deep green, then ruled rows with their figures aligned on the right, closed by a double rule. */
function LedgerHero(props: HeroProps) {
  const { person, theme, projects } = props;
  const education = (props.tiles.education?.lines ?? []).map((l) => l.trim()).filter(Boolean).slice(0, 3);
  const rows: { label: string; figure: string | null }[] = [
    ...education.map((l) => ({ label: splitYear(l).label, figure: splitYear(l).year })),
    ...(education.length === 0 && person.lookingFor ? [{ label: `Looking for ${lowerFirst(person.lookingFor)}`, figure: "" }] : []),
    ...(education.length === 0 && person.location ? [{ label: "Based in", figure: person.location }] : []),
  ];
  return (
    <header className={`${WRAP} pt-10 pb-14 @3xl:pt-14 @3xl:pb-16`}>
      <div className="grid gap-x-12 gap-y-8 @3xl:grid-cols-[minmax(0,1fr)_auto]">
        <div className="min-w-0">
          <h1 style={nameFit(person.name, theme, 8.5)} className="pf-display text-[calc(clamp(2.75rem,8cqw,5.5rem)*var(--fit))] leading-[1] break-words">
            {person.name}
          </h1>
          {person.headline && <p className="mt-4 text-[1.25rem] text-[color:var(--pf-soft)]">{person.headline}</p>}
          <Intro person={person} className="mt-5 !text-[1.0625rem] @3xl:!text-[1.1875rem]" />
          {education.length > 0 && <Meta person={person} />}
        </div>
        <Face person={person} theme={theme} className="order-first size-20 @3xl:order-none @3xl:size-32" initialsClass="text-[1.6rem] @3xl:text-[2rem]" />
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
  if (!sectionHasContent(key, props)) return <EmptySection sectionKey={key} />;
  switch (key) {
    case "featured":
      return <Featured project={featuredOf(props)!} theme={props.theme} />;
    case "work":
      return <Work projects={workProjects(props)} more={props.sections.includes("featured")} theme={props.theme} />;
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
      return <Contact rows={contactRows(props.person, props.tiles)} />;
  }
}

/** The band's "See how I did it", in the look's way: the band's colours turned round, the main button, or an underlined link. */
function SeeHow({ href, cta }: { href: string; cta: PortfolioTheme["treatment"]["cta"] }) {
  const cls =
    cta === "link"
      ? "inline-flex items-center py-1 text-[1rem] font-semibold text-[color:var(--band-text)] underline decoration-[color:var(--band-accent)] decoration-[3px] underline-offset-[6px] hover:decoration-[color:var(--band-text)]"
      : cta === "action"
        ? "inline-flex items-center rounded-[var(--pf-radius-button)] bg-[var(--pf-action)] px-6 py-3 text-[0.95rem] font-semibold text-[color:var(--pf-action-ink)] hover:bg-[var(--pf-action-hover)]"
        : "inline-flex items-center rounded-[var(--pf-radius-button)] bg-[var(--band-text)] px-6 py-3 text-[0.95rem] font-semibold text-[color:var(--band-bg)] hover:opacity-90";
  return (
    <Link href={href} className={cls}>
      See how I did it
    </Link>
  );
}

function Featured({ project: p, theme, anchors = true }: { project: HomeProject; theme: PortfolioTheme; /** False in a picture of the page, which has no ids. */ anchors?: boolean }) {
  const ids = anchors ? { id: "best-work", "aria-labelledby": "best-work-h" } : {};
  const band = theme.treatment.band;
  const inner = (
    <div className={`grid items-center gap-x-12 gap-y-8 ${hasFigure(p.figure) ? "@3xl:grid-cols-2" : ""} ${band === "inset" ? "p-6 @3xl:p-12" : band === "ruled" ? "py-12 @3xl:py-16" : "py-14 @3xl:py-20"}`}>
      <div className="min-w-0">
        <p className="text-[0.8125rem] font-semibold text-[color:var(--band-accent)]">My best piece of work</p>
        <h2 id={anchors ? "best-work-h" : undefined} className="pf-display mt-3 text-[clamp(1.85rem,4.4cqw,2.75rem)] leading-[1.08] text-[color:var(--band-text)] [letter-spacing:calc(var(--pf-tracking)*0.75)]">
          {p.title}
        </h2>
        {p.summary && <p className="pf-lead mt-4 max-w-[34rem] text-[1.0625rem] leading-relaxed text-[color:var(--band-soft)]">{p.summary}</p>}
        <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-3">
          {p.href && <SeeHow href={p.href} cta={theme.treatment.cta} />}
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
  );
  if (band === "inset") {
    return (
      <section data-section="featured" {...ids} data-band className={`${WRAP} py-6 @3xl:py-8`}>
        <div className="rounded-[var(--pf-radius-lg)] border-[length:var(--pf-edge-width)] border-[color:var(--band-edge)] bg-[var(--band-bg)] text-[color:var(--band-text)]">{inner}</div>
      </section>
    );
  }
  if (band === "ruled") {
    return (
      <section data-section="featured" {...ids} data-band className={`${WRAP} bg-[var(--band-bg)] text-[color:var(--band-text)]`}>
        <div className="border-t-2 border-b border-[color:var(--band-edge)]">{inner}</div>
      </section>
    );
  }
  return (
    <section data-section="featured" {...ids} data-band className="bg-[var(--band-bg)] text-[color:var(--band-text)]">
      <div className={WRAP}>{inner}</div>
    </section>
  );
}

function Work({ projects, more, theme }: { projects: HomeProject[]; more: boolean; theme: PortfolioTheme }) {
  const heading = (
    <h2 id="work-h" className={H2}>
      {more ? "More of my work" : "My work"}
    </h2>
  );
  if (theme.treatment.work !== "cards") {
    const index = theme.treatment.work === "index";
    const List = index ? "ol" : "ul";
    return (
      <section data-section="work" id="work" aria-labelledby="work-h" className={`${WRAP} py-12 @3xl:py-16`}>
        {heading}
        <List className={`mt-6 max-w-[48rem] ${ROWS}`}>
          {projects.map((p, i) => {
            const body = (
              <>
                {index ? (
                  <span aria-hidden className="shrink-0 font-semibold text-[color:var(--pf-faint)] tabular-nums">
                    [{String(i + 1).padStart(2, "0")}]
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
            return (
              <li key={p.id} data-card={p.id}>
                {p.href ? (
                  <Link href={p.href} className="group flex gap-3 py-4">
                    {body}
                  </Link>
                ) : (
                  <div className="flex gap-3 py-4">{body}</div>
                )}
              </li>
            );
          })}
        </List>
      </section>
    );
  }
  return (
    <section data-section="work" id="work" aria-labelledby="work-h" className={`${WRAP} py-12 @3xl:py-16`}>
      {heading}
      <ul className="mt-6 grid gap-5 @2xl:grid-cols-2">
        {projects.map((p) => (
          <li key={p.id} data-card={p.id}>
            <ProjectCard project={p} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/** One of the cards under "More of my work": the key figure on top, then the title and one sentence. Also drawn on a per-job page. */
export function ProjectCard({ project: p }: { project: HomeProject }) {
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
    <Link href={p.href} className={`${card} hover:-translate-y-0.5 hover:border-[color:var(--pf-ink)] motion-reduce:hover:translate-y-0`}>
      {body}
    </Link>
  ) : (
    <div className={card}>{body}</div>
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
            <dt className="font-semibold">{r.label}</dt>
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
}

/** "Graduate data roles" reads on after "Looking for"; a name or acronym ("NHS data roles") keeps its capital. */
function lowerFirst(s: string): string {
  const t = s.trim().replace(/^looking for\s+/i, "");
  return /^[A-Z][a-z]/.test(t) ? t.charAt(0).toLowerCase() + t.slice(1) : t;
}

const upperFirst = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
