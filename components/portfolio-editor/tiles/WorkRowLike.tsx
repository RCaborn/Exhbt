import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";

/*
 * A row in the shape of the list and index looks' rows (PortfolioHome.tsx, `Work`), for the owner-only
 * tiles there. A stand-in drawn from the look's variables until PortfolioHome exports `WorkRow`: then
 * this file draws that, and nothing else changes.
 */
export function WorkRowLike({ title, summary, chip, action }: { title: string; summary?: string; chip?: ReactNode; action?: ReactNode }): ReactNode {
  return (
    <div className="flex gap-3 py-4">
      <ChevronRight aria-hidden size={18} strokeWidth={2} className="mt-[0.2em] shrink-0 text-[color:var(--pf-faint)]" />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-[1.125rem] leading-snug font-semibold">{title}</span>
          {chip}
        </span>
        {summary && <span className="mt-1 block text-[0.95rem] leading-relaxed text-[color:var(--pf-soft)]">{summary}</span>}
        {action && <span className="mt-2 block">{action}</span>}
      </span>
    </div>
  );
}
