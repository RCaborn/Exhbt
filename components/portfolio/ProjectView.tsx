/* eslint-disable @next/next/no-img-element -- signed Storage URLs; see Avatar.tsx. */
import { ArrowUpRight } from "lucide-react";
import { Seal } from "@/components/brand/Seal";
import { Chart } from "@/components/charts/Chart";
import { MethodFlow } from "@/components/exhbt/MethodFlow";
import { RichText } from "@/components/exhbt/RichText";
import { TrustBadge } from "@/components/exhbt/TrustBadge";
import { Avatar } from "@/components/portfolio/Avatar";
import { catalogueNo } from "@/lib/exhbt";
import { safeHref, type ExhbtDoc, type Section, type SectionOf } from "@/lib/exhbt/blocks";
import { headlineFor } from "@/lib/exhbt/headline";

export type Owner = { name: string; photoUrl: string | null; /** The portfolio look's photo shape; round when left out. */ shape?: "round" | "square" };

/** Section headings: small, but real headings at the 13px caption size, in sentence case. */
const LABEL = "font-sans text-[0.8125rem] font-semibold tracking-normal text-graphite";

/**
 * One exhbt, in the layout Rory set (12 Nov 2026; docs/decisions/0007, 0015):
 * catalogue number, photo and name top left, skill boxes top right, title and context, the result
 * number; then the gap and the process flowchart, always; then the sections in the person's order
 * (findings, graphs, images, a quote, what I'd do next, a link); the work and the checks at the
 * foot. Graphs next to each other share a row, and so do images, as they always have, so an
 * exhbt saved before sections looks the same. A recruiter skims: short sections, bullets, nothing
 * longer than it needs to be. Prints as one A4 page (the print: classes, and the @media print
 * block in globals.css).
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
  team,
}: {
  doc: ExhbtDoc;
  owner: Owner;
  /** Teammates under the author (TeamByline, decision 0013). A byline, not part of the doc or its word count. */
  team?: React.ReactNode;
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
          <Avatar name={owner.name} photoUrl={owner.photoUrl} size={44} shape={owner.shape} />
          <p className="font-semibold">{owner.name}</p>
        </div>
        {/* On phones the skills follow the title instead, so the title isn't pushed down. */}
        {skills("hidden sm:flex sm:max-w-[60%] sm:justify-end")}
      </header>
      {team}

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

      {runsOf(doc.sections.filter((s) => s.kind !== "image" || imageUrls[s.fileId])).map((run) => {
        switch (run.kind) {
          case "graphs":
            return (
              <section key={run.items[0]!.id} aria-label="Graphs" className={`mt-7 grid gap-6 print:mt-4 ${run.items.length > 1 ? "@3xl:grid-cols-2 print:grid-cols-2" : ""}`}>
                {run.items.map((g) => (
                  <div key={g.id} className="break-inside-avoid">
                    <Chart data={g.chart} />
                  </div>
                ))}
              </section>
            );
          case "images":
            return (
              <section key={run.items[0]!.id} aria-label="Images" className={`mt-7 grid gap-4 print:mt-4 ${run.items.length > 1 ? "@2xl:grid-cols-2 print:grid-cols-2" : ""}`}>
                {run.items.map((im) => (
                  <figure key={im.id} className="m-0 break-inside-avoid">
                    <img src={imageUrls[im.fileId]!} alt={im.alt} className="w-full rounded-[12px] border border-line print:max-h-[70mm] print:w-auto" />
                    {im.caption.length > 0 && (
                      <figcaption className="mt-1.5 text-sm text-graphite">
                        <RichText value={im.caption} />
                      </figcaption>
                    )}
                  </figure>
                ))}
              </section>
            );
          case "one":
            return <OneSection key={run.section.id} s={run.section} Sub={Sub} />;
        }
      })}

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

/** Sections as drawn: graphs next to each other share one row, and so do images; the rest stand alone. */
type Run = { kind: "graphs"; items: SectionOf<"graph">[] } | { kind: "images"; items: SectionOf<"image">[] } | { kind: "one"; section: Exclude<Section, { kind: "graph" | "image" }> };

function runsOf(sections: Section[]): Run[] {
  const out: Run[] = [];
  for (const s of sections) {
    const last = out[out.length - 1];
    if (s.kind === "graph") {
      if (last?.kind === "graphs") last.items.push(s);
      else out.push({ kind: "graphs", items: [s] });
    } else if (s.kind === "image") {
      if (last?.kind === "images") last.items.push(s);
      else out.push({ kind: "images", items: [s] });
    } else out.push({ kind: "one", section: s });
  }
  return out;
}

/** Findings, a quote, what I'd do next or a link. Each kind appears once at most, so the heading ids are unique. */
function OneSection({ s, Sub }: { s: Exclude<Section, { kind: "graph" | "image" }>; Sub: "h2" | "h3" }) {
  switch (s.kind) {
    case "findings":
      return (
        <section aria-labelledby="findings" className="mt-6 break-inside-avoid print:mt-4">
          <Sub id="findings" className={LABEL}>
            Findings
          </Sub>
          <ul className="mt-2 space-y-1.5">
            {s.items.map((f, i) => (
              <li key={i} className="flex gap-2.5 leading-snug">
                <span aria-hidden className="mt-[0.55em] size-1.5 shrink-0 rounded-full bg-ink" />
                <span>
                  <RichText value={f} />
                </span>
              </li>
            ))}
          </ul>
        </section>
      );
    case "quote":
      return (
        <section aria-labelledby="feedback" className="mt-6 break-inside-avoid print:mt-4">
          <Sub id="feedback" className={LABEL}>
            Feedback
          </Sub>
          <figure className="m-0 mt-1.5">
            <blockquote className="text-[1.05rem] leading-relaxed">“{s.text.trim()}”</blockquote>
            {(s.name.trim() || s.role.trim()) && (
              <figcaption className="mt-1 text-sm text-graphite">{[s.name.trim(), s.role.trim()].filter(Boolean).join(", ")}</figcaption>
            )}
          </figure>
        </section>
      );
    case "reflection":
      return (
        <section aria-labelledby="next" className="mt-6 break-inside-avoid print:mt-4">
          <Sub id="next" className={LABEL}>
            What I&apos;d do next
          </Sub>
          <p className="mt-1.5 leading-relaxed">
            <RichText value={s.text} />
          </p>
        </section>
      );
    case "link": {
      const href = safeHref(s.href);
      const label = s.label.trim() || "Link";
      return (
        <section aria-label="Link" className="mt-6 break-inside-avoid print:mt-4">
          <div className="rounded-[12px] border border-line px-4 py-3">
            {href ? (
              <a href={href} rel="nofollow ugc noopener" target="_blank" className="link inline-flex items-center gap-1.5 font-semibold text-ink">
                {label}
                <ArrowUpRight aria-hidden size={16} strokeWidth={2.25} />
              </a>
            ) : (
              <p className="font-semibold">{label}</p>
            )}
            {s.description.trim() && <p className="mt-0.5 text-sm text-graphite">{s.description.trim()}</p>}
          </div>
        </section>
      );
    }
  }
}
