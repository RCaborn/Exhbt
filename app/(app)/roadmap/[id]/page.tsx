import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getStore } from "@/lib/store";
import { generateRoadmap } from "@/lib/ai/roadmap";
import type { Roadmap } from "@/lib/ai/schemas";

export const metadata: Metadata = { title: "Your roadmap", robots: { index: false } };

export default async function RoadmapPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/roadmap/${id}`);

  const store = getStore();
  const record = await store.getRoadmap(id);
  // Same response for "missing" and "not yours", so ids can't be probed.
  if (!record || record.userId !== user.id) notFound();

  let roadmap = record.output;
  if (!roadmap) {
    roadmap = await store.findCachedOutput(record.inputHash);
    const fromCache = roadmap !== null;
    if (!roadmap) {
      const result = await generateRoadmap(record.input);
      roadmap = result.roadmap;
      await store.logAICall({
        userId: user.id,
        step: "roadmap",
        model: result.model,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        costUsd: result.costUsd,
      });
    }
    await store.saveRoadmapOutput(record.id, roadmap);
    await store.logEvent("roadmap_completed", user.id, { cached: fromCache });
  }

  return <RoadmapView roadmap={roadmap} />;
}

function RoadmapView({ roadmap }: { roadmap: Roadmap }) {
  const { gaps, projects, strengths } = roadmap;
  return (
    <div className="mx-auto max-w-[76rem] px-4 pt-12 sm:px-8 lg:pt-16">
      <div className="max-w-3xl">
        <h1 className="text-[2.6rem] sm:text-[3.6rem]">
          Your roadmap to <span className="highlight">{roadmap.targetRole || "your target role"}</span>
        </h1>
        {roadmap.summary && <p className="mt-4 text-lg text-ink-2">{roadmap.summary}</p>}
      </div>

      <section aria-labelledby="gaps" className="mt-14">
        <h2 id="gaps" className="text-[1.75rem]">Gaps to close</h2>
        {gaps.length === 0 ? (
          <p className="mt-3 text-ink-2">Your CV already covers what this role usually asks for.</p>
        ) : (
          <div className="mt-5 overflow-x-auto rounded-[14px] border border-rule bg-surface px-5">
            <table className="w-full min-w-[34rem] text-left text-[0.95rem]">
              <thead className="text-sm text-ink-2">
                <tr className="border-b border-rule">
                  <th scope="col" className="py-3 pr-6 font-normal">Skill</th>
                  <th scope="col" className="py-3 pr-6 font-normal">Why the role needs it</th>
                  <th scope="col" className="py-3 font-normal">In your CV</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule">
                {gaps.map((g) => (
                  <tr key={g.skill} className="align-top">
                    <th scope="row" className="py-3.5 pr-6 font-medium">{g.skill}</th>
                    <td className="py-3.5 pr-6">{g.whyItMatters}</td>
                    <td className="py-3.5 whitespace-nowrap text-ink-2">
                      {g.currentEvidence === "none" ? "Not yet" : "Some, not enough"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {projects.length > 0 && (
        <section aria-labelledby="projects" className="mt-16">
          <h2 id="projects" className="text-[1.75rem]">Projects that would prove them</h2>
          <ol className="mt-5 divide-y divide-rule rounded-[14px] border border-rule bg-surface px-6">
            {projects.map((p) => (
              <li key={p.title} className="grid gap-3 py-7 md:grid-cols-[1fr_16rem] md:gap-12">
                <div>
                  <h3 className="text-[1.35rem]">{p.title}</h3>
                  <p className="mt-2 max-w-2xl">{p.brief}</p>
                </div>
                <dl className="space-y-2 text-[0.95rem]">
                  <div>
                    <dt className="text-sm text-ink-2">You end up with</dt>
                    <dd>{p.deliverable}</dd>
                  </div>
                  {p.closesGaps.length > 0 && (
                    <div>
                      <dt className="text-sm text-ink-2">Closes</dt>
                      <dd>{p.closesGaps.join(", ")}</dd>
                    </div>
                  )}
                  <div>
                    <dt className="text-sm text-ink-2">Time</dt>
                    <dd>
                      <span className="chip font-mono">{p.weeks} {p.weeks === 1 ? "week" : "weeks"}</span>
                    </dd>
                  </div>
                </dl>
              </li>
            ))}
          </ol>
        </section>
      )}

      {strengths.length > 0 && (
        <section aria-labelledby="strengths" className="mt-16 max-w-3xl">
          <h2 id="strengths" className="text-[1.75rem]">Already in your CV</h2>
          <ul className="mt-4 space-y-3">
            {strengths.map((s) => (
              <li key={s.skill}>
                <span className="font-medium">{s.skill}.</span> <span className="text-ink-2">{s.evidence}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="next" className="mt-20 grid gap-6 rounded-[14px] bg-ink p-8 text-white md:grid-cols-[1fr_auto] md:items-end sm:p-10">
        <div className="max-w-2xl">
          <h2 id="next" className="text-[1.75rem]">When a project is done, make it count</h2>
          <p className="mt-3 text-[#c9d7e8]">
            Upload the report or repository and we draft a 200-word evidence pack you check and confirm. Employers
            open it from a link and see the outcome first. £9 a year.
          </p>
        </div>
        <Link href="/api/events/upgrade?from=roadmap" className="btn btn-primary">
          See plans
        </Link>
      </section>
    </div>
  );
}
