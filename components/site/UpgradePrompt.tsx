import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { BILLING_PERIOD, PLAN_NAMES, PRICES, type Plan } from "@/lib/entitlements";

/**
 * The upgrade offer, shown only where a plan limit has just stopped something (publishing on
 * Free, the plan full, drafts used up). One sentence saying why, one button to billing, and a
 * link to compare plans. Wording comes from the plan rules (lib/plan-rules.ts, lib/drafting.ts)
 * and figures from lib/entitlements.ts; nothing here repeats a count.
 *
 * Without `upgradeTo` (already on the biggest plan) there's nothing to sell, so only the reason shows.
 */
export function UpgradePrompt({
  reason,
  upgradeTo,
  tone = "plain",
  primary = true,
  className = "",
}: {
  reason: string;
  upgradeTo?: Plan;
  /** False where the screen already has its own primary button (the editor's Publish). */
  primary?: boolean;
  /** "alert" for a refusal the person just hit (red, announced); "plain" for a standing notice. */
  tone?: "plain" | "alert";
  className?: string;
}) {
  const price = upgradeTo ? PRICES[upgradeTo] : undefined;
  return (
    <div
      role={tone === "alert" ? "alert" : "status"}
      data-testid="upgrade-prompt"
      className={
        tone === "alert"
          ? `rounded-[var(--radius)] border border-error/40 bg-surface px-4 py-3 ${className}`
          : `rounded-[14px] border border-line bg-wash px-4 py-3 ${className}`
      }
    >
      <p className={tone === "alert" ? "text-error" : ""}>{reason}</p>
      {upgradeTo && (
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          <Button href="/account/billing" variant={primary ? "primary" : "secondary"} size="sm">
            {`Upgrade to ${PLAN_NAMES[upgradeTo]}${price ? ` (${price} a ${BILLING_PERIOD})` : ""}`}
          </Button>
          <Link href="/pricing" className="link text-sm font-semibold text-ink">
            Compare plans
          </Link>
        </div>
      )}
    </div>
  );
}
