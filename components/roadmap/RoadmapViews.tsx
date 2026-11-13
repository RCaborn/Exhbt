import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, Mail } from "lucide-react";
import { WaitlistForm } from "@/components/waitlist/WaitlistForm";
import { PLAN_NAMES } from "@/lib/entitlements";
import { isPhase2Enabled } from "@/lib/site";
import { SkillHighlights } from "@/components/charts/SkillHighlights";
import { SkillRadar } from "@/components/charts/SkillRadar";
import { BuildThis, type BuildState } from "@/components/roadmap/BuildThis";
import { IdeaCard } from "@/components/roadmap/IdeaCard";
import { PlanEditor } from "@/components/roadmap/PlanEditor";
import { ProjectsGate } from "@/components/roadmap/ProjectsGate";
import type { Roadmap } from "@/lib/ai/schemas";
import type { Contact } from "@/lib/cv-contact";
import type { ProjectIdea } from "@/lib/store";
import { SKILLS_SOURCE_NOTE } from "@/lib/jobs/claim";
import {
  chartableSkills,
  highlights,
  nowVersusAfter,
  nowVersusNeeded,
  skillsAfterProjects,
  sortGapsByShortfall,
} from "@/lib/roadmap/skills";
import { Button } from "@/components/ui/Button";

/**
 * Order: everything free first (overview, the radar, strengths), then the project ideas behind
 * the details gate, then what next (docs/decisions/0004).
 */
export const VIEWS = [
  { key: "overview", label: "Overview" },
  { key: "gaps", label: "Gaps" },
  { key: "strengths", label: "Already strong" },
  { key: "projects", label: "Projects" },
  { key: "next", label: "What next" },
] as const;
export type ViewKey = (typeof VIEWS)[number]["key"];

export function parseView(v: string | undefined): ViewKey {
  return VIEWS.some((x) => x.key === v) ? (v as ViewKey) : "overview";
}

/** The Projects page: the gate (no email yet), the plan being shaped, or the settled plan. */
export type ProjectsState =
  | { unlocked: false; prefill: Contact; signedInEmail: string | null }
  | { unlocked: true; ideas: ProjectIdea[]; swapsLeft: number; done: boolean };

type Props = {
  id: string;
  roadmap: Roadmap;
  view: ViewKey;
  emailedTo: string | null;
  signedIn: boolean;
  projects: ProjectsState;
  /** Building an idea as an exhbt (Phase 2 only; left out when it's off). */
  build?: BuildState;
};

/** The roadmap as five short click-through screens. Each view is its own URL (?view=). */
export function RoadmapViews({ id, roadmap, view, emailedTo, signedIn, projects, build }: Props) {
  const index = VIEWS.findIndex((v) => v.key === view);
  const href = (k: ViewKey) => `/roadmap/${id}?view=${k}`;
  const prev = VIEWS[index - 1];
  // The gate is the way on from Projects until it's filled in.
  const next = view === "projects" && !projects.unlocked ? undefined : VIEWS[index + 1];
  const role = roadmap.targetRole || "your target role";

  return (
    <div className="min-h-[calc(100svh-4.75rem)] bg-mist px-4 pt-8 pb-16 sm:px-8 sm:pt-12">
      <div className="mx-auto max-w-[52rem]">
        <nav aria-label="Roadmap sections">
          <p className="text-sm font-semibold text-graphite sm:hidden">
            {index + 1} / {VIEWS.length} · {VIEWS[index].label}
          </p>
          <ol className="hidden gap-1 rounded-full border border-line bg-surface p-1 sm:flex">
            {VIEWS.map((v) => (
              <li key={v.key} className="flex-1">
                <Link
                  href={href(v.key)}
                  aria-current={v.key === view ? "page" : undefined}
                  className={`block rounded-full px-3 py-2 text-center text-sm font-semibold ${
                    v.key === view ? "bg-mint text-ink" : "text-graphite hover:bg-mist hover:text-ink"
                  }`}
                >
                  {v.label}
                </Link>
              </li>
            ))}
          </ol>
        </nav>

        <div className="mt-6 rounded-[24px] border border-line bg-surface p-6 shadow-pack sm:p-10">
          {view === "overview" && <Overview roadmap={roadmap} role={role} href={href} />}
          {view === "gaps" && <Gaps roadmap={roadmap} role={role} />}
          {view === "projects" && <Projects id={id} roadmap={roadmap} role={role} state={projects} build={build} />}
          {view === "strengths" && <Strengths roadmap={roadmap} role={role} />}
          {view === "next" && <Next emailedTo={emailedTo} signedIn={signedIn} id={id} unlocked={projects.unlocked} />}

          <div className="mt-10 flex items-center justify-between gap-4 border-t border-line pt-6">
            {prev ? (
              <Button href={href(prev.key)} label={prev.label}>
                <ArrowLeft aria-hidden size={18} strokeWidth={2.25} /> {prev.label}
              </Button>
            ) : (
              <span />
            )}
            {next && (
              <Button href={href(next.key)} variant="primary" size="lg" label={next.label} className="next-view">
                {next.label} <ArrowRight aria-hidden size={18} strokeWidth={2.5} />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Context({ role }: { role: string }) {
  return <p className="text-sm font-semibold text-graphite">Your roadmap to {role}</p>;
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="mt-6 rounded-[var(--radius)] bg-mist px-5 py-4 text-graphite">{children}</p>;
}

function Overview({ roadmap, role, href }: { roadmap: Roadmap; role: string; href: (k: ViewKey) => string }) {
  const n = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;
  return (
    <>
      <h1 className="">
        Your roadmap to <span className="highlight">{role}</span>
      </h1>
      {roadmap.summary && <p className="mt-5 max-w-[38rem] text-lg text-graphite">{roadmap.summary}</p>}
      <ul className="mt-8 divide-y divide-line border-y border-line">
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
      <Link href={href} className="flex items-center justify-between gap-4 py-4 text-[1.1rem] font-semibold hover:text-graphite">
        {label}
        <ArrowRight aria-hidden size={18} strokeWidth={2.25} />
      </Link>
    </li>
  );
}

function Gaps({ roadmap, role }: { roadmap: Roadmap; role: string }) {
  const skills = chartableSkills(roadmap);
  const marked = skills ? highlights(skills) : null;
  const gaps = skills ? sortGapsByShortfall(roadmap.gaps, skills) : roadmap.gaps;
  return (
    <>
      <Context role={role} />
      <h1 className="mt-2">Gaps to close</h1>
      <p className="mt-3 text-graphite">Skills this role asks for that your CV doesn&rsquo;t show yet, or not enough.</p>
      {skills && marked && (
        <div className="mt-8">
          <SkillRadar
            title="You now, against what the job asks for"
            fromLabel="You now"
            toLabel="What the job asks for"
            points={nowVersusNeeded(skills)}
            note={SKILLS_SOURCE_NOTE}
            highlight={marked}
          />
          <SkillHighlights up={marked.up} bag={marked.bag} />
        </div>
      )}
      {roadmap.gaps.length === 0 ? (
        <Empty>Your CV already covers what this role usually asks for. Look at the projects anyway: evidence beats claims.</Empty>
      ) : (
        <ul aria-label="Gaps to close" className="mt-8 divide-y divide-line border-y border-line">
          {gaps.map((g) => (
            <li key={g.skill} className="grid gap-2 py-5 sm:grid-cols-[1fr_9rem] sm:gap-8">
              <div>
                <p className="text-[1.15rem] font-bold tracking-[-0.01em]">{g.skill}</p>
                <p className="mt-1 text-graphite">{g.whyItMatters}</p>
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

function Projects({ id, roadmap, role, state, build }: { id: string; roadmap: Roadmap; role: string; state: ProjectsState; build?: BuildState }) {
  if (!state.unlocked) {
    return (
      <>
        <Context role={role} />
        <h1 className="mt-2">Your project ideas are ready</h1>
        <p className="mt-3 text-graphite">Tell us who you are and we&rsquo;ll email you a copy.</p>
        <ProjectsGate id={id} prefill={state.prefill} signedInEmail={state.signedInEmail} />
      </>
    );
  }
  const { ideas, swapsLeft, done } = state;
  return (
    <>
      <Context role={role} />
      <h1 className="mt-2">{done ? "Your plan" : "Projects that would prove them"}</h1>
      <p className="mt-3 text-graphite">
        {done ? "Each one ends with something real you can attach as evidence." : "Swap any that don’t fit, then keep your plan."}
      </p>
      {ideas.length === 0 ? (
        <Empty>We didn&rsquo;t have enough to suggest projects. Try again with more detail about your experience.</Empty>
      ) : done ? (
        <ol aria-label="Your plan" className="mt-8 space-y-4">
          {ideas.map((p) => (
            <li key={p.id}>
              <IdeaCard idea={p} footer={build && <BuildThis build={build} roadmapId={id} ideaId={p.id} title={p.title} />} />
            </li>
          ))}
        </ol>
      ) : (
        <PlanEditor id={id} ideas={ideas} swapsLeft={swapsLeft} build={build} />
      )}
      <AfterProjects roadmap={roadmap} ideas={ideas} done={done} />
    </>
  );
}

/** The same radar again, showing where finishing the plan's projects would take them. */
function AfterProjects({ roadmap, ideas, done }: { roadmap: Roadmap; ideas: ProjectIdea[]; done: boolean }) {
  const skills = chartableSkills(roadmap);
  if (!skills) return null;
  const chosen = { projects: ideas };
  const points = nowVersusAfter(skills, chosen);
  if (!points.some((p) => p.to > p.from)) return null;
  // The lists judge the after-projects levels against what the job asks for.
  const marked = highlights(skillsAfterProjects(skills, chosen));
  return (
    <section aria-labelledby="after-projects" className="mt-10 border-t border-line pt-8">
      <h2 id="after-projects" className="">
        {done ? "When you’ve finished your plan" : "When you’ve finished these projects"}
      </h2>
      <p className="mt-2 max-w-[38rem] text-graphite">Where you&rsquo;d stand once they&rsquo;re done.</p>
      <div className="mt-6">
        <SkillRadar
          title="You now, against where the projects would take you"
          fromLabel="You now"
          toLabel="After the projects"
          points={points}
          note={SKILLS_SOURCE_NOTE}
          highlight={marked}
        />
        <SkillHighlights up={marked.up} bag={marked.bag} />
      </div>
    </section>
  );
}

function Strengths({ roadmap, role }: { roadmap: Roadmap; role: string }) {
  return (
    <>
      <Context role={role} />
      <h1 className="mt-2">Already in your CV</h1>
      <p className="mt-3 text-graphite">What you can already point to, and where it shows.</p>
      {roadmap.strengths.length === 0 ? (
        <Empty>We couldn&rsquo;t match anything in your CV to this role yet. The projects are the place to start.</Empty>
      ) : (
        <ul className="mt-8 space-y-4">
          {roadmap.strengths.map((s) => (
            <li key={s.skill} className="flex gap-3">
              <span className="mt-1 inline-flex size-5 shrink-0 items-center justify-center rounded-full border border-ink bg-mint">
                <Check aria-hidden size={12} strokeWidth={3} />
              </span>
              <p>
                <span className="font-semibold">{s.skill}.</span> <span className="text-graphite">{s.evidence}</span>
              </p>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function Next({ emailedTo, signedIn, id, unlocked }: { emailedTo: string | null; signedIn: boolean; id: string; unlocked: boolean }) {
  return (
    <>
      <h1 className="">What next</h1>
      {!unlocked && (
        <p className="mt-5 rounded-[var(--radius)] bg-mist px-5 py-4">
          Your project ideas are waiting.{" "}
          <Link href={`/roadmap/${id}?view=projects`} className="link font-semibold text-ink">
            See them
          </Link>
        </p>
      )}
      {emailedTo && (
        <p className="mt-5 flex items-start gap-3 rounded-[var(--radius)] bg-mist px-5 py-4">
          <Mail aria-hidden size={20} strokeWidth={2} className="mt-0.5 shrink-0" />
          <span>
            We&rsquo;ve emailed a copy to <span className="font-semibold [overflow-wrap:anywhere]">{emailedTo}</span>.
            {!signedIn && " The link in it saves this roadmap to your account, so you can open it on any device."}
          </span>
        </p>
      )}
      {!signedIn && !emailedTo && (
        <p className="mt-5 text-graphite">
          This roadmap is saved in this browser. <Link href={`/login?next=/roadmap/${id}`} className="link text-ink">Log in</Link> to keep it on any device.
        </p>
      )}

      <div className="mt-10 rounded-[16px] bg-ink p-6 text-white sm:p-8">
        <h2 className="">When a project is done, make it count</h2>
        {isPhase2Enabled() ? (
          <>
            <p className="mt-3 max-w-[34rem] text-[#c9cbcf]">
              Turn a finished project into an exhbt: upload your notes or files and we draft it, you check it, and it goes on your own link.
              {" "}{PLAN_NAMES.max} adds a custom link for each job you apply to.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
              <Button href="/exhbts/new" variant="primary" size="lg">
                Make an exhbt
              </Button>
              <Link href="/account/billing" className="link font-semibold text-white">
                See the plans
              </Link>
            </div>
          </>
        ) : (
          <>
            <p className="mt-3 max-w-[34rem] text-[#c9cbcf]">
              {PLAN_NAMES.premium} drafts your exhbts from your files and puts them on your own link. {PLAN_NAMES.max} adds a
              custom link for each job you apply to, with your best-fit projects. Both include an originality check when you publish (coming soon), and both open soon.
            </p>
            <div className="mt-6">
              <WaitlistForm source="roadmap-next" interest="max" defaultEmail={emailedTo ?? ""} tone="dark" />
            </div>
          </>
        )}
      </div>

      <p className="mt-8 text-graphite">
        Aiming at a different role? <Link href="/roadmap/new" className="link text-ink">Build another roadmap</Link>
      </p>
    </>
  );
}
