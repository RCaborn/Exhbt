import { FileText, ExternalLink, ArrowUpRight } from "lucide-react";
import { Seal } from "@/components/brand/Seal";
import { catalogueNo, type ExhbtData } from "@/lib/exhbt";
import { BeforeAfterChart } from "./BeforeAfterChart";
import { MethodFlow } from "./MethodFlow";
import { TrustBadge } from "./TrustBadge";

type Props = {
  exhbt: ExhbtData;
  /** Marks a demonstration exhbt so nobody mistakes it for a real person's work. */
  example?: boolean;
  headingLevel?: "h1" | "h2" | "h3";
  className?: string;
  /** Play the trust-tick sequence once when it first renders. */
  animateChecks?: boolean;
  /** 1-based place in the owner's portfolio; shows the catalogue number (EX·01). */
  position?: number;
};

/**
 * The single fixed exhbt template, used on the home page, the employer guide, public
 * portfolios and the editor preview, so every exhbt reads the same. Order:
 * who · title · outcome · methodology flow · key-result chart · skills · the work ·
 * verification · reflection.
 */
export function Exhbt({ exhbt: e, example, headingLevel = "h2", className = "", animateChecks = false, position }: Props) {
  const Heading = headingLevel;
  const EvidenceIcon = e.evidence.kind === "file" ? FileText : ExternalLink;

  return (
    <article
      className={`@container rounded-[var(--radius-doc)] border border-line bg-surface text-[0.95rem] shadow-pack ${className}`}
      aria-label={`Exhbt: ${e.title}`}
    >
      <header className="px-6 pt-5 pb-4 sm:px-8">
        {(position || example) && (
          <div className="mb-2 flex items-center justify-between gap-4">
            {position ? (
              <span className="font-mono text-[0.8rem] font-semibold text-ink" data-catalogue>{catalogueNo(position)}</span>
            ) : (
              <span />
            )}
            {example && (
              <span className="shrink-0 rounded-[var(--radius-sm)] bg-mist px-2 py-0.5 text-xs font-medium text-graphite">
                Example
              </span>
            )}
          </div>
        )}
        <p className="text-sm text-graphite">
          <span className="font-medium text-ink">{e.author}</span> · {e.context}
        </p>
        <Heading className="mt-3 font-[family-name:var(--font-display)] text-[1.5rem] font-semibold leading-tight tracking-[-0.02em] sm:text-[1.75rem]">
          {e.title}
        </Heading>
        <p className="mt-2.5 text-[1.1rem] leading-snug text-graphite" data-field="outcome">
          {e.outcome}
        </p>
      </header>

      <div className="px-6 sm:px-8" data-field="methodology">
        <p className="mb-2 font-mono text-[0.7rem] tracking-wide text-slate" aria-hidden>
          methodology
        </p>
        <MethodFlow steps={e.methodology} />
      </div>

      {e.keyResult && (
        <div className="mx-6 mt-4 rounded-[var(--radius)] bg-mist px-4 pt-3.5 pb-2 sm:mx-8" data-field="key-result">
          <BeforeAfterChart data={e.keyResult} />
        </div>
      )}

      <ul className="flex flex-wrap gap-1.5 px-6 pt-5 sm:px-8" aria-label="Skills" data-field="skills">
        {e.skills.map((s) => (
          <li key={s} className="rounded-[6px] border border-line bg-mist px-2 py-1 font-mono text-[0.76rem] text-ink">
            {s}
          </li>
        ))}
      </ul>

      <div className="mx-6 mt-5 border-t border-line sm:mx-8" data-field="evidence">
        <a
          href={e.evidence.href}
          className="group flex items-center gap-3 py-3.5 hover:text-graphite"
          aria-label={`Open the work: ${e.evidence.label}`}
        >
          <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-[8px] bg-mist">
            <EvidenceIcon aria-hidden size={18} strokeWidth={1.75} />
          </span>
          <span className="min-w-0 flex-1 font-medium">{e.evidence.label}</span>
          <ArrowUpRight aria-hidden size={18} strokeWidth={2} className="shrink-0 text-slate group-hover:text-ink" />
        </a>
      </div>

      <footer className="border-t border-line px-6 py-4 sm:px-8">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5">
          <Seal date={e.checkedOn} />
          <TrustBadge animate={animateChecks} />
        </div>
        <p className="mt-3 text-[0.85rem] text-graphite" data-field="reflection">
          <span className="font-semibold text-ink">Reflection.</span> {e.reflection}
        </p>
      </footer>
    </article>
  );
}
