"use client";

import { createContext, useContext } from "react";
import { Check } from "lucide-react";

const CHECKS = ["Confirmed by author", "Source attached"] as const;

/**
 * Lets the editor's preview say whether the author has ticked the confirmation box without
 * touching ProjectView: wrap the preview in <TrustPreview confirmed={ticked}>. Outside a
 * provider (every public page) the badge treats the exhbt as confirmed, since only confirmed
 * exhbts can be published.
 */
const ConfirmedContext = createContext<boolean | undefined>(undefined);
export const TrustPreview = ({ confirmed, children }: { confirmed: boolean; children: React.ReactNode }) => (
  <ConfirmedContext.Provider value={confirmed}>{children}</ConfirmedContext.Provider>
);

/**
 * The system-generated trust line. Green fill with navy ticks: the accent colour
 * marks "verified". With `animate`, ticks fill in sequence on load.
 */
export function TrustBadge({
  checkedOn,
  animate = false,
  originalityPassed = false,
  sourceAttached = true,
  confirmed,
}: {
  checkedOn?: string;
  animate?: boolean;
  /** Only true when this exhbt actually passed an originality check (recorded in originality_checks). Never assumed. */
  originalityPassed?: boolean;
  /** False when the exhbt links no work, so the badge doesn't claim one. */
  sourceAttached?: boolean;
  /** False until the author has ticked the confirmation box (the editor preview). Defaults to the surrounding TrustPreview, else true. */
  confirmed?: boolean;
}) {
  const inherited = useContext(ConfirmedContext);
  const isConfirmed = confirmed ?? inherited ?? true;
  const checks: string[] = CHECKS.filter((c) => (sourceAttached || c !== "Source attached") && (isConfirmed || c !== "Confirmed by author"));
  if (originalityPassed) checks.push("Originality checked");
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
      {!isConfirmed && <span className="font-medium text-graphite">Not confirmed yet</span>}
      {checks.length > 0 && (
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
      )}
      {checkedOn && <span className="font-mono text-xs text-graphite">{checkedOn}</span>}
    </div>
  );
}
