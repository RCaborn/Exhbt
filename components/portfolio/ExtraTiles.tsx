import { ArrowUpRight } from "lucide-react";
import { TILE_NAMES, type TileKind, type Tiles } from "@/lib/portfolio-layout";

/**
 * The extra tiles on a portfolio's at-a-glance page (decision 0014): About me, Education,
 * Experience, a featured quote, and Links and contact. They share the project tile's card (white,
 * a `line` edge, the shadow token) but are plain text: nothing here is a link to another page, and
 * the email is shown as text, never a mailto. Every address was checked as https when it was saved
 * (lib/portfolio-layout.ts); links are checked again here so a stored value can't reach a page unchecked.
 *
 * The customiser draws these same components inside its preview, so what a person sees is what is
 * published.
 */

const CARD = "flex h-full flex-col rounded-[16px] border border-line bg-surface p-5 shadow-pack sm:p-6";

function Heading({ children }: { children: React.ReactNode }) {
  return <h3 className="text-[1.2rem] leading-snug font-bold tracking-[-0.015em]">{children}</h3>;
}

/** The host and path without the scheme: "github.com/amara". */
const shown = (href: string) => href.replace(/^https:\/\/(www\.)?/, "").replace(/\/$/, "");

function ExternalLink({ href }: { href: string }) {
  if (!href.startsWith("https://")) return null;
  return (
    <a href={href} rel="noopener" target="_blank" className="link inline-flex items-center gap-1 break-all">
      {shown(href)} <ArrowUpRight aria-hidden size={14} strokeWidth={2.25} className="shrink-0" />
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  );
}

export function ExtraTile({ kind, tiles, className = "" }: { kind: TileKind; tiles: Tiles; className?: string }) {
  switch (kind) {
    case "about":
      return (
        <div data-tile="about" className={`${CARD} ${className}`}>
          <Heading>{TILE_NAMES.about}</Heading>
          <p className="mt-3 leading-relaxed">{tiles.about?.text}</p>
        </div>
      );
    case "education":
    case "experience": {
      const lines = (tiles[kind]?.lines ?? []).filter((l) => l.trim());
      return (
        <div data-tile={kind} className={`${CARD} ${className}`}>
          <Heading>{TILE_NAMES[kind]}</Heading>
          <ul className="mt-3 space-y-2">
            {lines.map((l, i) => (
              <li key={i} className="flex gap-2.5 leading-snug">
                <span aria-hidden className="mt-[0.55em] size-1.5 shrink-0 rounded-full bg-jade" />
                <span>{l}</span>
              </li>
            ))}
          </ul>
        </div>
      );
    }
    case "quote": {
      const q = tiles.quote;
      return (
        <figure aria-label={TILE_NAMES.quote} data-tile="quote" className={`${CARD} justify-between ${className}`}>
          <blockquote className="font-[family-name:var(--font-display)] text-[1.3rem] leading-snug font-semibold tracking-[-0.02em]">
            &ldquo;{q?.text}&rdquo;
          </blockquote>
          {(q?.name || q?.role) && (
            <figcaption className="mt-4 text-sm text-graphite">
              {q?.name && <span className="font-semibold text-ink">{q.name}</span>}
              {q?.name && q?.role && ", "}
              {q?.role}
            </figcaption>
          )}
        </figure>
      );
    }
    case "links": {
      const l = tiles.links;
      const rows = [
        l?.linkedin && { label: "LinkedIn", node: <ExternalLink href={l.linkedin} /> },
        l?.github && { label: "GitHub", node: <ExternalLink href={l.github} /> },
        l?.website && { label: "Website", node: <ExternalLink href={l.website} /> },
        // Text, not a link: a mailto gives the address to every scraper.
        l?.email && { label: "Email", node: <span className="break-all">{l.email}</span> },
      ].filter(Boolean) as { label: string; node: React.ReactNode }[];
      return (
        <div data-tile="links" className={`${CARD} ${className}`}>
          <Heading>{TILE_NAMES.links}</Heading>
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
            {rows.map((r) => (
              <div key={r.label} className="contents">
                <dt className="font-mono text-[0.8125rem] leading-6 text-slate">{r.label}</dt>
                <dd className="min-w-0">{r.node}</dd>
              </div>
            ))}
          </dl>
        </div>
      );
    }
  }
}
