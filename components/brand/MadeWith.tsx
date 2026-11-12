import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Logo } from "./Logo";

/**
 * Sign-off at the foot of every public portfolio and exhbt. Employers are the
 * people reading these pages, so it is also how the next student finds us.
 */
export function MadeWith({ startHref = "/start" }: { startHref?: string }) {
  return (
    <aside
      aria-label="Made with exhbt"
      className="mt-14 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 border-t border-line pt-6 text-sm text-graphite"
    >
      <span className="inline-flex items-center gap-2">
        Portfolio made with <Logo size="sm" className="text-ink" />
      </span>
      <span aria-hidden className="hidden text-field sm:inline">·</span>
      <Link href={startHref} className="link inline-flex items-center gap-1 font-semibold text-ink">
        Build your own roadmap <ArrowRight aria-hidden size={14} strokeWidth={2.25} />
      </Link>
    </aside>
  );
}
