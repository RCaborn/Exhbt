import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Logo } from "./Logo";

/**
 * Sign-off at the foot of every public portfolio and exhbt. Employers are the
 * people reading these pages, so it is also how the next student finds us.
 * On a portfolio it takes the person's look (the --pf-* colours, decision 0018); the mark keeps its own.
 */
export function MadeWith({ startHref = "/start" }: { startHref?: string }) {
  return (
    <aside
      aria-label="Made with exhbt"
      className="mt-14 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 border-t border-[color:var(--pf-line,var(--color-line))] pt-6 text-sm text-[color:var(--pf-soft,var(--color-graphite))] print:hidden"
    >
      <span className="inline-flex items-center gap-2">
        Portfolio made with <Logo size="sm" className="text-[color:var(--pf-ink,var(--color-ink))]" />
      </span>
      <span aria-hidden className="hidden text-[color:var(--pf-faint,var(--color-field))] sm:inline">·</span>
      <Link href={startHref} className="link inline-flex items-center gap-1 font-semibold text-[color:var(--pf-ink,var(--color-ink))]">
        Build your own roadmap <ArrowRight aria-hidden size={14} strokeWidth={2.25} />
      </Link>
    </aside>
  );
}
