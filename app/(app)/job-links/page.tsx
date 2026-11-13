import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { getCurrentUser } from "@/lib/auth";
import { canMakeJobLinks, getPlan } from "@/lib/plan";
import { portfolioHref } from "@/lib/portfolio-links";
import { isPhase2Enabled } from "@/lib/site";
import { getStore } from "@/lib/store";

export const metadata: Metadata = { title: "Job links", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function JobLinksPage() {
  if (!isPhase2Enabled()) notFound();
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/job-links");

  const store = getStore();
  const [plan, links, profile, host] = await Promise.all([
    getPlan(user.id),
    store.listJobLinks(user.id),
    store.getPortfolioProfile(user.id),
    headers().then((h) => h.get("x-forwarded-host") ?? h.get("host")),
  ]);
  const live = links.filter((l) => l.status === "live").length;
  const allowed = canMakeJobLinks(plan, live);

  return (
    <div className="mx-auto max-w-2xl px-4 pt-12 pb-16 sm:px-8 lg:pt-16">
      <p className="text-sm font-semibold"><Link href="/account" className="link">Account</Link></p>
      <h1 className="mt-3">Job links</h1>
      <p className="mt-3 text-graphite">
        A separate page for one application, with the projects that fit that job. Search engines don&rsquo;t list it, and you can turn it off.
      </p>

      {links.length > 0 && (
        <ul className="mt-8 divide-y divide-line border-y border-line">
          {links.map((l) => {
            const href = profile.username && l.status === "live" ? portfolioHref(profile.username, host, l.slug) : null;
            return (
              <li key={l.id} className="flex flex-wrap items-baseline justify-between gap-3 py-4">
                <div>
                  <Link href={`/job-links/${l.id}`} className="font-semibold hover:underline">{l.company} · {l.roleTitle}</Link>
                  <p className="mt-1 font-mono text-sm text-graphite">{href ? href.replace(/^https:\/\//, "") : "Off"}</p>
                </div>
                <p className="text-sm text-graphite">{opened(l.viewCount)}</p>
              </li>
            );
          })}
        </ul>
      )}

      {links.length === 0 && <p className="mt-8">You haven&rsquo;t made one yet.</p>}

      <div className="mt-8">
        {allowed.ok ? (
          <Button href="/job-links/new" variant="primary">Make a job link</Button>
        ) : (
          <p>{allowed.reason} {allowed.upgradeTo && <Link href="/account/billing" className="link font-semibold">Billing</Link>}</p>
        )}
      </div>
    </div>
  );
}

function opened(n: number): string {
  if (n === 0) return "Not opened yet";
  return n === 1 ? "Opened 1 time" : `Opened ${n} times`;
}
