"use client";

/* eslint-disable @next/next/no-img-element -- pictures here are data addresses made in the browser; see components/portfolio/Avatar.tsx. */
import { memo } from "react";
import { MethodFlow } from "@/components/exhbt/MethodFlow";
import { Figure, Findings, SectionBlock, type Sub } from "@/components/portfolio/exhbt-parts";
import { plain, type SectionOf } from "@/lib/exhbt/blocks";
import { FORMAT_COPY } from "@/lib/exhbt/formats";
import { AutoText } from "./fields";
import { LabFlow } from "./LabFlow";
import { FLOW_ID, type LabDoc } from "./samples";
import { useLab, useLabStore, useRenderCount } from "./store";

/** The exhbt's title is the page's h1, so its sections are headed h2 (as ProjectView does). */
const SUB: Sub = "h2";

/**
 * One item of the page, as it is edited in place. Findings, an image's caption and the flowchart
 * are typed on the page, so they are drawn here with the page's own markup and classes and a
 * field where the words go (copies of Findings, Figure and the page's MethodFlow, which have no
 * place to put a field). A graph, a quote, what I'd do next, a link, the aim and the conclusion
 * are the page's real parts, untouched.
 *
 * It reads its own slice of the doc, so it renders again only when its own words change.
 */
export const SectionContent = memo(function SectionContent({ id }: { id: string }) {
  if (id === FLOW_ID) return <LabFlow />;
  return <EditableSection id={id} />;
});

function EditableSection({ id }: { id: string }) {
  const s = useLab((d) => d.sections[id]);
  const format = useLab((d) => d.format);
  const imageUrls = useLab((d) => d.imageUrls);
  useRenderCount(id);
  if (!s) return null;
  switch (s.kind) {
    case "findings":
      return <EditableFindings s={s} heading={FORMAT_COPY[format].findings} />;
    case "image":
      return <EditableImage s={s} src={imageUrls[s.fileId] ?? null} />;
    case "graph":
      return <Figure s={s} imageUrls={imageUrls} />;
    default:
      return <SectionBlock s={s} Sub={SUB} imageUrls={imageUrls} format={format} />;
  }
}

/** Findings (components/portfolio/exhbt-parts.tsx), with each point a field. */
function EditableFindings({ s, heading }: { s: SectionOf<"findings">; heading: string }) {
  const store = useLabStore();
  return (
    <section aria-labelledby={`${s.id}-h`} data-part="findings" className="min-w-0 break-inside-avoid">
      <SUB id={`${s.id}-h`} className="xp-found-heading xp-display border-b pb-3 text-[1.5rem] leading-tight">
        {heading}
      </SUB>
      <ul>
        {s.items.map((f, i) => (
          <li key={i} className="xp-finding border-b py-3.5 text-[0.9375rem] leading-relaxed last:border-b-0">
            <AutoText label={`Finding ${i + 1}`} value={plain(f)} placeholder="Type a finding" onChange={(v) => store.setFinding(s.id, i, v)} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/** An image in its card (Figure in components/portfolio/exhbt-parts.tsx), with the caption a field. */
function EditableImage({ s, src }: { s: SectionOf<"image">; src: string | null }) {
  const store = useLabStore();
  if (!src) return null;
  return (
    <figure className="xp-figure m-0 min-w-0 break-inside-avoid p-4" data-part="image">
      <img src={src} alt={s.alt} width={s.w} height={s.h} draggable={false} className="w-full rounded-[max(0px,calc(var(--xp-radius-card)-8px))]" />
      <figcaption className="xp-muted mt-2.5 text-sm leading-snug">
        <AutoText label={`Caption: ${s.alt}`} value={plain(s.caption)} placeholder="Add a caption" onChange={(v) => store.setCaption(s.id, v)} />
      </figcaption>
    </figure>
  );
}

/**
 * One item as the published page draws it, with nothing to type in: the lifted copy that follows
 * the pointer, and the whole page when the lab is opened read-only. `prefix` keeps the copy's ids
 * apart from the ones already on the page.
 */
export function StaticSection({ doc, id, prefix = "" }: { doc: LabDoc; id: string; prefix?: string }) {
  if (id === FLOW_ID) {
    return (
      <section aria-label="Process" data-part="process" className="break-inside-avoid">
        <MethodFlow steps={doc.flow} variant="page" />
      </section>
    );
  }
  const stored = doc.sections[id];
  if (!stored) return null;
  const s = prefix ? { ...stored, id: `${prefix}${stored.id}` } : stored;
  switch (s.kind) {
    case "findings":
      return <Findings s={s} Sub={SUB} heading={FORMAT_COPY[doc.format].findings} />;
    case "graph":
    case "image":
      return <Figure s={s} imageUrls={doc.imageUrls} />;
    default:
      return <SectionBlock s={s} Sub={SUB} imageUrls={doc.imageUrls} format={doc.format} />;
  }
}
