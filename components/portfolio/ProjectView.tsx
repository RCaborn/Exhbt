/* eslint-disable @next/next/no-img-element -- signed Storage URLs; see Avatar.tsx. */
import Link from "next/link";
import { ArrowUpRight, Check } from "lucide-react";
import { CHECKS_GUIDE } from "@/components/brand/Seal";
import { Chart } from "@/components/charts/Chart";
import { MethodFlow } from "@/components/exhbt/MethodFlow";
import { RichText } from "@/components/exhbt/RichText";
import { Avatar } from "@/components/portfolio/Avatar";
import { PrintButton } from "@/components/portfolio/PrintButton";
import { Button } from "@/components/ui/Button";
import { safeHref, type ExhbtDoc, type Section, type SectionOf } from "@/lib/exhbt/blocks";

export type Owner = {
  name: string;
  photoUrl: string | null;
  /** The portfolio look's photo shape; round when left out. */
  shape?: "round" | "square";
  /** The short line under the name in the sidebar (the profile's headline). */
  bio?: string | null;
  /** Where "All of <name>'s work" goes: the portfolio's home. No button without it. */
  homeHref?: string;
};

type Sub = "h2" | "h3";
type ImageUrls = Record<string, string | null>;

/**
 * One exhbt, in the layout Rory drew on 16 Nov 2026 (docs/design/portfolio-and-exhbt-layouts.pdf,
 * page 2; decision 0022, which keeps 0007's fixed core and 0015's sections).
 *
 * A sidebar: the person (photo, name, short bio, a way to all their work), then what it is, where
 * and when, the checks as ticks, the work as the one big button, and Save as PDF. The main column:
 * skill pills top right, the title (the question, large), the context line with its gap
 * highlighted, the flowchart, then the sections in the person's order. "What I found" sits beside
 * a graph or image that is its neighbour; everything else takes the full width. No catalogue
 * number and no headline figure.
 *
 * It lays out by the room it's given (container queries), not the screen, so the editor's
 * half-width preview stacks the sidebar above the main column just as a phone does. Colours,
 * radii and the highlight come from the --xp-* variables in globals.css, so a portfolio look can
 * restyle the page without touching this file. Prints as one A4 page (the print: classes and the
 * @media print block in globals.css).
 */
export function ProjectView({
  doc,
  owner,
  imageUrls = {},
  evidenceUrl,
  checkedOn,
  headingLevel = "h1",
  confirmed = true,
  checksHref = CHECKS_GUIDE,
  team,
  saveAsPdf = false,
  sectionsSlot,
}: {
  doc: ExhbtDoc;
  owner: Owner;
  /** Teammates under the author (TeamByline, decision 0013). A byline, not part of the doc or its word count. */
  team?: React.ReactNode;
  /** fileId → signed URL. Images without one are left out. */
  imageUrls?: ImageUrls;
  /** Signed URL for a file, or the link itself. */
  evidenceUrl?: string | null;
  /** When it was published (and so checked). Without it the "checked" tick is hollow: the checks haven't run. */
  checkedOn?: string;
  headingLevel?: "h1" | "h2";
  /** The author's "this is my own work" tick. Published exhbts are always confirmed. */
  confirmed?: boolean;
  /** Where "Checked by exhbt" explains the checks. On a portfolio host, the marketing site's full address. */
  checksHref?: string;
  /** The "Save as PDF" link: on the public page, not in the editor's preview. */
  saveAsPdf?: boolean;
  /** Draws the sections instead (the editor's preview, while arranging them). */
  sectionsSlot?: React.ReactNode;
}) {
  const H = headingLevel;
  const Sub: Sub = headingLevel === "h1" ? "h2" : "h3";
  const first = owner.name.trim().split(/\s+/)[0] || owner.name;
  const hasWork = Boolean(doc.evidence && evidenceUrl);
  const kind = doc.context.trim();
  const whereWhen = doc.whereWhen?.trim() ?? "";
  const checks: { label: React.ReactNode; key: string; done: boolean }[] = [
    { key: "confirmed", label: confirmed ? `Confirmed by ${first}` : "Not confirmed yet", done: confirmed },
    ...(doc.evidence ? [{ key: "source", label: "Source attached", done: true }] : []),
    {
      key: "checked",
      done: Boolean(checkedOn),
      label: checkedOn ? (
        <a href={checksHref} className="xp-link">
          Checked by exhbt, {checkedOn}
        </a>
      ) : (
        "Checked when published"
      ),
    },
  ];

  return (
    <article data-exhbt-page className="xp @container/xp">
      <div className="grid gap-8 @3xl/xp:grid-cols-[13.5rem_minmax(0,1fr)] @3xl/xp:gap-9 print:grid-cols-[44mm_minmax(0,1fr)] print:gap-6">
        <aside aria-label={`About ${first} and this work`} className="min-w-0 @3xl/xp:sticky @3xl/xp:top-8 @3xl/xp:self-start print:static">
          <div className="xp-card flex items-center gap-4 p-4 @3xl/xp:flex-col @3xl/xp:items-stretch @3xl/xp:gap-0 @3xl/xp:p-5 print:flex-col print:items-stretch print:gap-0 print:p-4">
            <div className="shrink-0 @3xl/xp:mx-auto print:mx-auto">
              <span className="@3xl/xp:hidden print:hidden">
                <Avatar name={owner.name} photoUrl={owner.photoUrl} size={64} shape={owner.shape} />
              </span>
              <span className="hidden @3xl/xp:block print:block">
                <Avatar name={owner.name} photoUrl={owner.photoUrl} size={88} shape={owner.shape} />
              </span>
            </div>
            <div className="min-w-0 @3xl/xp:mt-4 print:mt-3">
              <p className="xp-name xp-display text-[1.5rem] leading-tight @3xl/xp:text-[1.625rem]">{owner.name}</p>
              {owner.bio?.trim() && <p className="xp-muted mt-1.5 text-[0.9375rem] leading-snug">{owner.bio.trim()}</p>}
              {owner.homeHref && (
                <Link href={owner.homeHref} className="xp-outline-button mt-4 hidden h-11 w-full items-center justify-center px-3 text-center text-[0.875rem] leading-tight font-semibold @3xl/xp:flex print:hidden">
                  All of {first}&apos;s work
                </Link>
              )}
            </div>
          </div>
          {owner.homeHref && (
            <Link href={owner.homeHref} className="xp-outline-button mt-3 flex h-11 w-full items-center justify-center px-3 text-center text-[0.875rem] leading-tight font-semibold @3xl/xp:hidden print:hidden">
              All of {first}&apos;s work
            </Link>
          )}

          <dl className="mt-6 px-1 @3xl/xp:px-5 print:mt-4 print:px-1">
            {kind && <Fact term="What it is">{kind}</Fact>}
            {whereWhen && <Fact term="Where and when">{whereWhen}</Fact>}
            <Fact term="Can you trust it?">
              <ul aria-label="Can you trust it?" className="mt-1 space-y-1.5" data-checks>
                {checks.map((c) => (
                  <li key={c.key} className="flex items-start gap-2" data-done={c.done || undefined}>
                    {c.done ? (
                      <span aria-hidden className="xp-tick mt-[0.2em] inline-flex size-[1.05rem] shrink-0 items-center justify-center rounded-full">
                        <Check size={11} strokeWidth={3.25} />
                      </span>
                    ) : (
                      <span aria-hidden className="mt-[0.2em] inline-flex size-[1.05rem] shrink-0 xp-tick-open rounded-full" />
                    )}
                    <span className={c.done ? "" : "xp-muted font-medium"}>{c.label}</span>
                  </li>
                ))}
              </ul>
            </Fact>
          </dl>

          {hasWork && (
            <div className="mt-6 print:mt-4">
              <Button href={evidenceUrl!} variant="primary" size="lg" target="_blank" rel="nofollow ugc noopener" className="xp-work-button w-full" label={`See the work: ${doc.evidence!.label}`}>
                <span className="min-w-0">See the work: {doc.evidence!.label}</span>
                <ArrowUpRight aria-hidden size={17} strokeWidth={2.25} className="shrink-0" />
              </Button>
            </div>
          )}
          {saveAsPdf && (
            <div className="mt-4 flex justify-center print:hidden">
              <PrintButton />
            </div>
          )}
        </aside>

        <div className="@container/main min-w-0">
          {doc.skills.length > 0 && (
            <ul aria-label="Skills used" className="flex flex-wrap gap-1 @2xl/main:justify-end">
              {doc.skills.map((s) => (
                <li key={s} className="xp-pill px-2 py-[0.2rem] text-[0.78rem] font-medium">
                  {s}
                </li>
              ))}
            </ul>
          )}
          {team && <div className="mt-3">{team}</div>}

          <H className="xp-title xp-display mt-5 text-[clamp(2rem,7cqi,3.4rem)] leading-[1.02] text-balance print:mt-3 print:text-[2.3rem]">
            {doc.title}
          </H>
          {doc.gap.length > 0 && (
            <p className="xp-context mt-5 max-w-[42rem] text-[1.0625rem] leading-[1.6] @2xl/main:text-[1.1875rem] print:mt-3 print:text-[1.1rem]">
              <RichText value={doc.gap} highlight />
            </p>
          )}

          <section aria-label="Process" data-part="process" className="mt-8 break-inside-avoid print:mt-5">
            <MethodFlow steps={doc.flow} variant="page" />
          </section>

          {sectionsSlot ?? <SectionsView sections={doc.sections} imageUrls={imageUrls} Sub={Sub} />}
        </div>
      </div>
    </article>
  );
}

function Fact({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div className="xp-fact border-b py-3 first:pt-0 last:border-b-0 print:py-2">
      <dt className="xp-muted text-[0.8125rem]">{term}</dt>
      <dd className="mt-0.5 text-[0.9375rem] leading-snug font-semibold">{children}</dd>
    </div>
  );
}

/* ---------------- Sections ---------------- */

/**
 * How sections are drawn, in the person's order: "What I found" next to a graph or image that is
 * its neighbour (before or after it) shares a row with it, findings on the left; graphs next to each
 * other share a row, and so do images; everything else stands alone. Nothing is reordered.
 */
export type Run =
  | { kind: "found"; findings: SectionOf<"findings">; figure: SectionOf<"graph"> | SectionOf<"image"> }
  | { kind: "graphs"; items: SectionOf<"graph">[] }
  | { kind: "images"; items: SectionOf<"image">[] }
  | { kind: "one"; section: Exclude<Section, { kind: "graph" | "image" }> };

const isFigure = (s: Section | undefined): s is SectionOf<"graph"> | SectionOf<"image"> => s?.kind === "graph" || s?.kind === "image";

export function runsOf(sections: Section[]): Run[] {
  const out: Run[] = [];
  for (let i = 0; i < sections.length; i++) {
    const s = sections[i]!;
    const next = sections[i + 1];
    const last = out[out.length - 1];
    if (s.kind === "findings" && isFigure(next)) {
      out.push({ kind: "found", findings: s, figure: next });
      i++;
    } else if (isFigure(s) && next?.kind === "findings" && !(last?.kind === "graphs" && s.kind === "graph") && !(last?.kind === "images" && s.kind === "image")) {
      // A figure straight before the findings pairs with them, unless it's already in a row of its kind.
      out.push({ kind: "found", findings: next, figure: s });
      i++;
    } else if (s.kind === "graph") {
      if (last?.kind === "graphs") last.items.push(s);
      else out.push({ kind: "graphs", items: [s] });
    } else if (s.kind === "image") {
      if (last?.kind === "images") last.items.push(s);
      else out.push({ kind: "images", items: [s] });
    } else out.push({ kind: "one", section: s });
  }
  return out;
}

/** Every section below the flowchart, drawn as runsOf lays them out. Images without a URL are left out. */
export function SectionsView({ sections, imageUrls, Sub }: { sections: Section[]; imageUrls: ImageUrls; Sub: Sub }) {
  return (
    <>
      {runsOf(sections.filter((s) => s.kind !== "image" || imageUrls[s.fileId])).map((run) => {
        switch (run.kind) {
          case "found":
            return (
              <div key={run.findings.id} data-found className="xp-section xp-found grid items-center gap-8 @2xl/main:grid-cols-[minmax(0,0.92fr)_minmax(0,1fr)] @2xl/main:gap-9 print:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)] print:gap-5">
                <Findings s={run.findings} Sub={Sub} />
                <Figure s={run.figure} imageUrls={imageUrls} />
              </div>
            );
          case "graphs":
          case "images":
            return (
              <div
                key={run.items[0]!.id}
                aria-label={run.kind === "graphs" ? "Graphs" : "Images"}
                role="group"
                className={`xp-section grid gap-6 ${run.items.length > 1 ? "@2xl/main:grid-cols-2 print:grid-cols-2" : ""}`}
              >
                {run.items.map((f) => (
                  <Figure key={f.id} s={f} imageUrls={imageUrls} />
                ))}
              </div>
            );
          case "one":
            return <SectionBlock key={run.section.id} s={run.section} Sub={Sub} imageUrls={imageUrls} />;
        }
      })}
    </>
  );
}

/** One section on its own, in the page's style: what SectionsView draws for a lone section, and the editor's preview while arranging. */
export function SectionBlock({ s, Sub, imageUrls }: { s: Section; Sub: Sub; imageUrls: ImageUrls }) {
  switch (s.kind) {
    case "findings":
      return (
        <div className="xp-section">
          <Findings s={s} Sub={Sub} />
        </div>
      );
    case "graph":
    case "image":
      return s.kind === "image" && !imageUrls[s.fileId] ? null : (
        <div className="xp-section">
          <Figure s={s} imageUrls={imageUrls} />
        </div>
      );
    case "quote":
      return (
        <section aria-labelledby={`${s.id}-h`} data-part="quote" className="xp-section break-inside-avoid">
          <Sub id={`${s.id}-h`} className="xp-label">
            Feedback
          </Sub>
          <figure className="xp-quote m-0 mt-2 border-l-[3px] pl-4">
            <blockquote className="text-[1.125rem] leading-relaxed">“{s.text.trim()}”</blockquote>
            {(s.name.trim() || s.role.trim()) && (
              <figcaption className="xp-muted mt-1.5 text-sm">{[s.name.trim(), s.role.trim()].filter(Boolean).join(", ")}</figcaption>
            )}
          </figure>
        </section>
      );
    case "reflection":
      return (
        <section aria-labelledby={`${s.id}-h`} data-part="reflection" className="xp-section xp-next break-inside-avoid border-t pt-6 print:pt-3">
          <Sub id={`${s.id}-h`} className="xp-label">
            What I&apos;d do next
          </Sub>
          <p className="mt-2 max-w-[42rem] text-[1.125rem] leading-relaxed">
            <RichText value={s.text} />
          </p>
        </section>
      );
    case "link": {
      const href = safeHref(s.href);
      const label = s.label.trim() || "Link";
      return (
        <section aria-label="Link" data-part="link" className="xp-section break-inside-avoid">
          <div className="xp-card px-5 py-4">
            {href ? (
              <a href={href} rel="nofollow ugc noopener" target="_blank" className="xp-link inline-flex items-center gap-1.5 font-semibold">
                {label}
                <ArrowUpRight aria-hidden size={16} strokeWidth={2.25} />
              </a>
            ) : (
              <p className="font-semibold">{label}</p>
            )}
            {s.description.trim() && <p className="xp-muted mt-0.5 text-sm">{s.description.trim()}</p>}
          </div>
        </section>
      );
    }
  }
}

/** "What I found": a heading over a rule, then the findings as a ruled list. */
function Findings({ s, Sub }: { s: SectionOf<"findings">; Sub: Sub }) {
  return (
    <section aria-labelledby={`${s.id}-h`} data-part="findings" className="min-w-0 break-inside-avoid">
      <Sub id={`${s.id}-h`} className="xp-found-heading xp-display border-b pb-3 text-[1.5rem] leading-tight print:text-[1.35rem]">
        What I found
      </Sub>
      <ul>
        {s.items.map((f, i) => (
          <li key={i} className="xp-finding border-b py-3.5 text-[1rem] leading-relaxed last:border-b-0 print:py-2 print:text-[0.95rem]">
            <RichText value={f} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/** A graph or an image in its card: the key chart beside the findings, or on its own. */
function Figure({ s, imageUrls }: { s: SectionOf<"graph"> | SectionOf<"image">; imageUrls: ImageUrls }) {
  if (s.kind === "graph") {
    return (
      <div className="xp-figure min-w-0 break-inside-avoid p-5 print:p-3" data-part="graph">
        <Chart data={s.chart} />
      </div>
    );
  }
  const src = imageUrls[s.fileId];
  if (!src) return null;
  return (
    <figure className="xp-figure m-0 min-w-0 break-inside-avoid p-4 print:p-3" data-part="image">
      <img src={src} alt={s.alt} className="w-full rounded-[max(0px,calc(var(--xp-radius-card)-8px))] print:max-h-[62mm] print:w-auto" />
      {s.caption.length > 0 && (
        <figcaption className="xp-muted mt-2.5 text-sm leading-snug">
          <RichText value={s.caption} />
        </figcaption>
      )}
    </figure>
  );
}
