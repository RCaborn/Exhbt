import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { pickableExhbts } from "@/lib/job-links";
import { canMakeJobLinks, getPlan } from "@/lib/plan";
import { isPhase2Enabled } from "@/lib/site";
import { getStore } from "@/lib/store";
import { UpgradeNote } from "../UpgradeNote";
import { NewJobLinkForm } from "./NewJobLinkForm";

export const metadata: Metadata = { title: "New job link", robots: { index: false } };
export const dynamic = "force-dynamic";

/** Company, role, the description (pasted, or read from a link and checked), and the address style. */
export default async function NewJobLinkPage() {
  if (!isPhase2Enabled()) notFound();
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/job-links/new");
  const store = getStore();
  const [plan, active, profile, live] = await Promise.all([
    getPlan(user.id),
    store.countActiveJobLinks(user.id),
    store.getPortfolioProfile(user.id),
    pickableExhbts(user.id),
  ]);
  const room = canMakeJobLinks(plan, active);

  return (
    <div className="min-h-[calc(100svh-4.75rem)] bg-mist px-4 pt-10 pb-16 sm:px-8 sm:pt-14">
      <div className="mx-auto max-w-[40rem]">
        <p className="text-sm font-semibold">
          <Link href="/job-links" className="link">
            Job links
          </Link>
        </p>
        {room.ok || !room.upgradeTo ? (
          <div className="mt-3 rounded-[24px] border border-line bg-surface p-6 shadow-pack sm:p-10">
            <h1 className="text-[2rem] sm:text-[2.6rem]">New job link</h1>
            <p className="mt-3 text-graphite">We match the job description against your live exhbts. Only what you published and what the advert says is used.</p>
            {!room.ok ? (
              <p role="alert" className="mt-6 rounded-[var(--radius)] border border-error/40 bg-surface px-4 py-3 text-error">
                {room.reason}
              </p>
            ) : live.length === 0 ? (
              <p role="alert" className="mt-6 rounded-[var(--radius)] border border-error/40 bg-surface px-4 py-3 text-error">
                Publish an exhbt first: a job link shows your live exhbts.{" "}
                <Link href="/exhbts" className="link font-semibold">
                  Your exhbts
                </Link>
              </p>
            ) : (
              <NewJobLinkForm />
            )}
          </div>
        ) : (
          <>
            <h1 className="mt-3">New job link</h1>
            <UpgradeNote username={profile.username} reason={room.reason} upgradeTo={room.upgradeTo} />
          </>
        )}
      </div>
    </div>
  );
}
