import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DemoNote } from "@/components/home/DemoNote";
import { ProjectPager } from "@/components/portfolio/ProjectNav";
import { ProjectView } from "@/components/portfolio/ProjectView";
import { demoExhbts, demoOwner } from "@/lib/exhbt";
import { marketingMetadata } from "@/lib/seo";

export function generateStaticParams() {
  return demoExhbts.map((e) => ({ slug: e.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const e = demoExhbts.find((x) => x.slug === slug);
  if (!e) return { title: "Not found" };
  return marketingMetadata("demo", { title: `${e.doc.title} (demo)`, description: e.doc.summary, path: `/demo/${e.slug}` });
}

/**
 * One exhbt opened from the demo portfolio, drawn by the real exhbt page (ProjectView, decision 0022)
 * in the frame a live one sits in: a white column, the previous and next below. The work itself
 * isn't attached, because the project is made up, so there's no "See the work" button.
 */
export default async function DemoExhbt({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const i = demoExhbts.findIndex((x) => x.slug === slug);
  if (i < 0) notFound();
  const e = demoExhbts[i]!;
  return (
    <>
      <DemoNote>
        <span className="font-semibold">Example exhbt.</span> {demoOwner.name} and this project are made up, so there&rsquo;s
        no file to open.
      </DemoNote>
      <div className="mx-auto max-w-[64rem] px-4 pt-8 pb-16 sm:px-8 sm:pt-12">
        <ProjectView
          doc={e.doc}
          owner={{ name: demoOwner.name, photoUrl: null, bio: demoOwner.headline, homeHref: "/demo" }}
          checkedOn={e.checkedOn}
          headingLevel="h1"
        />
        <ProjectPager base="/demo" prev={demoExhbts[i - 1]} next={demoExhbts[i + 1]} />
      </div>
    </>
  );
}
