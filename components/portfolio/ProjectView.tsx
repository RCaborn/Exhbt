/* eslint-disable @next/next/no-img-element -- signed Storage URLs; see Avatar.tsx. */
import { ArrowUpRight } from "lucide-react";
import { Seal } from "@/components/brand/Seal";
import { BeforeAfterChart } from "@/components/exhbt/BeforeAfterChart";
import { MethodFlow } from "@/components/exhbt/MethodFlow";
import { RichText } from "@/components/exhbt/RichText";
import { TrustBadge } from "@/components/exhbt/TrustBadge";
import { Avatar } from "@/components/portfolio/Avatar";
import { catalogueNo } from "@/lib/exhbt";
import { type ExhbtDoc } from "@/lib/exhbt/blocks";
import { headlineFor } from "@/lib/exhbt/headline";

export type Owner = { name: string; photoUrl: string | null };

/** Section headings: small, but real headings at the 13px caption size, in sentence case. */
const LABEL = "font-sans text-[0.8125rem] font-semibold tracking-normal text-graphite";

/**
 * One exhbt, in the layout Rory set (12 Nov 2026; docs/decisions/0007):
 * catalogue number, photo and name top left, skill boxes top right, title and context, the result
 * number; then the gap, the process flowchart, findings, graphs and images; the work and the
 * checks at the foot. A recruiter skims: short sections, bullets, nothing longer than it needs to be.
 * Prints as one A4 page (the print: classes, and the @media print block in globals.css).
 */
export function ProjectView({
  doc,
  owner,
  imageUrls = {},
  evidenceUrl,
  checkedOn,
  headingLevel = "h1",
  position,
  confirmed = true,
  checksHref,
}: {
  doc: ExhbtDoc;
  owner: Owner;
  /** fileId → signed URL. Images without one are left out. */
  imageUrls?: Record<string, string | null>;
  /** Signed URL for a file, or the link itself. */
  evidenceUrl?: string | null;
  /** When it was published (and so checked). Without it there is no seal: the checks haven't run. */
  checkedOn?: string;
  headingLevel?: "h1" | "h2";
  /** 1-based place in the portfolio, for the catalogue number (EX·01). */
  position?: number;
  /** The author's "this is my own work" tick. Published exhbts are always confirmed. */
  confirmed?: boolean;
  /** Where the seal explains the checks (see Seal). */
  checksHref?: string;
}) {
  const H = headingLevel;
  const Sub = headingLevel === "h1" ? "h2" : "h3";
  const images = doc.images.filter((im) => imageUrls[im.fileId]);
  const headline = headlineFor(doc);
  const hasWork = Boolean(doc.evidence && evidenceUrl);
  const skills = (className: string) =>
    doc.skills.length > 0 && (
      <ul aria-label="Skills used" className={`flex-wrap gap-1.5 ${className}`}>
        {doc.skills.map((s) => (
          <li key={s} className="rounded-[6px] border border-line bg-mist px-2 py-1 font-mono text-[0.8125rem] text-ink">
            {s}
          </li>
        ))}
      </ul>
    );

  return (
    <article className="@container rounded-[20px] border border-line bg-surface p-5 shadow-pack sm:p-8 print:rounded-none print:border-0 print:p-0 print:shadow-none">
      {position !== undefined && (
        <p className="mb-3 font-mono text-[0.8125rem] font-semibold text-ink" data-catalogue>
          {catalogueNo(position)}
        </p>
      )}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3">
          <Avatar name={owner.name} photoUrl={owner.photoUrl} size={44} />
          <p className="font-semibold">{owner.name}</p>
        </div>
        {/* On phones the skills follow the title instead, so the title isn't pushed down. */}
        {skills("hidden sm:flex sm:max-w-[60%] sm:justify-end")}
      </header>

      <H className="mt-6 text-[1.6rem] leading-tight sm:text-[2rem] print:mt-4">{doc.title}</H>
      {doc.context && <p className="mt-1.5 text-graphite">{doc.context}</p>}
      {headline && (
        <p className="mt-4 flex flex-wrap items-baseline gap-x-2.5 gap-y-1" data-headline>
          <span className="font-[family-name:var(--font-display)] text-[2.4rem] leading-none font-semibold tracking-[-0.03em] tabular-nums">
            {headline.value}
          </span>
          <span className="text-graphite">{headline.label}</span>
        </p>
      )}
      {skills("mt-4 flex sm:hidden")}

      <section aria-labelledby="gap" className="mt-6 break-inside-avoid print:mt-4">
        <Sub id="gap" className={LABEL}>The question</Sub>
        <p className="mt-1.5 text-[1.05rem] leading-relaxed">
          <RichText value={doc.gap} />
        </p>
      </section>

      <section aria-labelledby="process" className="mt-6 break-inside-avoid print:mt-4">
        <Sub id="process" className={LABEL}>Process</Sub>
        <div className="mt-2">
          <MethodFlow steps={doc.flow} />
        </div>
      </section>

      <section aria-labelledby="findings" className="mt-6 break-inside-avoid print:mt-4">
        <Sub id="findings" className={LABEL}>Findings</Sub>
        <ul className="mt-2 space-y-1.5">
          {doc.findings.map((f, i) => (
            <li key={i} className="flex gap-2.5 leading-snug">
              <span aria-hidden className="mt-[0.55em] size-1.5 shrink-0 rounded-full bg-ink" />
              <span>
                <RichText value={f} />
              </span>
            </li>
          ))}
        </ul>
      </section>

      {doc.charts.length > 0 && (
        <section aria-label="Graphs" className={`mt-7 grid gap-6 print:mt-4 ${doc.charts.length > 1 ? "@3xl:grid-cols-2 print:grid-cols-2" : ""}`}>
          {doc.charts.map((c, i) => (
            <div key={i} className="break-inside-avoid">
              <BeforeAfterChart data={c} />
            </div>
          ))}
        </section>
      )}

      {images.length > 0 && (
        <section aria-label="Images" className={`mt-7 grid gap-4 print:mt-4 ${images.length > 1 ? "@2xl:grid-cols-2 print:grid-cols-2" : ""}`}>
          {images.map((im) => (
            <figure key={im.fileId} className="m-0 break-inside-avoid">
              <img src={imageUrls[im.fileId]!} alt={im.alt} className="w-full rounded-[12px] border border-line print:max-h-[70mm] print:w-auto" />
              {im.caption.length > 0 && (
                <figcaption className="mt-1.5 text-sm text-graphite">
                  <RichText value={im.caption} />
                </figcaption>
              )}
            </figure>
          ))}
        </section>
      )}

      <footer
        className={`mt-8 flex flex-col gap-4 border-t border-line pt-5 sm:flex-row sm:items-center print:mt-5 print:flex-row print:items-center ${
          hasWork ? "sm:justify-between print:justify-between" : ""
        }`}
      >
        {hasWork && (
          <a href={evidenceUrl!} rel="nofollow ugc noopener" target="_blank" className="link inline-flex items-center gap-1.5 font-semibold text-ink">
            See the work: {doc.evidence!.label}
            <ArrowUpRight aria-hidden size={16} strokeWidth={2.25} />
          </a>
        )}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <TrustBadge sourceAttached={Boolean(doc.evidence)} confirmed={confirmed} />
          {checkedOn && <Seal date={checkedOn} href={checksHref} />}
        </div>
      </footer>
    </article>
  );
}
