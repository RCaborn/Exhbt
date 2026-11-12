/* eslint-disable @next/next/no-img-element -- signed Storage URLs; see Avatar.tsx. */
import { ArrowUpRight } from "lucide-react";
import { BeforeAfterChart } from "@/components/exhbt/BeforeAfterChart";
import { MethodFlow } from "@/components/exhbt/MethodFlow";
import { RichText } from "@/components/exhbt/RichText";
import { TrustBadge } from "@/components/exhbt/TrustBadge";
import { Avatar } from "@/components/portfolio/Avatar";
import { type ExhbtDoc } from "@/lib/exhbt/blocks";

export type Owner = { name: string; photoUrl: string | null };

/** Section labels, as components/exhbt/Exhbt.tsx draws them. Real headings, small and quiet. */
const LABEL = "font-mono text-[0.7rem] font-normal tracking-wide text-slate";

/**
 * One exhbt, in the layout Rory set (12 Nov 2026; docs/decisions/0007):
 * photo and name top left, skill boxes top right, title and context; then the gap, the process
 * flowchart, findings, graphs and images; the work and the checks at the foot.
 * A recruiter skims: short sections, bullets, nothing longer than it needs to be.
 */
export function ProjectView({
  doc,
  owner,
  imageUrls = {},
  evidenceUrl,
  checkedOn,
  headingLevel = "h1",
}: {
  doc: ExhbtDoc;
  owner: Owner;
  /** fileId → signed URL. Images without one are left out. */
  imageUrls?: Record<string, string | null>;
  /** Signed URL for a file, or the link itself. */
  evidenceUrl?: string | null;
  checkedOn?: string;
  headingLevel?: "h1" | "h2";
}) {
  const H = headingLevel;
  const Sub = headingLevel === "h1" ? "h2" : "h3";
  const images = doc.images.filter((im) => imageUrls[im.fileId]);
  return (
    <article className="@container rounded-[20px] border border-line bg-surface p-5 sm:p-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3">
          <Avatar name={owner.name} photoUrl={owner.photoUrl} size={44} />
          <p className="font-semibold">{owner.name}</p>
        </div>
        {doc.skills.length > 0 && (
          <ul aria-label="Skills used" className="flex flex-wrap gap-1.5 sm:max-w-[60%] sm:justify-end">
            {doc.skills.map((s) => (
              <li key={s} className="rounded-[6px] border border-line bg-mist px-2 py-1 font-mono text-[0.76rem] text-ink">
                {s}
              </li>
            ))}
          </ul>
        )}
      </header>

      <H className="mt-6 text-[1.6rem] leading-tight sm:text-[2rem]">{doc.title}</H>
      {doc.context && <p className="mt-1.5 text-graphite">{doc.context}</p>}

      <section aria-labelledby="gap" className="mt-6">
        <Sub id="gap" className={LABEL}>the question</Sub>
        <p className="mt-1.5 text-[1.05rem] leading-relaxed">
          <RichText value={doc.gap} />
        </p>
      </section>

      <section aria-labelledby="process" className="mt-6">
        <Sub id="process" className={LABEL}>process</Sub>
        <div className="mt-2">
          <MethodFlow steps={doc.flow} />
        </div>
      </section>

      <section aria-labelledby="findings" className="mt-6">
        <Sub id="findings" className={LABEL}>findings</Sub>
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
        <section aria-label="Graphs" className={`mt-7 grid gap-6 ${doc.charts.length > 1 ? "@3xl:grid-cols-2" : ""}`}>
          {doc.charts.map((c, i) => (
            <BeforeAfterChart key={i} data={c} />
          ))}
        </section>
      )}

      {images.length > 0 && (
        <section aria-label="Images" className={`mt-7 grid gap-4 ${images.length > 1 ? "@2xl:grid-cols-2" : ""}`}>
          {images.map((im) => (
            <figure key={im.fileId} className="m-0">
              <img src={imageUrls[im.fileId]!} alt={im.alt} className="w-full rounded-[12px] border border-line" />
              {im.caption.length > 0 && (
                <figcaption className="mt-1.5 text-sm text-graphite">
                  <RichText value={im.caption} />
                </figcaption>
              )}
            </figure>
          ))}
        </section>
      )}

      <footer className="mt-8 flex flex-col gap-4 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
        {doc.evidence && evidenceUrl ? (
          <a href={evidenceUrl} rel="nofollow ugc noopener" target="_blank" className="link inline-flex items-center gap-1.5 font-semibold text-ink">
            See the work: {doc.evidence.label}
            <ArrowUpRight aria-hidden size={16} strokeWidth={2.25} />
          </a>
        ) : (
          <span />
        )}
        <TrustBadge checkedOn={checkedOn} sourceAttached={Boolean(doc.evidence)} />
      </footer>
    </article>
  );
}
