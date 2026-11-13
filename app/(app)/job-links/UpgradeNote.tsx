import { UpgradePrompt } from "@/components/site/UpgradePrompt";
import { EXHBTS_PER_JOB_LINK, JOB_LINKS_LIVE, type Plan } from "@/lib/entitlements";
import { portfolioUrl } from "@/lib/hosts";

/**
 * What job links are, for someone whose plan doesn't include them, with the upgrade offer.
 * `reason` and `upgradeTo` come from canMakeJobLinks (lib/plan-rules.ts). Until JOB_LINKS_LIVE,
 * it says they open soon.
 */
export function UpgradeNote({ username, reason, upgradeTo }: { username: string | null; reason: string; upgradeTo?: Plan }) {
  return (
    <section aria-labelledby="what" className="mt-8 rounded-[20px] border border-line bg-surface p-5 sm:p-6">
      <h2 id="what" className="text-[1.375rem]">A page for each job you apply to</h2>
      <p className="mt-2">
        Paste a job description, or link to it, and we pick the {EXHBTS_PER_JOB_LINK} of your exhbts that fit it best, each with a
        reason. You reorder them, write a line to the employer, and send one address, like{" "}
        <span className="font-mono text-[0.9em]">{portfolioUrl(username ?? "alex", "lloyds-x7k2")}</span>.
      </p>
      <UpgradePrompt reason={JOB_LINKS_LIVE ? reason : `${reason} They open soon.`} upgradeTo={upgradeTo} className="mt-4" />
    </section>
  );
}
