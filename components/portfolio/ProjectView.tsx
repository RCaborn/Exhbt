import Link from "next/link";
import { Check } from "lucide-react";
import { CHECKS_GUIDE } from "@/components/brand/Seal";
import { MethodFlow } from "@/components/exhbt/MethodFlow";
import { RichText } from "@/components/exhbt/RichText";
import { Avatar } from "@/components/portfolio/Avatar";
import { Figure, Findings, SectionBlock, type ImageUrls, type Sub } from "@/components/portfolio/exhbt-parts";
import { GalleryMain } from "@/components/portfolio/formats/GalleryMain";
import { ResearchMain } from "@/components/portfolio/formats/ResearchMain";
import { PrintButton } from "@/components/portfolio/PrintButton";
import { Button } from "@/components/ui/Button";
import type { ExhbtDoc, Section, SectionOf } from "@/lib/exhbt/blocks";
import { formatOf, shownSections } from "@/lib/exhbt/formats";

/** The editor's arrange preview imports this from here. */
export { SectionBlock };

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
  back,
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
  /** "← Back to Lloyds", when the page was opened from a job page (?for=<slug>). */
  back?: { href: string; label: string };
}) {
  const H = headingLevel;
  const format = formatOf(doc);
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
    <article data-exhbt-page data-format={format} className="xp @container/xp">
      {back && (
        <p className="mb-5 print:hidden">
          <Link href={back.href} data-back-to-job className="xp-link text-[0.9375rem] font-semibold">
            <span aria-hidden>← </span>
            {back.label}
          </Link>
        </p>
      )}
      <div className="grid gap-8 @3xl/xp:grid-cols-[13.5rem_minmax(0,1fr)] @3xl/xp:gap-9 print:block">
        <aside aria-label={`About ${first} and this work`} className="xp-aside min-w-0 print:mb-3 print:grid print:grid-cols-[52mm_minmax(0,1fr)] print:gap-x-6 print:border-b print:pb-3">
          <div className="xp-card flex items-center gap-4 p-4 @3xl/xp:flex-col @3xl/xp:items-stretch @3xl/xp:gap-0 @3xl/xp:p-5 print:flex-row print:items-center print:gap-3 print:p-3">
            {/* One photo, sized by .xp-avatar in globals.css: 64px beside the name, 88px over it in the sidebar. */}
            <div className="xp-avatar shrink-0 @3xl/xp:mx-auto print:mx-0">
              <Avatar name={owner.name} photoUrl={owner.photoUrl} size={88} shape={owner.shape} />
            </div>
            <div className="min-w-0 @3xl/xp:mt-4 print:mt-0">
              <p className="xp-name xp-display text-[1.5rem] leading-tight @3xl/xp:text-[1.625rem] print:text-[1.3rem]">{owner.name}</p>
              {owner.bio?.trim() && <p className="xp-muted mt-1.5 text-[0.875rem] leading-snug">{owner.bio.trim()}</p>}
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

          {/* Stacked above the work, the facts sit side by side and the ticks in a row, so the question isn't pushed far down. */}
          <dl className="mt-4 grid grid-cols-1 gap-x-6 px-1 @md/xp:grid-cols-2 @3xl/xp:mt-6 @3xl/xp:block @3xl/xp:px-5 print:row-span-2 print:mt-0 print:grid print:grid-cols-3 print:gap-x-5 print:px-0">
            {kind && <Fact term="What it is">{kind}</Fact>}
            {whereWhen && <Fact term="Where and when">{whereWhen}</Fact>}
            <Fact term="Can you trust it?" wide>
              <ul aria-label="Can you trust it?" className="mt-1 flex flex-wrap gap-x-5 gap-y-1.5 @3xl/xp:block @3xl/xp:space-y-1.5 print:block print:space-y-1" data-checks>
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
            <div className="mt-6 print:mt-3">
              <Button href={evidenceUrl!} variant="primary" size="md" target="_blank" rel="nofollow ugc noopener" className="xp-work-button w-full" label={`See the work: ${doc.evidence!.label}`}>
                <span className="min-w-0">See the work: {doc.evidence!.label}</span>
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
          {team}

          <H className={`xp-title xp-display ${format === "gallery" ? "mt-3 @2xl/main:mt-5" : "mt-5"} text-[clamp(2rem,7cqi,3.4rem)] leading-[1.02] text-balance print:mt-2 print:text-[2rem]`}>
            {doc.title}
          </H>
          {doc.gap.length > 0 && (
            <p className={`xp-context ${format === "gallery" ? "mt-3 @2xl/main:mt-5" : "mt-5"} max-w-[42rem] text-[1.0625rem] leading-[1.6] @2xl/main:text-[1.1875rem] print:mt-2 print:text-[1rem]`}>
              <RichText value={doc.gap} highlight />
            </p>
          )}

          {format === "gallery" ? (
            <GalleryMain doc={doc} imageUrls={imageUrls} Sub={Sub} />
          ) : format === "research" ? (
            <ResearchMain doc={doc} imageUrls={imageUrls} Sub={Sub} />
          ) : (
            <>
              <section aria-label="Process" data-part="process" className="mt-8 break-inside-avoid print:mt-3">
                <MethodFlow steps={doc.flow} variant="page" />
              </section>

              {sectionsSlot ?? <SectionsView sections={shownSections(doc).map((x) => x.s)} imageUrls={imageUrls} Sub={Sub} />}
            </>
          )}
        </div>
      </div>
    </article>
  );
}

export function Fact({ term, children, wide = false }: { term: string; children: React.ReactNode; /** Both columns when the facts sit side by side. */ wide?: boolean }) {
  return (
    <div className={`xp-fact border-b py-3 last:border-b-0 @3xl/xp:first:pt-0 print:border-b-0 print:py-0 ${wide ? "@md/xp:col-span-2 print:col-span-1" : ""}`}>
      <dt className="xp-muted text-[0.78rem]">{term}</dt>
      <dd className="mt-0.5 text-[0.875rem] leading-snug font-semibold">{children}</dd>
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
