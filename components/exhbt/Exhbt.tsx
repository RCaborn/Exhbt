import Link from "next/link";
import { Check, FileText, ExternalLink } from "lucide-react";
import type { ExhbtData } from "@/lib/exhbt";
import { BeforeAfterChart } from "./BeforeAfterChart";
import { TrustBadge } from "./TrustBadge";

type Props = {
  exhbt: ExhbtData;
  /** Marks a demonstration exhbt so nobody mistakes it for a real person's work. */
  example?: boolean;
  headingLevel?: "h2" | "h3";
  className?: string;
  /** Play the trust-tick sequence once (hero only). */
  animateChecks?: boolean;
  /** "preview" shows the headline, chart and skills, with a link to the full exhbt. */
  variant?: "full" | "preview";
};

/**
 * The single fixed exhbt template. Home, the guide, public portfolio pages and the
 * editor preview all render this component, so every exhbt reads the same.
 * Order: who · title · outcome · key result chart · method · results · skills · the work ·
 * reflection · checks.
 */
export function Exhbt({
  exhbt: e,
  example,
  headingLevel = "h2",
  className = "",
  animateChecks = false,
  variant = "full",
}: Props) {
  const full = variant === "full";
  const Heading = headingLevel;
  const EvidenceIcon = e.evidence.kind === "file" ? FileText : ExternalLink;

  return (
    <article
      className={`rounded-[var(--radius-doc)] border border-rule bg-surface text-[0.95rem] shadow-pack ${className}`}
      aria-label={`Exhbt: ${e.title}`}
    >
      <header className="px-6 pt-5 pb-5 sm:px-8">
        <div className="flex items-baseline justify-between gap-4 text-sm text-ink-2">
          <p>
            <span className="font-medium text-ink">{e.author}</span> · {e.context}
          </p>
          {example && (
            <span className="shrink-0 rounded-[var(--radius-sm)] bg-sky px-2 py-0.5 text-xs font-medium text-ink-2">
              Example
            </span>
          )}
        </div>
        <Heading className="mt-3 font-serif text-[1.5rem] font-normal leading-tight tracking-[-0.01em] sm:text-[1.7rem]">
          {e.title}
        </Heading>
        <p className="mt-3 font-serif text-[1.15rem] leading-snug text-ink" data-field="outcome">
          {e.outcome}
        </p>
      </header>

      {e.keyResult && (
        <div className="mx-6 rounded-[var(--radius)] bg-sky px-4 pt-3.5 pb-2 sm:mx-8" data-field="key-result">
          <BeforeAfterChart data={e.keyResult} />
        </div>
      )}

      <div className="px-6 sm:px-8">
        {full && (
          <Section label="Method" field="method">
            <Bullets items={e.method} />
          </Section>
        )}
        {full && (
          <Section label="Results" field="results">
            <Bullets items={e.results} checked />
          </Section>
        )}
        <Section label="Skills shown" field="skills">
          <ul className="flex flex-wrap gap-1.5" aria-label="Skills">
            {e.skills.map((s) => (
              <li key={s} className="rounded-full border border-rule bg-surface px-2.5 py-0.5 text-[0.82rem] font-medium">
                {s}
              </li>
            ))}
          </ul>
        </Section>
        <Section label="The work" field="evidence">
          <a href={e.evidence.href} className="link inline-flex items-center gap-1.5 font-medium">
            <EvidenceIcon aria-hidden size={16} strokeWidth={1.5} />
            {e.evidence.label}
          </a>
        </Section>
        {full && (
          <Section label="Reflection" field="reflection">
            <p>{e.reflection}</p>
          </Section>
        )}
        {!full && (
          <p className="border-t border-rule py-3.5 text-sm text-ink-2">
            Method, results and reflection are in the{" "}
            <Link href="/how-to-read-an-exhbt" className="link font-medium text-ink">
              full exhbt
            </Link>
            .
          </p>
        )}
      </div>

      <footer className="border-t border-rule px-6 py-4 sm:px-8">
        <TrustBadge checkedOn={e.checkedOn} animate={animateChecks} />
      </footer>
    </article>
  );
}

function Section({ label, field, children }: { label: string; field: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-rule py-4 first:mt-4" data-field={field}>
      <p className="mb-2 text-[0.8rem] font-semibold text-ink-2">{label}</p>
      {children}
    </div>
  );
}

function Bullets({ items, checked }: { items: string[]; checked?: boolean }) {
  return (
    <ul className="space-y-1.5">
      {items.filter(Boolean).map((t) => (
        <li key={t} className="flex gap-2.5">
          {checked ? (
            <span className="mt-[3px] inline-flex size-4 shrink-0 items-center justify-center rounded-full border border-ink bg-green">
              <Check aria-hidden size={10} strokeWidth={3} />
            </span>
          ) : (
            <span aria-hidden className="mt-[9px] size-1.5 shrink-0 rounded-full bg-ink" />
          )}
          <span>{t}</span>
        </li>
      ))}
    </ul>
  );
}
