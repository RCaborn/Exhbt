import { Check } from "lucide-react";

const CHECKS = ["Confirmed by author", "Source attached"] as const;

/**
 * The system-generated trust line. Green fill with navy ticks: the accent colour
 * marks "verified". With `animate`, ticks fill in sequence on load.
 */
export function TrustBadge({
  checkedOn,
  animate = false,
  originalityPassed = false,
}: {
  checkedOn?: string;
  animate?: boolean;
  /** Only true when this exhbt actually passed an originality check (recorded in originality_checks). Never assumed. */
  originalityPassed?: boolean;
}) {
  const checks: readonly string[] = originalityPassed ? [...CHECKS, "Originality checked"] : CHECKS;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
      <ul className="flex flex-wrap gap-x-4 gap-y-1.5" aria-label="Checks passed">
        {checks.map((c, i) => (
          <li key={c} className="inline-flex items-center gap-1.5 font-medium text-ink">
            <span
              className={`inline-flex size-[18px] items-center justify-center rounded-full border border-ink bg-mint ${animate ? "tick-in" : ""}`}
              style={animate ? { animationDelay: `${400 + i * 180}ms` } : undefined}
            >
              <Check aria-hidden size={11} strokeWidth={3} />
            </span>
            {c}
          </li>
        ))}
      </ul>
      {checkedOn && <span className="font-mono text-xs text-graphite">{checkedOn}</span>}
    </div>
  );
}
