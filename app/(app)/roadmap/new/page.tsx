import type { Metadata } from "next";
import { RoadmapWizard } from "./RoadmapWizard";

export const metadata: Metadata = { title: "Your free roadmap" };

export default async function NewRoadmapPage({ searchParams }: { searchParams: Promise<{ role?: string }> }) {
  const role = (await searchParams).role?.trim().slice(0, 120) ?? "";
  return (
    <div className="min-h-[calc(100svh-4.75rem)] bg-sky px-4 pt-10 pb-16 sm:px-8 sm:pt-14">
      <div className="mx-auto max-w-[40rem]">
        <h1 className="text-[1.1rem] font-bold tracking-[-0.01em] text-ink-2">Your free roadmap</h1>
        <div className="mt-4 rounded-[24px] border border-rule bg-surface p-6 shadow-pack sm:p-10">
          <RoadmapWizard defaultRole={role} />
        </div>
      </div>
    </div>
  );
}
