import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { getCurrentUser } from "@/lib/auth";
import { portfolioUrl } from "@/lib/hosts";
import { pickableExhbts } from "@/lib/job-links";
import { canMakeJobLinks, getPlan, limitsFor } from "@/lib/plan";
import { isPhase2Enabled } from "@/lib/site";
import { getStore } from "@/lib/store";
import { UpgradeNote } from "./UpgradeNote";

export const metadata: Metadata = { title: "Job links", robots: { index: false } };
// Per request: the EXHBT_PHASE2 switch and the session are read at runtime, never baked in at build.
export const dynamic = "force-dynamic";

/** A person's per-job links (docs/phase-2.md section 8): make one, see each one's address, state and views. */
export default async function JobLinksPage() {
  if (!isPhase2Enabled()) notFound();
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/job-links");
  const store = getStore();
  const [plan, links, profile, live] = await Promise.all([
    getPlan(user.id),
    store.listJobLinks(user.id),
    store.getPortfolioProfile(user.id),
    pickableExhbts(user.id),
  ]);
  const e = limitsFor(plan);
  const active = links.filter((l) => l.status === "live").length;
  const room = canMakeJobLinks(plan, active);

  return (
    <div className="bg-mist">
      <div className="mx-auto max-w-3xl px-4 pt-10 pb-16 sm:px-8 lg:pt-14">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h1>Job links</h1>
          {e.jobLinks && (
            <p className="text-sm text-graphite">
              <span className="font-mono text-ink">{Math.max(0, e.jobLinksActive - active)}</span> of{" "}
              <span className="font-mono text-ink">{e.jobLinksActive}</span> live links left
            </p>
          )}
        </div>

        {!e.jobLinks ? (
          <UpgradeNote username={profile.username} reason={room.ok ? "" : room.reason} upgradeTo={room.ok ? undefined : room.upgradeTo} />
        ) : (
          <section aria-labelledby="new" className="mt-8 rounded-[20px] border border-line bg-surface p-5 sm:p-6">
            <h2 id="new" className="text-[1.375rem]">New job link</h2>
            {live.length === 0 ? (
              <p className="mt-2" role="status">
                Publish an exhbt first: a job link shows your live exhbts.{" "}
                <Link href="/exhbts" className="link font-semibold">
                  Your exhbts
                </Link>
              </p>
            ) : room.ok ? (
              <>
                <p className="mt-2 text-graphite">Paste a job description or link to it. We pick the exhbts that fit it best; you check the picks.</p>
                <div className="mt-4">
                  <Button href="/job-links/new" variant="primary">
                    New job link
                  </Button>
                </div>
              </>
            ) : (
              <p className="mt-2" role="status">
                {room.reason}
              </p>
            )}
          </section>
        )}

        {links.length > 0 && (
          <ol aria-label="Your job links, newest first" className="mt-8 space-y-3">
            {links.map((l) => {
              const name = [l.company, l.roleTitle].filter(Boolean).join(" · ");
              return (
                <li key={l.id} className="flex flex-col gap-3 rounded-[16px] border border-line bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <span className={l.status === "live" ? "chip" : "chip bg-mist text-graphite"}>{l.status === "live" ? "Live" : "Off"}</span>
                    <Link href={`/job-links/${l.id}`} className="link mt-1.5 block font-semibold break-words">
                      {name}
                    </Link>
                    {profile.username && <span className="block font-mono text-sm break-all text-graphite">{portfolioUrl(profile.username, l.slug)}</span>}
                    <span className="text-sm text-graphite">
                      {l.viewCount === 1 ? "1 view" : `${l.viewCount.toLocaleString("en-GB")} views`}
                    </span>
                  </div>
                  <Button href={`/job-links/${l.id}`} size="sm" label={`Edit ${name}`}>
                    Edit
                  </Button>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}
