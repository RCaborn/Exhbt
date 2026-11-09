import { Check } from "lucide-react";

/** A tier's features as a ticked checklist. */
export function FeatureList({ items, className = "" }: { items: string[]; className?: string }) {
  return (
    <ul className={`space-y-2 ${className}`}>
      {items.map((t) => (
        <li key={t} className="flex gap-2.5">
          <span className="mt-[3px] inline-flex size-[18px] shrink-0 items-center justify-center rounded-full border border-ink bg-mint">
            <Check aria-hidden size={11} strokeWidth={3} />
          </span>
          <span>{t}</span>
        </li>
      ))}
    </ul>
  );
}
