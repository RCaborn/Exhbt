import { ProjectView } from "@/components/portfolio/ProjectView";
import { lookAttrs, themeStyle } from "@/components/portfolio/themeFonts";
import type { LookId } from "@/lib/portfolio-themes";
import { exhbtOf, lookOf, sample } from "../samples";

/** Where an exhbt is in its life, as its own page shows it in the "Can you trust it?" checks. */
export type PageStage = "draft" | "live";

/**
 * One of the sample person's exhbts, drawn by the real exhbt page (ProjectView) in her look, at a
 * point in its life: a draft ("Not confirmed yet", "Checked when published", both hollow) or live
 * (confirmed and checked, both filled). The lab's SampleExhbt can't draw an unconfirmed draft, so
 * the finish draws the page itself, the same way. The page is hers: nothing here restyles it.
 */
export function PersonExhbt({ slug, stage, look, className = "p-4 sm:p-6 lg:p-8" }: { slug?: string; stage: PageStage; look?: LookId; className?: string }) {
  const e = exhbtOf(slug);
  const theme = lookOf(look);
  return (
    <div {...lookAttrs(theme)} style={themeStyle(theme)} className={`bg-[var(--pf-ground)] text-[color:var(--pf-ink)] ${className}`}>
      <ProjectView
        doc={e.doc}
        owner={{ name: sample.owner.name, photoUrl: null, bio: sample.owner.headline, homeHref: "/demo" }}
        evidenceUrl="#"
        confirmed={stage === "live"}
        checkedOn={stage === "live" ? e.checkedOn : undefined}
        headingLevel="h2"
      />
    </div>
  );
}
