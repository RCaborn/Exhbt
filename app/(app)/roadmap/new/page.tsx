import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { RoadmapForm } from "./RoadmapForm";

export const metadata: Metadata = { title: "Your free roadmap" };

export default async function NewRoadmapPage({ searchParams }: { searchParams: Promise<{ role?: string }> }) {
  const user = await getCurrentUser();
  const role = (await searchParams).role?.trim().slice(0, 120) ?? "";
  return (
    <div className="bg-sky pb-8">
      <div className="mx-auto max-w-[44rem] px-4 pt-12 sm:px-8 lg:pt-16">
        <h1 className="text-[2.6rem] sm:text-[3.6rem]">
          {role ? (
            <>
              Your roadmap to <span className="highlight">{role}</span>
            </>
          ) : (
            "Your free roadmap"
          )}
        </h1>
        <p className="mt-4 text-lg text-ink-2">
          Tell us where you are and where you want to be. You get the skills your target role asks for that your CV
          does not show yet, and projects that would prove them.
        </p>
        <p className="mt-5 text-[0.95rem] text-ink-2">
          Your CV is stored in the UK, encrypted. The AI is told to use only what you give it, and you can download
          or delete everything at any time.
        </p>
        <div className="mt-9 rounded-[20px] border border-rule bg-surface p-6 shadow-pack sm:p-9">
          <RoadmapForm signedInEmail={user?.email ?? null} defaultRole={role} />
        </div>
      </div>
    </div>
  );
}
