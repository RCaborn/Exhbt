import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";

type Neighbour = { slug: string; doc: { title: string } } | undefined;

/* The way back ("All of <name>'s work") and "Save as PDF" are in the exhbt page's sidebar (ProjectView, decision 0022). */

/** Previous and next. When only one exists it takes the full width, so there's no empty half. Not printed. */
export function ProjectPager({ base, prev, next }: { base: string; prev: Neighbour; next: Neighbour }) {
  if (!prev && !next) return null;
  const both = Boolean(prev && next);
  const card = "rounded-[14px] border border-line bg-surface p-4 hover:border-ink";
  return (
    <nav aria-label="Other projects" className={`mt-6 grid gap-3 print:hidden ${both ? "sm:grid-cols-2" : ""}`}>
      {prev && (
        <Link href={`${base}/${prev.slug}`} className={card}>
          <span className="inline-flex items-center gap-1 text-[0.8125rem] text-graphite"><ArrowLeft aria-hidden size={13} /> Previous</span>
          <span className="mt-1 block font-semibold">{prev.doc.title}</span>
        </Link>
      )}
      {next && (
        <Link href={`${base}/${next.slug}`} className={`${card} ${both ? "sm:text-right" : ""}`}>
          <span className="inline-flex items-center gap-1 text-[0.8125rem] text-graphite">Next <ArrowRight aria-hidden size={13} /></span>
          <span className="mt-1 block font-semibold">{next.doc.title}</span>
        </Link>
      )}
    </nav>
  );
}

/** Only on paper: where the live version is. */
export function PrintAddress({ address }: { address: string }) {
  return <p className="mt-4 hidden text-center font-mono text-[0.75rem] text-slate print:block" data-print-address>{address}</p>;
}
