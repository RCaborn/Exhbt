import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Exhbt } from "@/components/exhbt/Exhbt";
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
  const e = demoExhbts.find((x) => x.slug === slug);
  if (!e) notFound();
  return (
    <div className="bg-sky pb-24">
      <div className="mx-auto max-w-[56rem] px-4 pt-8 sm:px-8 sm:pt-12">
        <Link href="/demo" className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-2 hover:text-ink">
          <ArrowLeft aria-hidden size={16} strokeWidth={2.25} /> {demoOwner.name}&rsquo;s portfolio
        </Link>
        <div className="mt-5">
          <Exhbt exhbt={e} example headingLevel="h1" animateChecks />
        </div>
      </div>
    </div>
  );
}
