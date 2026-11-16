import { Check } from "lucide-react";

/**
 * The system-generated trust line. Mint fill with ink ticks for a check that has passed.
 * A check that hasn't (yet) is drawn hollow, with its own wording, so the badge never claims
 * more than happened. With `animate`, ticks fill in sequence on load.
 */
export function TrustBadge({
  checkedOn,
  animate = false,
  originalityPassed = false,
  sourceAttached = true,
  confirmed = true,
}: {
  checkedOn?: string;
  animate?: boolean;
  /** Only true when this exhbt actually passed an originality check (recorded in originality_checks). Never assumed. */
  originalityPassed?: boolean;
  /** False when the exhbt links no work, so the badge doesn't claim one. */
  sourceAttached?: boolean;
  /** False in the editor until the author ticks "This is my own work". Published exhbts are always confirmed. */
  confirmed?: boolean;
}) {
  const checks: { label: string; passed: boolean }[] = [
    confirmed ? { label: "Confirmed by author", passed: true } : { label: "Not confirmed yet", passed: false },
  ];
  if (sourceAttached) checks.push({ label: "Source attached", passed: true });
  if (originalityPassed) checks.push({ label: "Originality checked", passed: true });
  const passed = checks.filter((c) => c.passed);
  const pending = checks.filter((c) => !c.passed);
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
      {passed.length > 0 && (
        <ul className="flex flex-wrap gap-x-4 gap-y-1.5" aria-label="Checks passed">
          {passed.map((c, i) => (
            <li key={c.label} className="inline-flex items-center gap-1.5 font-medium text-ink">
              <span
                className={`inline-flex size-[18px] items-center justify-center rounded-full border border-ink bg-mint ${animate ? "tick-in" : ""}`}
                style={animate ? { animationDelay: `${400 + i * 180}ms` } : undefined}
              >
                <Check aria-hidden size={11} strokeWidth={3} />
              </span>
              {c.label}
            </li>
          ))}
        </ul>
      )}
      {pending.length > 0 && (
        <ul className="flex flex-wrap gap-x-4 gap-y-1.5" aria-label="Checks not passed yet">
          {pending.map((c) => (
            <li key={c.label} className="inline-flex items-center gap-1.5 font-medium text-graphite">
              <span aria-hidden className="inline-flex size-[18px] rounded-full border border-dashed border-field bg-surface" />
              {c.label}
            </li>
          ))}
        </ul>
      )}
      {checkedOn && <span className="font-mono text-xs text-graphite">{checkedOn}</span>}
    </div>
  );
}
