import { Tick } from "@/components/ui/Tick";

/** A tier's features as a ticked checklist. */
export function FeatureList({ items, className = "" }: { items: string[]; className?: string }) {
  return (
    <ul className={`space-y-2 ${className}`}>
      {items.map((t) => (
        <li key={t} className="flex gap-2.5">
          <Tick size="sm" className="mt-[3px]" />
          <span>{t}</span>
        </li>
      ))}
    </ul>
  );
}
