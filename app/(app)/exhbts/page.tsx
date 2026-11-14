import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { ArrowDown, ArrowUp } from "lucide-react";
import { createFromScratch, deleteExhbt, moveExhbt } from "./[id]/actions";
import { ConfirmAction } from "@/components/editor/ConfirmAction";
import { UpgradePrompt } from "@/components/site/UpgradePrompt";
import { Button } from "@/components/ui/Button";
import { getCurrentUser } from "@/lib/auth";
import { ENTITLEMENTS, PLAN_NAMES } from "@/lib/entitlements";
import { headlineFor } from "@/lib/exhbt/headline";
import { canCreateExhbt, getPlan, limitsFor } from "@/lib/plan";
import { portfolioHref } from "@/lib/portfolio-links";
import { isPhase2Enabled } from "@/lib/site";
import { getStore } from "@/lib/store";

export const metadata: Metadata = { title: "Your exhbts", robots: { index: false } };
// Per request: the EXHBT_PHASE2 switch and the session are read at runtime, never baked in at build.
export const dynamic = "force-dynamic";

const updated = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

/** A person's exhbts, in portfolio order: start one, open one, reorder, delete. */
export default async function ExhbtsPage() {
  if (!isPhase2Enabled()) notFound();
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/exhbts");
  const store = getStore();
  const [plan, exhbts, profile, host] = await Promise.all([
    getPlan(user.id),
    store.listExhbts(user.id),
    store.getPortfolioProfile(user.id),
    headers().then((h) => h.get("x-forwarded-host") ?? h.get("host")),
  ]);
  const max = limitsFor(plan).exhbts;
  const room = canCreateExhbt(plan, exhbts);
  const canGoLive = ENTITLEMENTS[plan].publicPortfolio;

  return (
    <div className="bg-mist">
      <div className="mx-auto max-w-3xl px-4 pt-10 pb-16 sm:px-8 lg:pt-14">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h1>Your exhbts</h1>
          <p className="text-sm text-graphite">
            {exhbts.length > max ? (
              <>
                <span className="font-mono text-ink">{exhbts.length}</span> exhbts · {PLAN_NAMES[plan]} holds <span className="font-mono text-ink">{max}</span>
              </>
            ) : (
              <>
                <span className="font-mono text-ink">{exhbts.length}</span> of <span className="font-mono text-ink">{max}</span> used on {PLAN_NAMES[plan]}
              </>
            )}
          </p>
        </div>

        {!canGoLive && (
          <section aria-labelledby="preview-only" className="mt-6 rounded-[20px] border border-line bg-surface p-5 sm:p-6">
            <h2 id="preview-only" className="text-[1.375rem]">Preview only on {PLAN_NAMES[plan]}</h2>
            <p className="mt-2 text-graphite">Build and preview your exhbts here. Publishing them to your own link comes with {PLAN_NAMES.premium}.</p>
            {/* When the plan is full, the New exhbt card below carries the upgrade prompt. */}
            {room.ok && <UpgradePrompt className="mt-3" reason={`Ready to share them? ${PLAN_NAMES.premium} publishes to your own link.`} upgradeTo="premium" />}
          </section>
        )}

        <section aria-labelledby="new" className="mt-8 rounded-[20px] border border-line bg-surface p-5 sm:p-6">
          <h2 id="new" className="text-[1.375rem]">New exhbt</h2>
          {room.ok ? (
            <>
              <p className="mt-2 text-graphite">Upload your project and we&apos;ll draft it for you, or write it yourself.</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Button href="/exhbts/new" variant="primary">
                  Upload your project
                </Button>
                <form action={createFromScratch}>
                  <Button type="submit">Start from scratch</Button>
                </form>
              </div>
            </>
          ) : (
            <UpgradePrompt reason={room.reason} upgradeTo={room.upgradeTo} className="mt-3" />
          )}
        </section>

        {exhbts.length === 0 ? (
          <p className="mt-8 text-graphite">Nothing here yet. Your first exhbt will show here.</p>
        ) : (
          <ol aria-label="Your exhbts, in portfolio order" className="mt-8 space-y-3">
            {exhbts.map((e, i) => {
              const title = e.doc.title.trim() || "Untitled exhbt";
              const headline = headlineFor(e.doc);
              const viewHref = canGoLive && e.status === "published" && e.slug && profile.username ? `${portfolioHref(profile.username, host)}/${e.slug}` : null;
              return (
                <li key={e.id} className="flex flex-col gap-3 rounded-[16px] border border-line bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <span className={canGoLive && e.status === "published" ? "chip" : "chip bg-mist text-graphite"}>
                      {!canGoLive ? "Preview only" : e.status === "published" ? "Live" : "Draft"}
                    </span>
                    <Link href={`/exhbts/${e.id}/edit`} className="link mt-1.5 block font-semibold break-words">
                      {title}
                    </Link>
                    {headline && (
                      <span className="mt-0.5 block text-sm" data-headline>
                        <span className="font-mono font-semibold text-ink">{headline.value}</span> <span className="text-graphite">{headline.label}</span>
                      </span>
                    )}
                    <span className="text-sm text-graphite">Updated {updated(e.updatedAt)}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 sm:shrink-0 sm:flex-nowrap">
                    <form action={moveExhbt.bind(null, e.id, -1)}>
                      <Button type="submit" size="sm" disabled={i === 0} label={`Move ${title} up`}>
                        <ArrowUp aria-hidden size={14} strokeWidth={2.25} />
                      </Button>
                    </form>
                    <form action={moveExhbt.bind(null, e.id, 1)}>
                      <Button type="submit" size="sm" disabled={i === exhbts.length - 1} label={`Move ${title} down`}>
                        <ArrowDown aria-hidden size={14} strokeWidth={2.25} />
                      </Button>
                    </form>
                    {viewHref && (
                      <Button href={viewHref} size="sm" label={`View ${title}`}>
                        View
                      </Button>
                    )}
                    <Button href={`/exhbts/${e.id}/edit`} size="sm" label={`Edit ${title}`}>
                      Edit
                    </Button>
                    <ConfirmAction
                      label="Delete"
                      accessibleLabel={`Delete ${title}`}
                      variant="danger"
                      question="Delete it for good?"
                      confirmLabel="Yes, delete"
                      action={deleteExhbt.bind(null, e.id)}
                    />
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}
