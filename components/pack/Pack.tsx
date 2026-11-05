import Link from "next/link";
import { FileText, ExternalLink } from "lucide-react";
import type { PackData } from "@/lib/pack";
import { TrustBadge } from "./TrustBadge";

type Props = {
  pack: PackData;
  /** Marks a demonstration pack so nobody mistakes it for a real person's work. */
  example?: boolean;
  headingLevel?: "h2" | "h3";
  className?: string;
  /** Play the trust-tick sequence once (hero only). */
  animateChecks?: boolean;
  /** "preview" shows the headline fields only, with a link to the full pack. */
  variant?: "full" | "preview";
};

/**
 * The single fixed pack template. Home, the guide, public pack pages (R2) and the
 * editor preview (R2) all render this component, so every pack reads the same.
 */
export function Pack({
  pack,
  example,
  headingLevel = "h2",
  className = "",
  animateChecks = false,
  variant = "full",
}: Props) {
  const full = variant === "full";
  const Heading = headingLevel;
  const EvidenceIcon = pack.evidence.kind === "file" ? FileText : ExternalLink;

  return (
    <article
      className={`rounded-[var(--radius-doc)] border border-rule bg-surface text-[0.95rem] shadow-pack ${className}`}
      aria-label={`Evidence pack: ${pack.title}`}
    >
      <header className="border-b border-rule px-6 pt-5 pb-5 sm:px-8">
        <div className="flex items-baseline justify-between gap-4 text-sm text-ink-2">
          <p>
            <span className="font-medium text-ink">{pack.author}</span> · {pack.context}
          </p>
          {example && (
            <span className="shrink-0 rounded-[var(--radius-sm)] bg-sky px-2 py-0.5 text-xs font-medium text-ink-2">
              Example
            </span>
          )}
        </div>
        <Heading className="mt-3 font-serif text-[1.55rem] font-normal leading-tight tracking-[-0.01em] sm:text-[1.75rem]">
          {pack.title}
        </Heading>
        <p className="mt-3 font-serif text-[1.2rem] leading-snug text-ink" data-field="outcome">
          {pack.outcome}
        </p>
      </header>

      <dl className="divide-y divide-rule px-6 sm:px-8">
        {full && (
          <Row label="Method" field="method">
            <p>{pack.method}</p>
          </Row>
        )}
        <Row label="Results" field="results">
          <ul className="space-y-1">
            {pack.results.filter(Boolean).map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </Row>
        <Row label="The work" field="evidence">
          <a href={pack.evidence.href} className="link inline-flex items-center gap-1.5 font-medium">
            <EvidenceIcon aria-hidden size={16} strokeWidth={1.5} />
            {pack.evidence.label}
          </a>
        </Row>
        {full && (
          <Row label="Reflection" field="reflection">
            <p>{pack.reflection}</p>
          </Row>
        )}
      </dl>
      {!full && (
        <p className="mx-6 border-t border-rule py-3.5 text-sm text-ink-2 sm:mx-8">
          Method and reflection are in the{" "}
          <Link href="/how-to-read-a-pack" className="link font-medium text-ink">
            full pack
          </Link>
          .
        </p>
      )}

      <footer className="border-t border-rule px-6 py-4 sm:px-8">
        <TrustBadge checkedOn={pack.checkedOn} animate={animateChecks} />
      </footer>
    </article>
  );
}

function Row({
  label,
  field,
  children,
}: {
  label: string;
  field: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1 py-4 sm:grid-cols-[7rem_1fr] sm:gap-6" data-field={field}>
      <dt className="text-sm text-ink-2 sm:pt-0.5">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
