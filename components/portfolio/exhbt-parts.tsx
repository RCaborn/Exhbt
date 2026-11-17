/* eslint-disable @next/next/no-img-element -- signed Storage URLs; see Avatar.tsx. */
import { ArrowUpRight } from "lucide-react";
import { Chart } from "@/components/charts/Chart";
import { RichText } from "@/components/exhbt/RichText";
import { ImageZoom } from "@/components/portfolio/ImageZoom";
import { safeHref, type Section, type SectionOf } from "@/lib/exhbt/blocks";
import { FORMAT_COPY, type Format } from "@/lib/exhbt/formats";

/**
 * The parts of an exhbt page that more than one layout draws (decision 0024): the findings, a
 * figure and any one section on its own. The case study's page (ProjectView) and the gallery and
 * research pages (components/portfolio/formats/) share them. Server-safe, no hooks. Their
 * defaults are the case study's, so its output is as it was.
 */

export type Sub = "h2" | "h3";
export type ImageUrls = Record<string, string | null>;

/** A heading over a rule, then the findings as a ruled list. "What I found", "What happened" or "Results". */
export function Findings({ s, Sub, heading = "What I found", part = "findings" }: { s: SectionOf<"findings">; Sub: Sub; heading?: string; part?: string }) {
  return (
    <section aria-labelledby={`${s.id}-h`} data-part={part} className="min-w-0 break-inside-avoid">
      <Sub id={`${s.id}-h`} className="xp-found-heading xp-display border-b pb-3 text-[1.5rem] leading-tight print:pb-1.5 print:text-[1.25rem]">
        {heading}
      </Sub>
      <ul>
        {s.items.map((f, i) => (
          <li key={i} className="xp-finding border-b py-3.5 text-[0.9375rem] leading-relaxed last:border-b-0 print:py-1 print:text-[0.9rem] print:leading-snug">
            <RichText value={f} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * A graph or an image in its card: the key chart beside the findings, or on its own. With `zoom`
 * an image opens larger in a dialog (gallery and research). With `big` an image is roomier: the
 * research poster's key figure, never cropped, at most 34rem tall (80mm in print).
 */
export function Figure({ s, imageUrls, zoom = false, big = false }: { s: SectionOf<"graph"> | SectionOf<"image">; imageUrls: ImageUrls; zoom?: boolean; big?: boolean }) {
  if (s.kind === "graph") {
    return (
      <div className="xp-figure min-w-0 break-inside-avoid p-5 print:p-3" data-part="graph">
        <Chart data={s.chart} />
      </div>
    );
  }
  const src = imageUrls[s.fileId];
  if (!src) return null;
  const radius = "rounded-[max(0px,calc(var(--xp-radius-card)-8px))]";
  return (
    <figure className={`xp-figure m-0 min-w-0 break-inside-avoid ${big ? "p-5" : "p-4"} print:p-3`} data-part="image">
      {zoom ? (
        <ImageZoom
          src={src}
          alt={s.alt}
          caption={s.caption}
          w={s.w}
          h={s.h}
          className="mx-auto w-full cursor-zoom-in"
          imgClassName={`mx-auto h-auto max-h-[34rem] w-auto max-w-full object-contain ${radius} ${big ? "print:max-h-[68mm]" : "print:max-h-[34mm]"}`}
        />
      ) : (
        <img src={src} alt={s.alt} width={s.w} height={s.h} className={`w-full ${radius} print:max-h-[62mm] print:w-auto`} />
      )}
      {s.caption.length > 0 && (
        <figcaption className="xp-muted mt-2.5 text-sm leading-snug">
          <RichText value={s.caption} />
        </figcaption>
      )}
    </figure>
  );
}

/** One section on its own, in the page's style: what a lone section is drawn as, and the editor's preview while arranging. */
export function SectionBlock({ s, Sub, imageUrls, format = "case-study" }: { s: Section; Sub: Sub; imageUrls: ImageUrls; format?: Format }) {
  const copy = FORMAT_COPY[format];
  switch (s.kind) {
    case "findings":
      return (
        <div className="xp-section">
          <Findings s={s} Sub={Sub} heading={copy.findings} />
        </div>
      );
    case "graph":
    case "image":
      return s.kind === "image" && !imageUrls[s.fileId] ? null : (
        <div className="xp-section">
          <Figure s={s} imageUrls={imageUrls} zoom={format !== "case-study"} />
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
        <section aria-labelledby={`${s.id}-h`} data-part="reflection" className="xp-section xp-next break-inside-avoid border-t pt-6 print:pt-2">
          <Sub id={`${s.id}-h`} className="xp-label">
            {copy.reflection}
          </Sub>
          <p className="mt-2 max-w-[42rem] text-[1.125rem] leading-relaxed">
            <RichText value={s.text} />
          </p>
        </section>
      );
    case "aim":
    case "conclusion":
      // Only research draws these; elsewhere they are kept but not shown (decision 0024).
      if (format !== "research") return null;
      return (
        <section aria-labelledby={`${s.id}-h`} data-part={s.kind} className="xp-section break-inside-avoid">
          <Sub id={`${s.id}-h`} className="xp-label">
            {s.kind === "conclusion" ? "Conclusion" : s.heading === "hypothesis" ? "Hypothesis" : "Aim"}
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
        <section aria-label={copy.link} data-part="link" className="xp-section break-inside-avoid">
          <div className="xp-card px-5 py-4 print:px-3 print:py-2">
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
