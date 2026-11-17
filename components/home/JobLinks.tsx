import { Link2 } from "lucide-react";
import { EXHBTS_PER_JOB_LINK, JOB_LINKS_LIVE, PLAN_NAMES } from "@/lib/entitlements";
import { portfolioHost, portfolioUrl } from "@/lib/hosts";

/**
 * "A link for each job you apply for" (Max; decisions 0001 and 0008, docs/phase-2.md section 8).
 * The words say what the feature does (lib/ai/job-match.ts: up to EXHBTS_PER_JOB_LINK picks, best
 * first, and an intro the person can edit); the sketch beside them shows one person's links, each a
 * path on her own address, with the exhbt the AI put first for that job. "Coming soon" shows while
 * JOB_LINKS_LIVE in lib/entitlements.ts is false, so the section is right either way.
 */
export function JobLinks({ username, owner, picks }: { username: string; owner: string; picks: { slug: string; job: string; lead: string }[] }) {
  const first = owner.split(" ")[0];
  return (
    <section aria-labelledby="job-links" className="bg-surface">
      <div className="mx-auto grid max-w-[72rem] gap-12 px-4 py-20 sm:px-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start lg:gap-16 lg:py-28">
        <div>
          <h2 id="job-links" className="display-2 max-w-[14ch]">
            A link for each job you apply for
          </h2>
          {!JOB_LINKS_LIVE && (
            <p className="mt-5">
              <span className="chip">Coming soon</span>
            </p>
          )}
          <p className="mt-5 max-w-[34rem] text-lg text-graphite">
            Paste the job description. The AI picks your {EXHBTS_PER_JOB_LINK} exhbts that fit it best and drafts a short intro
            for you to edit. Send <span className="font-semibold text-ink">{portfolioUrl(username, picks[0]!.slug)}</span>{" "}
            with one application and a different link with the next.
          </p>
          <p className="mt-4 max-w-[34rem] text-graphite">
            On {PLAN_NAMES.max}. Search engines never list these links, and you can turn one off whenever you like.
          </p>
        </div>
        <figure className="m-0 min-w-0">
          <figcaption className="sr-only">
            Example: {first}&rsquo;s links for {picks.length} jobs, each with the exhbts picked for it. {owner} is fictional.
          </figcaption>
          <ul aria-hidden className="grid gap-3">
            {picks.map((p, i) => (
              <li
                key={p.slug}
                className={`min-w-0 rounded-[20px] border bg-surface p-5 ${i === 0 ? "border-ink shadow-pack" : "border-line"}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                  <p className="flex min-w-0 items-center gap-2 text-[0.95rem] font-semibold">
                    <Link2 size={16} strokeWidth={2.25} className="shrink-0 text-jade" />
                    <span className="min-w-0 truncate font-mono">
                      <span className="font-medium text-graphite">{portfolioHost(username)}</span>
                      <span className="text-ink">/{p.slug}</span>
                    </span>
                  </p>
                  <span className="chip shrink-0">{EXHBTS_PER_JOB_LINK} exhbts picked</span>
                </div>
                <p className="mt-1 text-[0.875rem] text-graphite">For {p.job}</p>
                <p className="mt-4 border-t border-line pt-3 text-[0.875rem]">
                  <span className="text-graphite">Leads with </span>
                  <span className="font-semibold">{p.lead}</span>
                </p>
              </li>
            ))}
          </ul>
        </figure>
      </div>
    </section>
  );
}
