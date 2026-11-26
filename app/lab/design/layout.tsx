import type { Metadata } from "next";
import { notFound } from "next/navigation";
// The proposed theme first, then the lab's own stylesheet. Both come after app/globals.css
// (the root layout), which declares the cascade-layer order they slot into.
import "@/themes/exhbt-next/exhbt-next.css";
import "@/components/lab/lab.css";
import { LabFrame } from "@/components/lab/LabFrame";
import { labEnabled, readLab } from "@/components/lab/server";

// Never indexed. The lab's name is in the title only where the lab answers.
export function generateMetadata(): Metadata {
  const robots = { index: false, follow: false };
  return labEnabled() ? { title: { default: "Design lab", template: "%s · Design lab" }, robots } : { robots };
}
// The gate is read on each request, so one build serves the preview Worker (EXHBT_LAB=1) and the live one (never set).
export const dynamic = "force-dynamic";

/*
 * The design lab (Rory, 26 Nov 2026): design mock-ups to choose from, built with the real
 * components on sample data. It is not part of the product: no sign-in, no database, no AI,
 * nothing stored but three cookies for its own switches, never indexed.
 *
 * Everything under /lab/design is not found unless NODE_ENV is not production or EXHBT_LAB=1
 * (labEnabled, the rule app/dev/editor-timing uses). The preview Worker sets it in wrangler.jsonc;
 * the live Worker never does.
 *
 * Inside, every page gets the proposed theme (themes/exhbt-next), the lab bar and the level and
 * motion switches from LabFrame. The site's own layout and theme are outside it and unchanged.
 */
export default async function LabLayout({ children }: { children: React.ReactNode }) {
  if (!labEnabled()) notFound();
  return <LabFrame initial={await readLab()}>{children}</LabFrame>;
}
