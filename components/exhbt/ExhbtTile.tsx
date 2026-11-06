import Link from "next/link";
import { ArrowUpRight, Check } from "lucide-react";
import type { ExhbtData } from "@/lib/exhbt";

/**
 * Compact portfolio tile: what an employer scans before opening an exhbt.
 * One big result number, the methodology as a single strip, skills as boxes, and
 * the verification mark. The whole tile links to the full exhbt.
 */
export function ExhbtTile({ exhbt: e, href, maxSkills = 4 }: { exhbt: ExhbtData; href: string; maxSkills?: number }) {
  const extra = e.skills.length - maxSkills;
  return (
    <Link
      href={href}
      className="group flex h-full flex-col rounded-[16px] border border-rule bg-surface p-5 shadow-pack transition-[transform,border-color] duration-150 hover:-translate-y-0.5 hover:border-blue-edge sm:p-6"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="font-mono text-[0.72rem] text-quiet">{e.context}</p>
        <span className="flex shrink-0 items-center gap-3">
          <span className="inline-flex items-center gap-1.5 text-[0.78rem] font-semibold">
            <span className="inline-flex size-4 items-center justify-center rounded-full border border-ink bg-green">
              <Check aria-hidden size={10} strokeWidth={3} />
            </span>
            Verified
          </span>
          <ArrowUpRight aria-hidden size={18} strokeWidth={2} className="text-quiet group-hover:text-ink" />
        </span>
      </div>
      <h3 className="mt-2 text-[1.2rem] leading-snug font-bold tracking-[-0.015em]">{e.title}</h3>

      <p className="mt-4 flex items-baseline gap-2">
        <span className="text-[2.4rem] leading-none font-extrabold tracking-[-0.03em]">{e.headline.value}</span>
        <span className="text-sm text-ink-2">{e.headline.label}</span>
      </p>

      {/* Methodology strip: step names only; details live in the full exhbt. */}
      <ol className="mt-4 flex flex-wrap items-center gap-1" aria-label="Methodology">
        {e.methodology.map((m, i) => {
          const last = i === e.methodology.length - 1;
          return (
            <li key={`${i}-${m.step}`} className="flex items-center gap-1">
              <span
                className={`rounded-[6px] px-2 py-0.5 font-mono text-[0.7rem] ${
                  last ? "bg-ink text-white" : "border border-rule bg-sky text-ink"
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
            <li key={s} className="rounded-[6px] border border-rule px-1.5 py-0.5 font-mono text-[0.7rem] text-ink-2">
              {s}
            </li>
          ))}
          {extra > 0 && <li className="px-1 py-0.5 font-mono text-[0.7rem] text-quiet">+{extra}</li>}
        </ul>
      </div>
    </Link>
  );
}
