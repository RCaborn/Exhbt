import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Seal } from "@/components/brand/Seal";
import { catalogueNo, type ExhbtData } from "@/lib/exhbt";

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
}: {
  exhbt: ExhbtData;
  href: string;
  position: number;
  maxSkills?: number;
}) {
  const extra = e.skills.length - maxSkills;
  return (
    <Link
      href={href}
      className="group flex h-full flex-col rounded-[16px] border border-line bg-surface p-5 shadow-pack transition-[transform,border-color] duration-150 hover:-translate-y-0.5 hover:border-jade sm:p-6"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-[0.78rem] font-semibold" data-catalogue>{catalogueNo(position)}</span>
        <span className="flex items-center gap-2.5">
          <Seal asLink={false} compact />
          <ArrowUpRight aria-hidden size={18} strokeWidth={2} className="text-slate group-hover:text-ink" />
        </span>
      </div>
      <p className="mt-3 font-mono text-[0.72rem] text-slate">{e.context}</p>
      <h3 className="mt-1 text-[1.2rem] leading-snug font-bold tracking-[-0.015em]">{e.title}</h3>

      <p className="mt-4 flex items-baseline gap-2">
        <span className="text-[2.4rem] leading-none font-extrabold tracking-[-0.03em]">{e.headline.value}</span>
        <span className="text-sm text-graphite">{e.headline.label}</span>
      </p>

      {/* Methodology strip: step names only; details live in the full exhbt. */}
      <ol className="mt-4 flex flex-wrap items-center gap-1" aria-label="Methodology">
        {e.methodology.map((m, i) => {
          const last = i === e.methodology.length - 1;
          return (
            <li key={`${i}-${m.step}`} className="flex items-center gap-1">
              <span
                className={`rounded-[6px] px-2 py-0.5 font-mono text-[0.7rem] ${
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
            <li key={s} className="rounded-[6px] border border-line px-1.5 py-0.5 font-mono text-[0.7rem] text-graphite">
              {s}
            </li>
          ))}
          {extra > 0 && <li className="px-1 py-0.5 font-mono text-[0.7rem] text-slate">+{extra}</li>}
        </ul>
      </div>
    </Link>
  );
}
