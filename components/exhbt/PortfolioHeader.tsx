import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { ExhbtData, PortfolioOwner } from "@/lib/exhbt";
import { portfolioHost } from "@/lib/hosts";

/*
 * The portfolio's one navy brand band. Text on it: white (about 14:1), #c9cbcf for
 * secondary text and the light-blue token for labels (both above 9:1). Keep it that way;
 * docs/brand.md has the rule.
 */

const SOFT = "text-[#c9cbcf]";

function initialsOf(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2);
}

function Initials({ name, small }: { name: string; small?: boolean }) {
  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 items-center justify-center bg-mint font-mono font-semibold text-ink ${
        small ? "size-9 rounded-[9px] text-[0.8rem]" : "size-16 rounded-[16px] text-[1.3rem]"
      }`}
    >
      {initialsOf(name)}
    </span>
  );
}

function LinkChip({ username }: { username: string }) {
  return (
    <p className="rounded-full border border-white/25 px-3 py-1 font-mono text-[0.8rem] text-white">
      {portfolioHost(username)}
    </p>
  );
}

/** The top of a portfolio page: who it is, what they're after, and every skill their exhbts prove. */
export function PortfolioHeader({ owner, exhbts, note }: { owner: PortfolioOwner; exhbts: ExhbtData[]; note?: React.ReactNode }) {
  const skills = [...new Set(exhbts.flatMap((e) => e.skills))];
  return (
    <header>
      <div className="bg-ink text-white">
        <div className="mx-auto max-w-[64rem] px-4 pt-8 pb-9 sm:px-8 sm:pt-10 sm:pb-11">
          {note && <div className={`mb-6 text-sm ${SOFT}`}>{note}</div>}
          <div className="flex flex-wrap items-center gap-5">
            <Initials name={owner.name} />
            <div className="min-w-0">
              <h1 className="text-white">{owner.name}</h1>
              <p className={`mt-1 ${SOFT}`}>{owner.headline}</p>
            </div>
            <div className="sm:ml-auto">
              <LinkChip username={owner.username} />
            </div>
          </div>
          <dl className="mt-7 grid gap-4 border-t border-white/15 pt-5 text-[0.95rem] sm:grid-cols-2">
            <div>
              <dt className="font-mono text-[0.72rem] text-mint">studied</dt>
              <dd className="mt-0.5">{owner.course}</dd>
            </div>
            <div>
              <dt className="font-mono text-[0.72rem] text-mint">looking for</dt>
              <dd className="mt-0.5">{owner.lookingFor}</dd>
            </div>
          </dl>
        </div>
      </div>
      <div className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-[64rem] flex-wrap items-baseline gap-x-4 gap-y-2 px-4 py-5 sm:px-8">
          <p className="font-mono text-[0.72rem] text-slate">proven across {exhbts.length} exhbts</p>
          <ul className="flex flex-wrap gap-1.5" aria-label="Skills proven">
            {skills.map((s) => (
              <li key={s} className="rounded-[6px] border border-line bg-mist px-2 py-1 font-mono text-[0.76rem]">
                {s}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </header>
  );
}

/** The same band, slim, above a single exhbt: whose it is and the way back. */
export function PortfolioBar({ owner, backHref }: { owner: PortfolioOwner; backHref: string }) {
  return (
    <div className="bg-ink text-white">
      <div className="mx-auto flex max-w-[56rem] flex-wrap items-center gap-x-4 gap-y-3 px-4 py-4 sm:px-8">
        <Link
          href={backHref}
          className="group inline-flex items-center gap-3 rounded-[12px] pr-2 font-semibold hover:text-mint"
        >
          <ArrowLeft aria-hidden size={16} strokeWidth={2.25} className={SOFT} />
          <Initials name={owner.name} small />
          <span>
            {owner.name}&rsquo;s portfolio
          </span>
        </Link>
        <div className="ml-auto">
          <LinkChip username={owner.username} />
        </div>
      </div>
    </div>
  );
}
