import { Plus } from "lucide-react";

export type Question = { q: string; a: React.ReactNode };

/**
 * Questions as disclosures: each is a native <details>, so it opens with a click, Enter or Space,
 * is announced as expanded or collapsed, and works without JavaScript. Any number can be open.
 * Styling (the marker, the plus that turns to a cross) is `.faq` in globals.css.
 */
export function Faq({ items }: { items: Question[] }) {
  return (
    <div className="faq divide-y divide-line border-y border-line">
      {items.map((it) => (
        <details key={it.q} className="group">
          <summary className="flex min-h-14 items-center justify-between gap-6 py-4 text-[1.0625rem] font-semibold hover:text-jade">
            <span>{it.q}</span>
            <span aria-hidden className="inline-flex size-8 shrink-0 items-center justify-center rounded-full border border-line group-open:border-ink">
              <Plus data-faq-icon size={16} strokeWidth={2.25} />
            </span>
          </summary>
          <div className="max-w-[38rem] pb-6 text-graphite">{it.a}</div>
        </details>
      ))}
    </div>
  );
}
