import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MadeWith } from "@/components/brand/MadeWith";
import { Exhbt } from "@/components/exhbt/Exhbt";
import { PortfolioBar } from "@/components/exhbt/PortfolioHeader";
import { demoExhbts, demoOwner } from "@/lib/exhbt";

export function generateStaticParams() {
  return demoExhbts.map((e) => ({ slug: e.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const e = demoExhbts.find((x) => x.slug === slug);
  return { title: e ? `${e.title} (demo)` : "Not found" };
}

/** One exhbt opened from the demo portfolio. */
export default async function DemoExhbt({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const index = demoExhbts.findIndex((x) => x.slug === slug);
  if (index < 0) notFound();
  const e = demoExhbts[index];
  return (
    <div className="bg-mist pb-16">
      <PortfolioBar owner={demoOwner} backHref="/demo" />
      <div className="mx-auto max-w-[56rem] px-4 pt-8 sm:px-8 sm:pt-10">
        <Exhbt exhbt={e} example headingLevel="h1" animateChecks position={index + 1} />
        <MadeWith />
      </div>
    </div>
  );
}
