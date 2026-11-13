/* eslint-disable @next/next/no-img-element -- signed Storage URLs change hourly; next/image would cache the wrong one. */
import Link from "next/link";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import type { PortfolioOwner } from "@/lib/exhbt";
import { portfolioHost } from "@/lib/hosts";

/*
 * The portfolio's one ink brand band. Text on it: white (about 19:1) and #c9cbcf for
 * secondary text (above 11:1); mint for the small labels. Keep it that way;
 * docs/brand.md has the rule.
 */

const SOFT = "text-[#c9cbcf]";

function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0]!.toUpperCase())
    .join("")
    .slice(0, 2);
}

/** The photo when there is one (decorative: the name is beside it), else initials on mint. */
function Face({ name, photoUrl, small }: { name: string; photoUrl?: string | null; small?: boolean }) {
  const shape = small ? "size-9 rounded-[9px]" : "size-14 rounded-[14px] sm:size-16 sm:rounded-[16px]";
  if (photoUrl) return <img src={photoUrl} alt="" width={64} height={64} className={`${shape} shrink-0 object-cover`} data-avatar="photo" />;
  return (
    <span
      aria-hidden
      data-avatar="initials"
      className={`${shape} inline-flex shrink-0 items-center justify-center bg-mint font-mono font-semibold text-ink ${small ? "text-[0.8rem]" : "text-[1.15rem] sm:text-[1.3rem]"}`}
    >
      {initialsOf(name) || "?"}
    </span>
  );
}

function LinkChip({ username }: { username: string }) {
  return (
    <p className="rounded-full border border-white/25 px-3 py-1 font-mono text-[0.8125rem] text-white">
      {portfolioHost(username)}
    </p>
  );
}

/** Who the portfolio belongs to. `course` and `lookingFor` show only when the profile has them. */
export type HeaderOwner = Pick<PortfolioOwner, "username" | "name"> &
  Partial<Pick<PortfolioOwner, "course" | "lookingFor">> & {
    headline?: string | null;
    bio?: string | null;
    /** An https LinkedIn address, already checked. */
    linkedin?: string | null;
    photoUrl?: string | null;
  };

/**
 * The top of a portfolio page: who it is, what they're after, and every skill their exhbts prove.
 * Full-bleed by default (the demo). `framed` draws it as a rounded panel inside a page container,
 * for the real portfolio, whose layout belongs to the subdomain work.
 */
export function PortfolioHeader({
  owner,
  exhbts,
  note,
  framed = false,
}: {
  owner: HeaderOwner;
  exhbts: { skills: string[] }[];
  note?: React.ReactNode;
  framed?: boolean;
}) {
  const skills = [...new Set(exhbts.flatMap((e) => e.skills))];
  const inner = framed ? "px-5 sm:px-8" : "mx-auto max-w-[64rem] px-4 sm:px-8";
  const facts = [
    owner.course && { label: "studied", value: owner.course },
    owner.lookingFor && { label: "looking for", value: owner.lookingFor },
  ].filter(Boolean) as { label: string; value: string }[];
  return (
    <header className={framed ? "overflow-hidden rounded-[20px] border border-line shadow-pack print:shadow-none" : ""}>
      <div className="bg-ink text-white">
        <div className={`${inner} pt-6 pb-7 sm:pt-10 sm:pb-10`}>
          {note && <div className={`mb-6 text-sm ${SOFT}`}>{note}</div>}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-4">
            <div className="flex min-w-0 items-center gap-4 sm:gap-5">
              <Face name={owner.name} photoUrl={owner.photoUrl} />
              <div className="min-w-0">
                <h1 className="text-white">{owner.name}</h1>
                {owner.headline && <p className={`mt-1 ${SOFT}`}>{owner.headline}</p>}
              </div>
            </div>
            <div className="sm:ml-auto">
              <LinkChip username={owner.username} />
            </div>
          </div>
          {(owner.bio || owner.linkedin) && (
            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-8">
              {owner.bio && <p className="max-w-[40rem] text-[0.95rem] leading-relaxed text-white">{owner.bio}</p>}
              {owner.linkedin && (
                <a
                  href={owner.linkedin}
                  rel="noopener"
                  target="_blank"
                  className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-full border border-white/25 px-3.5 py-1.5 text-sm font-semibold text-white hover:border-mint sm:self-auto"
                >
                  LinkedIn <ArrowUpRight aria-hidden size={15} strokeWidth={2.25} />
                  <span className="sr-only">(opens in a new tab)</span>
                </a>
              )}
            </div>
          )}
          {facts.length > 0 && (
            <dl className="mt-7 grid gap-4 border-t border-white/15 pt-5 text-[0.95rem] sm:grid-cols-2">
              {facts.map((f) => (
                <div key={f.label}>
                  <dt className="font-mono text-[0.8125rem] text-mint">{f.label}</dt>
                  <dd className="mt-0.5">{f.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </div>
      {skills.length > 0 && (
        <div className="border-b border-line bg-surface">
          <div className={`${inner} flex flex-wrap items-baseline gap-x-4 gap-y-2 py-5`}>
            <p className="font-mono text-[0.8125rem] text-slate">proven across {exhbts.length} {exhbts.length === 1 ? "exhbt" : "exhbts"}</p>
            <ul className="flex flex-wrap gap-1.5" aria-label="Skills proven">
              {skills.map((s) => (
                <li key={s} className="rounded-[6px] border border-line bg-mist px-2 py-1 font-mono text-[0.76rem]">
                  {s}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
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
          <Face name={owner.name} small />
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
