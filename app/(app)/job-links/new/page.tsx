import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { NewJobLinkForm } from "@/components/job-links/NewJobLinkForm";
import { UpgradePrompt } from "@/components/site/UpgradePrompt";
import { getCurrentUser } from "@/lib/auth";
import { canMakeJobLinks, getPlan, visibleOnPortfolio } from "@/lib/plan";
import { isPhase2Enabled } from "@/lib/site";
import { getStore } from "@/lib/store";

export const metadata: Metadata = { title: "New job link", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function NewJobLinkPage() {
  if (!isPhase2Enabled()) notFound();
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/job-links/new");

  const store = getStore();
  const plan = await getPlan(user.id);
  const [links, profile, exhbts] = await Promise.all([
    store.listJobLinks(user.id),
    store.getPortfolioProfile(user.id),
    store.listExhbts(user.id),
  ]);
  const allowed = canMakeJobLinks(plan, links.filter((l) => l.status === "live").length);
  const published = visibleOnPortfolio(plan, exhbts);

  return (
    <div className="mx-auto max-w-2xl px-4 pt-12 pb-16 sm:px-8 lg:pt-16">
      <p className="text-sm font-semibold"><Link href="/job-links" className="link">Job links</Link></p>
      <h1 className="mt-3">New job link</h1>

      {!allowed.ok ? (
        <div className="mt-6">
          <UpgradePrompt reason={allowed.reason} upgradeTo={allowed.upgradeTo} />
        </div>
      ) : !profile.username ? (
        <p className="mt-6">
          Choose a username first. The link lives on your portfolio address.{" "}
          <Link href="/account/portfolio" className="link font-semibold">Portfolio settings</Link>
        </p>
      ) : published.length === 0 ? (
        <p className="mt-6">
          Publish an exhbt first. A job link only shows work that&rsquo;s already on your portfolio.{" "}
          <Link href="/exhbts" className="link font-semibold">Your exhbts</Link>
        </p>
      ) : (
        <div className="mt-6">
          <NewJobLinkForm />
        </div>
      )}
    </div>
  );
}
