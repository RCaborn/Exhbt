import { Button } from "@/components/ui/Button";
import { EXHBTS_PER_JOB_LINK, JOB_LINKS_LIVE, PLAN_NAMES } from "@/lib/entitlements";
import { portfolioUrl } from "@/lib/hosts";

/** What job links are (until JOB_LINKS_LIVE, sold as opening soon), for someone whose plan doesn't include them, and where to upgrade. */
export function UpgradeNote({ username }: { username: string | null }) {
  return (
    <section aria-labelledby="what" className="mt-8 rounded-[20px] border border-line bg-surface p-5 sm:p-6">
      <h2 id="what" className="text-[1.375rem]">A page for each job you apply to</h2>
      <p className="mt-2">
        Paste a job description, or link to it, and we pick the {EXHBTS_PER_JOB_LINK} of your exhbts that fit it best, each with a
        reason. You reorder them, write a line to the employer, and send one address, like{" "}
        <span className="font-mono text-[0.9em]">{portfolioUrl(username ?? "alex", "lloyds-x7k2")}</span>.
      </p>
      <p className="mt-3 font-semibold" role="status">
        Job links come with {PLAN_NAMES.max}
        {JOB_LINKS_LIVE ? "." : ", and open soon."}
      </p>
      <div className="mt-4">
        <Button href="/account/billing" variant="primary">
          {`See ${PLAN_NAMES.max}`}
        </Button>
      </div>
    </section>
  );
}
