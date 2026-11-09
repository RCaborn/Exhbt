import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, Mail } from "lucide-react";
import { WaitlistForm } from "@/components/waitlist/WaitlistForm";
import { PLAN_NAMES } from "@/lib/entitlements";
import { SkillRadar } from "@/components/charts/SkillRadar";
import type { Roadmap } from "@/lib/ai/schemas";
import { SKILLS_SOURCE_NOTE } from "@/lib/jobs/claim";
import { biggestGaps, chartableSkills, nowVersusAfter, nowVersusNeeded, sortGapsByShortfall } from "@/lib/roadmap/skills";

export const VIEWS = [
  { key: "overview", label: "Overview" },
  { key: "gaps", label: "Gaps" },
  { key: "projects", label: "Projects" },
  { key: "strengths", label: "Already strong" },
  { key: "next", label: "What next" },
] as const;
export type ViewKey = (typeof VIEWS)[number]["key"];

export function parseView(v: string | undefined): ViewKey {
  return VIEWS.some((x) => x.key === v) ? (v as ViewKey) : "overview";
}

type Props = {
  id: string;
  roadmap: Roadmap;
  view: ViewKey;
  emailedTo: string | null;
  signedIn: boolean;
};

/** The roadmap as five short click-through screens. Each view is its own URL (?view=). */
export function RoadmapViews({ id, roadmap, view, emailedTo, signedIn }: Props) {
  const index = VIEWS.findIndex((v) => v.key === view);
  const href = (k: ViewKey) => `/roadmap/${id}?view=${k}`;
  const prev = VIEWS[index - 1];
  const next = VIEWS[index + 1];
  const role = roadmap.targetRole || "your target role";

  return (
    <div className="min-h-[calc(100svh-4.75rem)] bg-sky px-4 pt-8 pb-16 sm:px-8 sm:pt-12">
      <div className="mx-auto max-w-[52rem]">
        <nav aria-label="Roadmap sections">
          <p className="text-sm font-semibold text-ink-2 sm:hidden">
            {index + 1} / {VIEWS.length} · {VIEWS[index].label}
          </p>
          <ol className="hidden gap-1 rounded-full border border-rule bg-surface p-1 sm:flex">
            {VIEWS.map((v) => (
              <li key={v.key} className="flex-1">
                <Link
                  href={href(v.key)}
                  aria-current={v.key === view ? "page" : undefined}
                  className={`block rounded-full px-3 py-2 text-center text-sm font-semibold ${
                    v.key === view ? "bg-blue text-ink" : "text-ink-2 hover:bg-sky hover:text-ink"
                  }`}
                >
                  {v.label}
                </Link>
              </li>
            ))}
          </ol>
        </nav>

        <div className="mt-6 rounded-[24px] border border-rule bg-surface p-6 shadow-pack sm:p-10">
          {view === "overview" && <Overview roadmap={roadmap} role={role} href={href} />}
          {view === "gaps" && <Gaps roadmap={roadmap} role={role} />}
          {view === "projects" && <Projects roadmap={roadmap} role={role} />}
          {view === "strengths" && <Strengths roadmap={roadmap} role={role} />}
          {view === "next" && <Next emailedTo={emailedTo} signedIn={signedIn} id={id} />}

          <div className="mt-10 flex items-center justify-between gap-4 border-t border-rule pt-6">
            {prev ? (
              <Link href={href(prev.key)} className="btn btn-secondary">
                <ArrowLeft aria-hidden size={18} strokeWidth={2.25} /> {prev.label}
              </Link>
            ) : (
              <span />
            )}
            {next && (
              <Link href={href(next.key)} className="btn btn-primary min-h-12 px-6 text-base">
                {next.label} <ArrowRight aria-hidden size={18} strokeWidth={2.5} />
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Context({ role }: { role: string }) {
  return <p className="text-sm font-semibold text-ink-2">Your roadmap to {role}</p>;
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="mt-6 rounded-[var(--radius)] bg-sky px-5 py-4 text-ink-2">{children}</p>;
}

function Overview({ roadmap, role, href }: { roadmap: Roadmap; role: string; href: (k: ViewKey) => string }) {
  const n = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;
  return (
    <>
      <h1 className="text-[2.2rem] sm:text-[3rem]">
        Your roadmap to <span className="highlight">{role}</span>
      </h1>
      {roadmap.summary && <p className="mt-5 max-w-[38rem] text-lg text-ink-2">{roadmap.summary}</p>}
      <ul className="mt-8 divide-y divide-rule border-y border-rule">
        <SummaryRow href={href("gaps")} label={n(roadmap.gaps.length, "gap to close", "gaps to close")} />
        <SummaryRow href={href("projects")} label={n(roadmap.projects.length, "project to prove them", "projects to prove them")} />
        <SummaryRow href={href("strengths")} label={n(roadmap.strengths.length, "strength already in your CV", "strengths already in your CV")} />
      </ul>
    </>
  );
}

function SummaryRow({ href, label }: { href: string; label: string }) {
  return (
    <li>
      <Link href={href} className="flex items-center justify-between gap-4 py-4 text-[1.1rem] font-semibold hover:text-ink-2">
        {label}
        <ArrowRight aria-hidden size={18} strokeWidth={2.25} />
      </Link>
    </li>
  );
}

function Gaps({ roadmap, role }: { roadmap: Roadmap; role: string }) {
  const skills = chartableSkills(roadmap);
  const biggest = skills ? biggestGaps(skills) : [];
  const gaps = skills ? sortGapsByShortfall(roadmap.gaps, skills) : roadmap.gaps;
  return (
    <>
      <Context role={role} />
      <h1 className="mt-2 text-[2.2rem] sm:text-[3rem]">Gaps to close</h1>
      <p className="mt-3 text-ink-2">Skills this role asks for that your CV doesn&rsquo;t show yet, or not enough.</p>
      {skills && (
        <div className="mt-8">
          <SkillRadar
            title="You now, against what the job asks for"
            fromLabel="You now"
            toLabel="What the job asks for"
            valueWords={["you", "job"]}
            points={nowVersusNeeded(skills)}
            note={SKILLS_SOURCE_NOTE}
          />
          {biggest.length > 0 && (
            <p className="mt-5 text-[1.05rem]">
              {biggest.length === 1 ? "Your biggest gap is " : "Your biggest gaps are "}
              {biggest.map((s, i) => (
                <span key={s.skill}>
                  {i > 0 && " and "}
                  <span className="font-semibold">{s.skill}</span>
                </span>
              ))}
              .
            </p>
          )}
        </div>
      )}
      {roadmap.gaps.length === 0 ? (
        <Empty>Your CV already covers what this role usually asks for. Look at the projects anyway: evidence beats claims.</Empty>
      ) : (
        <ul className="mt-8 divide-y divide-rule border-y border-rule">
          {gaps.map((g) => (
            <li key={g.skill} className="grid gap-2 py-5 sm:grid-cols-[1fr_9rem] sm:gap-8">
              <div>
                <p className="text-[1.15rem] font-bold tracking-[-0.01em]">{g.skill}</p>
                <p className="mt-1 text-ink-2">{g.whyItMatters}</p>
              </div>
              <p className="sm:text-right">
                <span className="chip">{g.currentEvidence === "none" ? "Not in your CV" : "Some, not enough"}</span>
              </p>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function Projects({ roadmap, role }: { roadmap: Roadmap; role: string }) {
  return (
    <>
      <Context role={role} />
      <h1 className="mt-2 text-[2.2rem] sm:text-[3rem]">Projects that would prove them</h1>
      <p className="mt-3 text-ink-2">Each one ends with something real you can attach as evidence.</p>
      {roadmap.projects.length === 0 ? (
        <Empty>We didn&rsquo;t have enough to suggest projects. Try again with more detail about your experience.</Empty>
      ) : (
        <ol className="mt-8 space-y-4">
          {roadmap.projects.map((p) => (
            <li key={p.title} className="rounded-[16px] border border-rule p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <h2 className="text-[1.35rem]">{p.title}</h2>
                <span className="chip font-mono">
                  {p.weeks} {p.weeks === 1 ? "week" : "weeks"}
                </span>
              </div>
              <p className="mt-2 text-ink-2">{p.brief}</p>
              <dl className="mt-4 grid gap-3 text-[0.95rem] sm:grid-cols-2">
                <div>
                  <dt className="text-sm text-ink-2">You end up with</dt>
                  <dd className="font-medium">{p.deliverable}</dd>
                </div>
                {p.closesGaps.length > 0 && (
                  <div>
                    <dt className="text-sm text-ink-2">Closes</dt>
                    <dd className="font-medium">{p.closesGaps.join(", ")}</dd>
                  </div>
                )}
              </dl>
            </li>
          ))}
        </ol>
      )}
      <AfterProjects roadmap={roadmap} />
    </>
  );
}

/** The same radar again, showing where finishing the projects would take them. */
function AfterProjects({ roadmap }: { roadmap: Roadmap }) {
  const skills = chartableSkills(roadmap);
  if (!skills) return null;
  const points = nowVersusAfter(skills, roadmap);
  if (!points.some((p) => p.to > p.from)) return null;
  return (
    <section aria-labelledby="after-projects" className="mt-10 border-t border-rule pt-8">
      <h2 id="after-projects" className="text-[1.6rem] sm:text-[2rem]">When you&rsquo;ve finished these projects</h2>
      <p className="mt-2 max-w-[38rem] text-ink-2">
        A finished project counts as level 3 for each skill it closes: you used it, and you can show what you did.
      </p>
      <div className="mt-6">
        <SkillRadar
          title="You now, against where the projects would take you"
          fromLabel="You now"
          toLabel="After the projects"
          points={points}
          note={SKILLS_SOURCE_NOTE}
        />
      </div>
    </section>
  );
}

function Strengths({ roadmap, role }: { roadmap: Roadmap; role: string }) {
  return (
    <>
      <Context role={role} />
      <h1 className="mt-2 text-[2.2rem] sm:text-[3rem]">Already in your CV</h1>
      <p className="mt-3 text-ink-2">What you can already point to, and where it shows.</p>
      {roadmap.strengths.length === 0 ? (
        <Empty>We couldn&rsquo;t match anything in your CV to this role yet. The projects are the place to start.</Empty>
      ) : (
        <ul className="mt-8 space-y-4">
          {roadmap.strengths.map((s) => (
            <li key={s.skill} className="flex gap-3">
              <span className="mt-1 inline-flex size-5 shrink-0 items-center justify-center rounded-full border border-ink bg-green">
                <Check aria-hidden size={12} strokeWidth={3} />
              </span>
              <p>
                <span className="font-semibold">{s.skill}.</span> <span className="text-ink-2">{s.evidence}</span>
              </p>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function Next({ emailedTo, signedIn, id }: { emailedTo: string | null; signedIn: boolean; id: string }) {
  return (
    <>
      <h1 className="text-[2.2rem] sm:text-[3rem]">What next</h1>
      {emailedTo && (
        <p className="mt-5 flex items-start gap-3 rounded-[var(--radius)] bg-sky px-5 py-4">
          <Mail aria-hidden size={20} strokeWidth={2} className="mt-0.5 shrink-0" />
          <span>
            We&rsquo;ve emailed a copy to <span className="font-semibold [overflow-wrap:anywhere]">{emailedTo}</span>.
            {!signedIn && " The link in it saves this roadmap to your account, so you can open it on any device."}
          </span>
        </p>
      )}
      {!signedIn && !emailedTo && (
        <p className="mt-5 text-ink-2">
          This roadmap is saved in this browser. <Link href={`/login?next=/roadmap/${id}`} className="link text-ink">Log in</Link> to keep it on any device.
        </p>
      )}

      <div className="mt-10 rounded-[16px] bg-ink p-6 text-white sm:p-8">
        <h2 className="text-[1.6rem] sm:text-[2rem]">When a project is done, make it count</h2>
        <p className="mt-3 max-w-[34rem] text-[#c9d7e8]">
          {PLAN_NAMES.plus} hosts more exhbts on your own link, and helps draft them. {PLAN_NAMES.premium} adds a
          custom link for each job you apply to, with your best-fit projects, and an originality check when you
          publish. Both open soon.
        </p>
        <div className="mt-6">
          <WaitlistForm source="roadmap-next" interest="premium" defaultEmail={emailedTo ?? ""} tone="dark" />
        </div>
      </div>

      <p className="mt-8 text-ink-2">
        Aiming at a different role? <Link href="/roadmap/new" className="link text-ink">Build another roadmap</Link>
      </p>
    </>
  );
}
