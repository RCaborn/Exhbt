import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { Button } from "@/components/ui/Button";
import { PLAN_NAMES } from "@/lib/entitlements";
import { getPlan } from "@/lib/plan";
import { CopyLink } from "@/components/ui/CopyLink";
import { portfolioHost } from "@/lib/hosts";
import { portfolioHref } from "@/lib/portfolio-links";
import { isPhase2Enabled } from "@/lib/site";
import { getStore } from "@/lib/store";

export const metadata: Metadata = { title: "Account", robots: { index: false } };

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account");
  const phase2 = isPhase2Enabled();
  const [plan, profile, host] = await Promise.all([
    getPlan(user.id),
    phase2 ? getStore().getPortfolioProfile(user.id) : null,
    headers().then((h) => h.get("x-forwarded-host") ?? h.get("host")),
  ]);
  const username = profile?.username ?? null;
  return (
    <div className="mx-auto max-w-2xl px-4 pt-12 sm:px-8 lg:pt-16">
      <h1 className="">Account</h1>
      <p className="mt-3 text-graphite">Signed in as {user.email}. Plan: {PLAN_NAMES[plan]}.</p>
      <p className="mt-3">
        <Link href="/login/password" className="link">Set or change your password</Link>
      </p>

      {phase2 && username && (
        <section aria-labelledby="address" className="mt-6 rounded-[16px] border border-line bg-surface p-5">
          <h2 id="address" className="text-[1.125rem]">Your portfolio address</h2>
          <p className="mt-2 break-all">
            <a href={portfolioHref(username, host)} className="link font-semibold">{portfolioHost(username)}</a>
          </p>
          <div className="mt-3">
            <CopyLink href={portfolioHref(username, host)} size="sm" />
          </div>
        </section>
      )}

      {phase2 && (
        <nav aria-label="Account settings" className="mt-6">
          <ul className="flex flex-wrap gap-x-6 gap-y-2 font-semibold">
            <li><Link href="/exhbts" className="link">Your exhbts</Link></li>
            <li><Link href="/account/portfolio" className="link">Portfolio settings</Link></li>
            <li><Link href="/account/billing" className="link">Billing</Link></li>
          </ul>
        </nav>
      )}

      <section aria-labelledby="data" className="mt-12 border-t border-line pt-8">
        <h2 id="data" className="text-[1.375rem]">Your data</h2>
        <p className="mt-3">Download everything we hold about you as a JSON file.</p>
        <div className="mt-4">
          <Button href="/api/account/export">Download my data</Button>
        </div>
      </section>

      <section aria-labelledby="delete" className="mt-12 border-t border-line pt-8">
        <h2 id="delete" className="text-[1.375rem]">Delete account</h2>
        <p className="mt-3">
          This removes your account, your CV text, your roadmaps, your exhbts and every file you uploaded straight away. It cannot be undone.
        </p>
        <form action="/api/account/delete" method="post" className="mt-4 space-y-4">
          <label className="flex items-start gap-3">
            <input type="checkbox" name="confirm" value="yes" required className="mt-1.5 size-4 accent-error" />
            <span>I understand this deletes everything.</span>
          </label>
          <Button type="submit" variant="danger">Delete my account</Button>
        </form>
      </section>
    </div>
  );
}
