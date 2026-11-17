import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { BuildThis, type BuildState } from "@/components/roadmap/BuildThis";
import { IdeaCard } from "@/components/roadmap/IdeaCard";
import { UpgradePrompt } from "@/components/site/UpgradePrompt";
import { Button } from "@/components/ui/Button";
import { getCurrentUser } from "@/lib/auth";
import { canCreateExhbt, canSaveIdeas, getPlan } from "@/lib/plan";
import { isPhase2Enabled } from "@/lib/site";
import { getStore } from "@/lib/store";
import { removeSavedIdea } from "./actions";

export const metadata: Metadata = { title: "Saved ideas", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * Saved ideas (decision 0010): the ideas a person kept from every roadmap, each with the job it
 * came from, filterable by job (?job=). On Free there is nothing to save to, so it offers the
 * upgrade; ideas saved before a downgrade stay listed.
 */
export default async function SavedIdeasPage({ searchParams }: { searchParams: Promise<{ job?: string; full?: string }> }) {
  if (!isPhase2Enabled()) notFound();
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/roadmap/saved");
  const { job, full } = await searchParams;

  const store = getStore();
  const plan = await getPlan(user.id);
  const canSave = canSaveIdeas(plan);
  const all = await store.listSavedIdeas(user.id);
  const jobs = [...new Set(all.map((s) => s.targetRole))].sort((a, b) => a.localeCompare(b));
  const shown = job && jobs.includes(job) ? all.filter((s) => s.targetRole === job) : all;
  const selected = job && jobs.includes(job) ? job : null;

  const exhbtVerdict = canCreateExhbt(plan, await store.listExhbts(user.id));
  const build: BuildState = exhbtVerdict.ok ? { state: "ok" } : { state: "full", reason: exhbtVerdict.reason };

  return (
    <div className="min-h-[calc(100svh-4.75rem)] bg-mist px-4 pt-8 pb-16 sm:px-8 sm:pt-12">
      <div className="mx-auto max-w-[52rem]">
        <p className="text-sm font-semibold">
          <Link href="/roadmap" className="link text-graphite">
            Your roadmaps
          </Link>
        </p>
        <h1 className="mt-2">Saved ideas</h1>
        <p className="mt-2 text-graphite">Project ideas you&rsquo;ve kept from any of your roadmaps. A saved idea stays as it was, even if you swap it in the roadmap.</p>

        {!canSave.ok && <UpgradePrompt reason={canSave.reason} upgradeTo={canSave.upgradeTo} className="mt-6" />}
        {full && (
          <p role="alert" className="mt-6 rounded-[var(--radius)] border border-error/40 bg-surface px-4 py-3 text-error">
            Your saved list is full. Remove an idea to save another.
          </p>
        )}

        {all.length === 0 ? (
          canSave.ok && (
            <p className="mt-8 rounded-[16px] border border-line bg-surface p-6 text-graphite">
              Nothing saved yet. Open the Projects view of a roadmap and choose &ldquo;Save idea&rdquo; on any idea you want to keep.
            </p>
          )
        ) : (
          <>
            {jobs.length > 1 && (
              <nav aria-label="Filter by job" className="mt-6">
                <ul className="flex flex-wrap gap-2">
                  <FilterLink href="/roadmap/saved" current={!selected}>
                    All jobs
                  </FilterLink>
                  {jobs.map((j) => (
                    <FilterLink key={j} href={`/roadmap/saved?job=${encodeURIComponent(j)}`} current={selected === j}>
                      {j}
                    </FilterLink>
                  ))}
                </ul>
              </nav>
            )}
            <ol aria-label="Saved ideas" className="mt-6 space-y-4">
              {shown.map((s) => (
                <li key={s.id}>
                  <IdeaCard
                    idea={s}
                    footer={
                      <>
                        <p className="mb-3 text-sm text-graphite">
                          From your roadmap to{" "}
                          {s.roadmapId ? (
                            <Link href={`/roadmap/${s.roadmapId}?view=projects`} className="link font-semibold text-ink">
                              {s.targetRole}
                            </Link>
                          ) : (
                            <span className="font-semibold text-ink">{s.targetRole}</span>
                          )}
                        </p>
                        <div className="flex flex-wrap items-center gap-3">
                          <BuildThis build={build} savedId={s.id} title={s.title} />
                          <form action={removeSavedIdea.bind(null, s.id)}>
                            <Button type="submit" size="sm" label={`Remove: ${s.title}`}>
                              Remove
                            </Button>
                          </form>
                        </div>
                      </>
                    }
                  />
                </li>
              ))}
            </ol>
          </>
        )}
      </div>
    </div>
  );
}

function FilterLink({ href, current, children }: { href: string; current: boolean; children: React.ReactNode }) {
  return (
    <li>
      <Link
        href={href}
        aria-current={current ? "page" : undefined}
        className={`block rounded-full border px-3 py-1.5 text-sm font-semibold ${
          current ? "border-mint bg-mint text-ink" : "border-line bg-surface text-graphite hover:text-ink"
        }`}
      >
        {children}
      </Link>
    </li>
  );
}
