import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { canView } from "@/lib/access";
import { getStore } from "@/lib/store";
import { Generating } from "@/components/roadmap/Generating";
import { RoadmapViews, parseView, type ProjectsState } from "@/components/roadmap/RoadmapViews";
import { extractContact } from "@/lib/cv-contact";
import { ENTITLEMENTS } from "@/lib/entitlements";
import { ideasFor, planDone, projectsUnlocked, swapsLeft } from "@/lib/roadmap/ideas";

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
    const perIdea = ENTITLEMENTS.free.projectSwapsPerIdea;
    // Ideas are only read (and seeded on first use) where they're shown.
    const ideas = current === "projects" ? await ideasFor(record) : [];
    projects = {
      unlocked: true,
      ideas,
      swapsLeft: ideas.length ? swapsLeft(ideas, perIdea) : Math.max(0, perIdea * 3 - record.projectSwapsUsed),
      perIdeaLimit: perIdea,
      done: ideas.length ? planDone(record, ideas, perIdea) : Boolean(record.planConfirmedAt),
    };
  } else {
    projects = { unlocked: false, prefill: extractContact(record.input.cvText), signedInEmail: user?.email ?? null };
    if (current === "projects") await getStore().logEvent("projects_gate_viewed", user?.id ?? null);
  }

  return (
    <RoadmapViews
      id={id}
      roadmap={record.output}
      view={current}
      emailedTo={record.emailSentAt ? record.pendingEmail : null}
      signedIn={Boolean(user)}
      projects={projects}
    />
  );
}
