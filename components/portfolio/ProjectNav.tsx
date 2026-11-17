import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";

type Neighbour = { slug: string; doc: { title: string } } | undefined;

/* The way back ("All of <name>'s work") and "Save as PDF" are in the exhbt page's sidebar (ProjectView, decision 0022). */

/** Previous and next, as cards in the person's look (decision 0018). When only one exists it takes the full width, so there's no empty half. Not printed. */
export function ProjectPager({ base, prev, next }: { base: string; prev: Neighbour; next: Neighbour }) {
  if (!prev && !next) return null;
  const both = Boolean(prev && next);
  const card =
    "rounded-[var(--pf-radius,14px)] border-[length:var(--pf-edge-width,1px)] border-[color:var(--pf-edge,var(--color-line))] bg-[var(--pf-card,var(--color-surface))] p-4 text-[color:var(--pf-ink,var(--color-ink))] transition-colors hover:border-[color:var(--pf-ink,var(--color-ink))]";
  const label = "inline-flex items-center gap-1 text-[0.8125rem] text-[color:var(--pf-soft,var(--color-graphite))]";
  const title = "pf-display mt-1 block text-[1.0625rem] leading-snug [letter-spacing:calc(var(--pf-tracking,-0.02em)*0.4)]";
  return (
    <nav aria-label="Other projects" className={`mt-6 grid gap-3 print:hidden ${both ? "sm:grid-cols-2" : ""}`}>
      {prev && (
        <Link href={`${base}/${prev.slug}`} className={card}>
          <span className={label}>
            <ArrowLeft aria-hidden size={13} /> Previous
          </span>
          <span className={title}>{prev.doc.title}</span>
        </Link>
      )}
      {next && (
        <Link href={`${base}/${next.slug}`} className={`${card} ${both ? "sm:text-right" : ""}`}>
          <span className={label}>
            Next <ArrowRight aria-hidden size={13} />
          </span>
          <span className={title}>{next.doc.title}</span>
        </Link>
      )}
    </nav>
  );
}

/** Only on paper: where the live version is. */
export function PrintAddress({ address }: { address: string }) {
  return (
    <p className="mt-4 hidden text-center font-mono text-[0.75rem] text-[color:var(--pf-faint,var(--color-slate))] print:block" data-print-address>
      {address}
    </p>
  );
}
