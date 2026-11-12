import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { ENTITLEMENTS, PLAN_NAMES } from "@/lib/entitlements";
import { portfolioHost } from "@/lib/hosts";
import { getPlan } from "@/lib/plan";
import { portfolioHref } from "@/lib/portfolio-links";
import { isPhase2Enabled } from "@/lib/site";
import { getStore } from "@/lib/store";
import { Avatar } from "@/components/portfolio/Avatar";
import { Button } from "@/components/ui/Button";
import { ProfileForm } from "./ProfileForm";
import { UsernameForm } from "./UsernameForm";

export const metadata: Metadata = { title: "Portfolio settings", robots: { index: false } };
// Per person, and EXHBT_PHASE2 is read at request time: never prerender (it would bake in the 404).
export const dynamic = "force-dynamic";

export default async function PortfolioSettingsPage() {
  if (!isPhase2Enabled()) notFound();
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account/portfolio");

  const [profile, plan, host] = await Promise.all([
    getStore().getPortfolioProfile(user.id),
    getPlan(user.id),
    headers().then((h) => h.get("x-forwarded-host") ?? h.get("host")),
  ]);
  const isPublic = ENTITLEMENTS[plan].publicPortfolio;
  const { username } = profile;

  return (
    <div className="mx-auto max-w-2xl px-4 pt-12 pb-16 sm:px-8 lg:pt-16">
      <p className="text-sm">
        <Link href="/account" className="link">Account</Link>
      </p>
      <h1 className="mt-2">Portfolio settings</h1>

      <dl className="mt-6 grid gap-x-6 gap-y-2 rounded-[16px] border border-line bg-surface p-5 sm:grid-cols-[auto_1fr]">
        <dt className="font-semibold">Plan</dt>
        <dd>{PLAN_NAMES[plan]}</dd>
        {username && (
          <>
            <dt className="font-semibold">Address</dt>
            <dd className="break-all">{portfolioHost(username)}</dd>
            <dt className="font-semibold">Public</dt>
            <dd>{isPublic ? "Yes" : "No"}</dd>
          </>
        )}
      </dl>
      {!isPublic && (
        <p className="mt-4">
          Your portfolio isn&rsquo;t public on {PLAN_NAMES[plan]}. Publishing comes with{" "}
          <Link href="/pricing" className="link font-semibold">{PLAN_NAMES.premium}</Link>.
        </p>
      )}
      {username && (
        <div className="mt-5">
          <Button href={portfolioHref(username, host)}>View my portfolio</Button>
        </div>
      )}

      <section aria-labelledby="username-heading" className="mt-12 border-t border-line pt-8">
        <h2 id="username-heading" className="text-[1.375rem]">Username</h2>
        <p className="mt-3 text-graphite">
          {username ? "It’s the first part of your portfolio address." : "Choose a username to get your portfolio address."}
        </p>
        <UsernameForm current={username} />
      </section>

      <section aria-labelledby="profile-heading" className="mt-12 border-t border-line pt-8">
        <h2 id="profile-heading" className="text-[1.375rem]">Profile</h2>
        <div className="mt-4 flex items-center gap-4">
          <Avatar name={profile.name ?? username ?? user.email} size={64} />
          <p className="text-sm text-graphite">Your initials show until photos arrive.</p>
        </div>
        <ProfileForm
          initial={{
            name: profile.name ?? "",
            headline: profile.headline ?? "",
            bio: profile.bio ?? "",
            linkedin: profile.linkedin ?? "",
            hideFromSearch: profile.hideFromSearch,
          }}
        />
      </section>
    </div>
  );
}
