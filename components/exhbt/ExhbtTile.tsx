import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Seal } from "@/components/brand/Seal";
import { catalogueNo, type ExhbtData } from "@/lib/exhbt";

/** What a tile needs. The demo's ExhbtData fits; a real exhbt is mapped by tileFromDoc (lib/exhbt/headline.ts). */
export type TileExhbt = Pick<ExhbtData, "title" | "context" | "methodology" | "skills"> & {
  /** Optional on real exhbts: without one, the methodology strip carries the tile. */
  headline?: ExhbtData["headline"] | null;
};

/**
 * Compact portfolio tile: what an employer scans before opening an exhbt.
 * One big result number, the methodology as a single strip, skills as boxes, and
 * the exhbt seal. `position` (1-based) gives its catalogue number. The whole tile
 * links to the full exhbt.
 */
export function ExhbtTile({
  exhbt: e,
  href,
  position,
  maxSkills = 4,
  headingLevel = "h3",
}: {
  exhbt: TileExhbt;
  href: string;
  position: number;
  maxSkills?: number;
  headingLevel?: "h2" | "h3";
}) {
  const extra = e.skills.length - maxSkills;
  const H = headingLevel;
  return (
    <Link
      href={href}
      className="group flex h-full flex-col rounded-[16px] border border-line bg-surface p-5 shadow-pack transition-[transform,border-color] duration-150 hover:-translate-y-0.5 hover:border-jade sm:p-6"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-[0.8125rem] font-semibold" data-catalogue>{catalogueNo(position)}</span>
        <span className="flex items-center gap-2.5">
          <Seal asLink={false} compact />
          <ArrowUpRight aria-hidden size={18} strokeWidth={2} className="text-slate group-hover:text-ink" />
        </span>
      </div>
      {e.context && <p className="mt-3 font-mono text-[0.8125rem] text-slate">{e.context}</p>}
      <H className="mt-1 text-[1.2rem] leading-snug font-bold tracking-[-0.015em]">{e.title}</H>

      {e.headline && (
        <p className="mt-4 flex flex-wrap items-baseline gap-x-2 gap-y-1" data-headline>
          <span className="font-[family-name:var(--font-display)] text-[2.4rem] leading-none font-semibold tracking-[-0.03em] tabular-nums">
            {e.headline.value}
          </span>
          <span className="text-sm text-graphite">{e.headline.label}</span>
        </p>
      )}

      {/* Methodology strip: step names only; details live in the full exhbt. Without a number it sits higher and reads larger. */}
      <ol className={`flex flex-wrap items-center gap-1 ${e.headline ? "mt-4" : "mt-5"}`} aria-label="Methodology">
        {e.methodology.map((m, i) => {
          const last = i === e.methodology.length - 1;
          return (
            <li key={`${i}-${m.step}`} className="flex items-center gap-1">
              <span
                className={`rounded-[6px] px-2 py-0.5 font-mono ${e.headline ? "text-[0.7rem]" : "text-[0.8125rem]"} ${
                  last ? "bg-ink text-white" : "border border-line bg-mist text-ink"
                }`}
              >
                {m.step}
              </span>
              {!last && (
                <span aria-hidden className="font-mono text-[0.7rem] text-field">
                  →
                </span>
              )}
            </li>
          );
        })}
      </ol>

      <div className="mt-auto pt-5">
        <ul className="flex flex-wrap gap-1" aria-label="Skills">
          {e.skills.slice(0, maxSkills).map((s) => (
            <li key={s} className="rounded-[6px] border border-line px-1.5 py-0.5 font-mono text-[0.75rem] text-graphite">
              {s}
            </li>
          ))}
          {extra > 0 && <li className="px-1 py-0.5 font-mono text-[0.75rem] text-slate">+{extra}</li>}
        </ul>
      </div>
    </Link>
  );
}
