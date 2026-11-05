import { Check } from "lucide-react";

const CHECKS = ["Confirmed by author", "Source attached", "Originality checked"] as const;

export function TrustBadge({ checkedOn }: { checkedOn: string }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
      <ul className="flex flex-wrap gap-x-4 gap-y-1" aria-label="Checks passed">
        {CHECKS.map((c) => (
          <li key={c} className="inline-flex items-center gap-1.5 text-verify">
            <span className="inline-flex size-4 items-center justify-center rounded-full bg-verify-tint">
              <Check aria-hidden size={11} strokeWidth={2.5} />
            </span>
            {c}
          </li>
        ))}
      </ul>
      <span className="font-mono text-xs text-ink-2">{checkedOn}</span>
    </div>
  );
}
