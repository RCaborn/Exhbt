import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { ConfirmAction } from "@/components/editor/ConfirmAction";
import { IntroForm, SlugForm } from "@/components/job-links/JobLinkFields";
import { Button } from "@/components/ui/Button";
import { deleteJobLink, movePick, setJobLinkStatus } from "../actions";
import { getCurrentUser } from "@/lib/auth";
import { portfolioHref } from "@/lib/portfolio-links";
import { isPhase2Enabled } from "@/lib/site";
import { getStore } from "@/lib/store";

export const metadata: Metadata = { title: "Job link", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function JobLinkPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notice?: string }>;
}) {
  if (!isPhase2Enabled()) notFound();
  const { id } = await params;
  const { notice } = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/job-links/${id}`);

  const store = getStore();
  const link = await store.getJobLink(id);
  if (!link || link.userId !== user.id) notFound();
  const [profile, exhbts, host] = await Promise.all([
    store.getPortfolioProfile(user.id),
    store.listExhbts(user.id),
    headers().then((h) => h.get("x-forwarded-host") ?? h.get("host")),
  ]);
  const byId = new Map(exhbts.map((e) => [e.id, e]));
  const ranked = link.picks.some((p) => p.reason);
  const href = profile.username && link.status === "live" ? portfolioHref(profile.username, host, link.slug) : null;

  return (
    <div className="mx-auto max-w-2xl px-4 pt-12 pb-16 sm:px-8 lg:pt-16">
      <p className="text-sm font-semibold"><Link href="/job-links" className="link">Job links</Link></p>
      <h1 className="mt-3">{link.company} · {link.roleTitle}</h1>
      <p className="mt-3 text-graphite">{link.status === "live" ? "Live" : "Off"} · {link.viewCount === 0 ? "not opened yet" : link.viewCount === 1 ? "opened 1 time" : `opened ${link.viewCount} times`}</p>
      {notice && <p className="mt-4 text-error" role="alert">{notice}</p>}

      {href && (
        <p className="mt-4">
          <a href={href} className="link font-mono text-sm">{href.replace(/^https:\/\//, "")}</a>
        </p>
      )}

      <div className="mt-8">
        <SlugForm id={link.id} slug={link.slug} slugStyle={link.slugStyle} />
      </div>
      <div className="mt-8">
        <IntroForm id={link.id} intro={link.intro} />
      </div>

      <section className="mt-10" aria-labelledby="picks">
        <h2 id="picks" className="text-[1.375rem]">Projects on this link</h2>
        <p className="mt-2 text-sm text-graphite">
          {ranked
            ? "Ordered as the match suggested. Move any of them."
            : "In portfolio order, because a match wasn't run. Move any of them."}
        </p>
        <ol className="mt-4 space-y-3">
          {link.picks.map((p, i) => {
            const exhbt = byId.get(p.exhbtId);
            return (
              <li key={p.exhbtId} className="rounded-[14px] border border-line bg-surface p-4">
                <p className="font-semibold">{exhbt?.doc.title || "This exhbt is no longer on your account"}</p>
                {p.reason && <p className="mt-1 text-sm text-graphite">{p.reason}</p>}
                <div className="mt-3 flex gap-2">
                  <form action={movePick}>
                    <input type="hidden" name="id" value={link.id} />
                    <input type="hidden" name="exhbtId" value={p.exhbtId} />
                    <input type="hidden" name="dir" value="up" />
                    <Button type="submit" variant="secondary" size="sm" disabled={i === 0}>Move up</Button>
                  </form>
                  <form action={movePick}>
                    <input type="hidden" name="id" value={link.id} />
                    <input type="hidden" name="exhbtId" value={p.exhbtId} />
                    <input type="hidden" name="dir" value="down" />
                    <Button type="submit" variant="secondary" size="sm" disabled={i === link.picks.length - 1}>Move down</Button>
                  </form>
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      <div className="mt-10 flex flex-wrap gap-3 border-t border-line pt-8">
        <form action={setJobLinkStatus}>
          <input type="hidden" name="id" value={link.id} />
          <input type="hidden" name="status" value={link.status === "live" ? "off" : "live"} />
          <Button type="submit" variant="secondary">{link.status === "live" ? "Turn off" : "Turn on"}</Button>
        </form>
        <ConfirmAction
          label="Delete"
          accessibleLabel={`Delete the ${link.company} link`}
          variant="danger"
          question="Delete this job link?"
          confirmLabel="Yes, delete"
          action={deleteJobLink.bind(null, link.id)}
        />
      </div>
    </div>
  );
}
