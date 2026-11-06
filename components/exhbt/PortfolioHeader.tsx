import type { ExhbtData, PortfolioOwner } from "@/lib/exhbt";

/** The top of a portfolio page: who it is, what they're after, and every skill their exhbts prove. */
export function PortfolioHeader({ owner, exhbts }: { owner: PortfolioOwner; exhbts: ExhbtData[] }) {
  const skills = [...new Set(exhbts.flatMap((e) => e.skills))];
  const initials = owner.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2);
  return (
    <header className="rounded-[20px] border border-rule bg-surface p-6 shadow-pack sm:p-8">
      <div className="flex flex-wrap items-center gap-5">
        <span
          aria-hidden
          className="inline-flex size-16 shrink-0 items-center justify-center rounded-[16px] bg-ink font-mono text-[1.3rem] font-semibold text-blue"
        >
          {initials}
        </span>
        <div className="min-w-0">
          <h1 className="text-[2rem] sm:text-[2.6rem]">{owner.name}</h1>
          <p className="mt-1 text-ink-2">{owner.headline}</p>
        </div>
        <p className="ml-auto rounded-full border border-rule bg-sky px-3 py-1 font-mono text-[0.8rem]">
          exhbt.co.uk/{owner.username}
        </p>
      </div>
      <dl className="mt-6 grid gap-4 border-t border-rule pt-5 text-[0.95rem] sm:grid-cols-2">
        <div>
          <dt className="font-mono text-[0.72rem] text-quiet">studied</dt>
          <dd className="mt-0.5">{owner.course}</dd>
        </div>
        <div>
          <dt className="font-mono text-[0.72rem] text-quiet">looking for</dt>
          <dd className="mt-0.5">{owner.lookingFor}</dd>
        </div>
      </dl>
      <div className="mt-5 border-t border-rule pt-5">
        <p className="font-mono text-[0.72rem] text-quiet">
          proven across {exhbts.length} exhbts
        </p>
        <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Skills proven">
          {skills.map((s) => (
            <li key={s} className="rounded-[6px] border border-rule bg-sky px-2 py-1 font-mono text-[0.76rem]">
              {s}
            </li>
          ))}
        </ul>
      </div>
    </header>
  );
}
