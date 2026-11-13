import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { getStore } from "@/lib/store";
import { RoadmapWizard } from "./RoadmapWizard";

export const metadata: Metadata = { title: "Your free roadmap" };

/**
 * The builder. `?from=<roadmap id>` (from "Edit details" on My roadmaps) starts with that
 * roadmap's situation, education, skills and CV, leaving the job to fill in; only the owner's
 * roadmap is used.
 */
export default async function NewRoadmapPage({ searchParams }: { searchParams: Promise<{ role?: string; from?: string }> }) {
  const { role: roleParam, from } = await searchParams;
  const role = roleParam?.trim().slice(0, 120) ?? "";
  let initial: React.ComponentProps<typeof RoadmapWizard>["initial"];
  if (from) {
    const user = await getCurrentUser();
    const earlier = user ? await getStore().getRoadmap(from) : null;
    if (user && earlier && earlier.userId === user.id) {
      const { situation, situationDetail, education, skills, cvText } = earlier.input;
      initial = { situation, situationDetail, education, skills, cvText };
    }
  }
  return (
    <div className="min-h-[calc(100svh-4.75rem)] bg-mist px-4 pt-10 pb-16 sm:px-8 sm:pt-14">
      <div className="mx-auto max-w-[40rem]">
        <h1 className="text-[1.1rem] font-bold tracking-[-0.01em] text-graphite">Your free roadmap</h1>
        <div className="mt-4 rounded-[24px] border border-line bg-surface p-6 shadow-pack sm:p-10">
          <RoadmapWizard defaultRole={role} initial={initial} />
        </div>
      </div>
    </div>
  );
}
