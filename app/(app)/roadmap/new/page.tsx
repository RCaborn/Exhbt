import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { RoadmapForm } from "./RoadmapForm";

export const metadata: Metadata = { title: "Your free roadmap" };

export default async function NewRoadmapPage() {
  const user = await getCurrentUser();
  return (
    <div className="mx-auto grid max-w-[76rem] gap-12 px-4 pt-12 sm:px-8 lg:grid-cols-[1fr_20rem] lg:gap-20 lg:pt-16">
      <div className="max-w-2xl">
        <h1 className="text-[2.4rem] sm:text-[2.9rem]">Your free roadmap</h1>
        <p className="mt-4 text-lg text-ink-2">
          Tell us where you are and where you want to be. You get the skills your target role asks for that your
          CV does not show yet, and projects that would prove them.
        </p>
        <div className="mt-10">
          <RoadmapForm signedInEmail={user?.email ?? null} />
        </div>
      </div>

      <aside className="h-fit border-t border-rule pt-6 text-[0.95rem] text-ink-2 lg:mt-24">
        <h2 className="font-sans text-base font-medium text-ink">What happens to your CV</h2>
        <ul className="mt-3 space-y-2.5">
          <li>We extract the text and store it in the UK, encrypted.</li>
          <li>An AI model reads it to write your roadmap. It is told to use only what you gave it.</li>
          <li>You can download or delete everything from your account at any time.</li>
        </ul>
      </aside>
    </div>
  );
}
