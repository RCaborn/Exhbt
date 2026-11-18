import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Lab } from "@/components/lab/Lab";
import { isLabLook, isVersion } from "@/components/lab/options";
import { isSampleId } from "@/components/lab/samples";
import { isLabEnabled } from "@/lib/site";

/**
 * The editor lab: a try-out of editing an exhbt on the page, with two versions of drag and drop
 * (docs/briefs/edit-on-page/drag-prototype.md). Not part of the product: no sign-in, nothing
 * stored, never indexed, and not found unless the lab is switched on (isLabEnabled in
 * lib/site.ts: development, tests and the preview site only).
 *
 * Read at request time, never at build time, so one build serves both answers.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Editor lab",
  robots: { index: false, follow: false },
};

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function LabEditorPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (!isLabEnabled()) notFound();
  const q = await searchParams;
  const sample = one(q.sample);
  const look = one(q.look);
  const version = one(q.v);
  return (
    <Lab
      initial={{
        sample: isSampleId(sample) ? sample : "case-study",
        look: isLabLook(look) ? look : "exhbt",
        version: isVersion(version) ? version : "mix",
        read: one(q.read) === "1",
        grow: one(q.grow) === "mirror" ? "mirror" : "css",
      }}
    />
  );
}
