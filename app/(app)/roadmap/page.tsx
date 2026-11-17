import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SITUATIONS, type RoadmapInput } from "@/lib/ai/schemas";
import { getCurrentUser } from "@/lib/auth";
import { projectsUnlocked } from "@/lib/roadmap/ideas";
import { getStore, type RoadmapRecord } from "@/lib/store";
import { NewJobForm } from "./NewJobForm";

export const metadata: Metadata = { title: "Your roadmaps", robots: { index: false } };
export const dynamic = "force-dynamic";

const dateOf = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

function statusOf(r: RoadmapRecord): string {
  if (!r.output) return "Being written";
  return projectsUnlocked(r) ? "Project ideas unlocked" : "Project ideas locked";
}

/** The details a new roadmap would reuse, in a few plain words. */
function reusedDetails(input: RoadmapInput): [string, string][] {
  const rows: [string, string][] = [["Where you are now", SITUATIONS[input.situation] + (input.situationDetail ? `: ${input.situationDetail}` : "")]];
  if (input.education) rows.push(["Education", input.education]);
  if (input.skills) rows.push(["Skills", input.skills]);
  const words = input.cvText.trim() ? input.cvText.trim().split(/\s+/).length : 0;
  rows.push(["CV", words ? `Included (${words} words)` : "None added"]);
  return rows;
}

/**
 * My roadmaps (decision 0010): every roadmap the person has built, newest first, and a quick way
 * to start another for a different job. It never redirects when there is one roadmap, because the
 * header link and the new-job form live here; with none it goes to the builder.
 */
export default async function RoadmapIndex() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/roadmap");
  const roadmaps = await getStore().listRoadmapsFor(user.id);
  if (roadmaps.length === 0) redirect("/roadmap/new");
  const latest = roadmaps[0];

  return (
    <div className="min-h-[calc(100svh-4.75rem)] bg-mist px-4 pt-8 pb-16 sm:px-8 sm:pt-12">
      <div className="mx-auto max-w-[52rem]">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
          <h1>Your roadmaps</h1>
          <Link href="/roadmap/saved" className="link font-semibold text-ink">
            Saved ideas
          </Link>
        </div>
        <p className="mt-2 text-graphite">One for each job you&rsquo;ve looked at, newest first.</p>

        <ol aria-label="Your roadmaps" className="mt-6 space-y-3">
          {roadmaps.map((r) => (
            <li key={r.id} className="rounded-[16px] border border-line bg-surface p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <h2 className="text-[1.25rem]">
                  <Link href={`/roadmap/${r.id}`} className="link">
                    {r.input.targetRole}
                  </Link>
                </h2>
                <span className="chip">{statusOf(r)}</span>
              </div>
              <p className="mt-1 text-sm text-graphite">
                <time dateTime={r.createdAt}>{dateOf(r.createdAt)}</time>
              </p>
            </li>
          ))}
        </ol>

        <section aria-labelledby="new-job" className="mt-10 rounded-[24px] border border-line bg-surface p-6 shadow-pack sm:p-8">
          <h2 id="new-job">New roadmap for a different job</h2>
          <p className="mt-2 text-graphite">
            We&rsquo;ll reuse what you told us for <span className="font-semibold text-ink">{latest.input.targetRole}</span>, so you only name the new job.
          </p>
          <dl className="mt-4 grid gap-3 text-[0.95rem] sm:grid-cols-2">
            {reusedDetails(latest.input).map(([term, value]) => (
              <div key={term}>
                <dt className="text-sm text-graphite">{term}</dt>
                <dd className="line-clamp-2 font-medium">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-sm">
            <Link href={`/roadmap/new?from=${latest.id}`} className="link font-semibold text-ink">
              Edit details
            </Link>
          </p>
          <NewJobForm />
        </section>
      </div>
    </div>
  );
}
