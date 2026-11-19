import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProjectView } from "@/components/portfolio/ProjectView";
import { lookAttrs, themeStyle } from "@/components/portfolio/themeFonts";
import { formatOf } from "@/lib/exhbt/formats";
import { DEFAULT_THEME, themeById } from "@/lib/portfolio-themes";
import { isSupabaseConfigured } from "@/lib/store";
import { full, imageUrlsOf, isSample, SAMPLES, standIn } from "./stand-in";

export const metadata: Metadata = { title: "Edit slots", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * Development only: the slot harness (decision 0026, "One page, one renderer"). It draws the exhbt
 * page for a sample with a stand-in for the editor's adapter (./stand-in.tsx), which marks every
 * slot the page parts call and adds no box, so e2e/edit-slots.spec.ts can check that every field
 * is reachable and that the editing page sits where the visitor's page does.
 *
 *   ?sample=   case-study (the default), open-banking, library, gallery, research, build, essay,
 *              before-after, event, new; and pages out of their usual order (./orders.ts):
 *              arranged-case, arranged-gallery, gallery-flow-off, gallery-over-cap,
 *              arranged-research, research-no-aim, case-missing-image
 *   ?read=1    the same sample with no adapter: the visitor's page
 *   ?full=1    every empty optional part given words first (in this harness's own code)
 *   ?look=     a portfolio look's id (the Exhbt look by default)
 *
 * Not found in production or with a database configured, as the other development pages are.
 */
export default async function EditSlots({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (process.env.NODE_ENV === "production" || isSupabaseConfigured()) notFound();
  const q = await searchParams;
  const name = isSample(q.sample) ? q.sample : "case-study";
  const sample = SAMPLES[name]();
  const doc = q.full === "1" ? full(sample) : sample;
  const read = q.read === "1";
  const theme = (typeof q.look === "string" && themeById(q.look)) || DEFAULT_THEME;
  const imageUrls = imageUrlsOf(doc);
  const evidenceUrl = doc.evidence?.kind === "link" ? doc.evidence.href : doc.evidence ? "https://example.com/the-work.pdf" : null;
  const edit = read ? undefined : standIn(doc, { Sub: "h2", imageUrls, format: formatOf(doc) }, evidenceUrl);

  return (
    <div {...lookAttrs(theme)} style={themeStyle(theme)} data-edit-slots={read ? "read" : "edit"} data-sample={name} className="min-h-svh bg-[var(--pf-ground)] text-[color:var(--pf-ink)]">
      <main id="main" className="mx-auto max-w-[64rem] px-4 pt-8 pb-10 sm:px-8 sm:pt-12">
        <ProjectView
          doc={doc}
          owner={{ name: "Amara Okafor", photoUrl: null, shape: theme.photo, bio: "Final-year Data Science student.", homeHref: "/dev/edit-slots" }}
          imageUrls={imageUrls}
          evidenceUrl={evidenceUrl}
          checkedOn="15 January 2026"
          edit={edit}
        />
      </main>
    </div>
  );
}
