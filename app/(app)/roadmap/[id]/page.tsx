import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { canView } from "@/lib/access";
import { getStore } from "@/lib/store";
import { Generating } from "@/components/roadmap/Generating";
import { RoadmapViews, parseView, type ProjectsState } from "@/components/roadmap/RoadmapViews";
import { extractContact } from "@/lib/cv-contact";
import { ENTITLEMENTS } from "@/lib/entitlements";
import { ideasFor, planDone, projectsUnlocked } from "@/lib/roadmap/ideas";
import type { BuildState } from "@/components/roadmap/BuildThis";
import { canCreateExhbt, canSaveIdeas, getPlan } from "@/lib/plan";
import type { SaveState } from "@/components/roadmap/SaveIdea";
import { isPhase2Enabled } from "@/lib/site";

export const metadata: Metadata = { title: "Your roadmap", robots: { index: false } };

export default async function RoadmapPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const [{ id }, { view }] = await Promise.all([params, searchParams]);
  const user = await getCurrentUser();
  const record = await getStore().getRoadmap(id);
  if (!record) notFound();

  if (!(await canView(record, user))) {
    // Not signed in on this device (e.g. opened from the email later): log in, then come back.
    if (!user) redirect(`/login?next=/roadmap/${id}`);
    // Signed in as someone else: same response as "missing", so ids can't be probed.
    notFound();
  }

  if (!record.output) return <Generating id={id} role={record.input.targetRole} />;

  const current = parseView(view);
  let projects: ProjectsState;
  if (projectsUnlocked(record)) {
    const allowed = ENTITLEMENTS.free.projectSwapsPerRoadmap;
    projects = {
      unlocked: true,
      // Ideas are only read (and seeded on first use) where they're shown.
      ideas: current === "projects" ? await ideasFor(record) : [],
      swapsLeft: Math.max(0, allowed - record.projectSwapsUsed),
      done: planDone(record, allowed),
    };
  } else {
    projects = { unlocked: false, prefill: extractContact(record.input.cvText), signedInEmail: user?.email ?? null };
    if (current === "projects") await getStore().logEvent("projects_gate_viewed", user?.id ?? null);
  }

  // "Build this as an exhbt" (Phase 2): who can, and why not.
  let build: BuildState | undefined;
  // Saving an idea to the list kept across roadmaps (Premium and Max); a locked star on Free.
  let save: SaveState | undefined;
  if (isPhase2Enabled() && current === "projects" && projects.unlocked) {
    if (!user) build = { state: "signed-out" };
    else {
      const plan = await getPlan(user.id);
      const verdict = canCreateExhbt(plan, await getStore().listExhbts(user.id));
      build = verdict.ok ? { state: "ok" } : { state: "full", reason: verdict.reason };
      const canSave = canSaveIdeas(plan);
      save = canSave.ok
        ? { state: "ok", saved: await getStore().savedTitlesForRoadmap(user.id, id) }
        : { state: "locked", reason: canSave.reason, upgradeTo: canSave.upgradeTo };
    }
  }

  return (
    <RoadmapViews
      id={id}
      roadmap={record.output}
      view={current}
      emailedTo={record.emailSentAt ? record.pendingEmail : null}
      signedIn={Boolean(user)}
      projects={projects}
      build={build}
      save={save}
    />
  );
}
