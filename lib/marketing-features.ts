import { planFeatures } from "@/lib/entitlements";
import { portfolioHost } from "@/lib/hosts";

/**
 * A plan's checklist for the marketing pages (home and pricing), so both say the same thing.
 * The lines come from `planFeatures()`; the only change is the address placeholder, which reads
 * as a real address ("you.exhbt.co.uk") in the checklist, so it's spelled out here.
 */
export function marketingFeatures(plan: "free" | "premium" | "max"): string[] {
  return planFeatures(plan).map((line) => line.replace(portfolioHost("you"), `your own address (${portfolioHost("name")})`));
}
