import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowDown, ArrowUp } from "lucide-react";
import { createFromScratch, deleteExhbt, moveExhbt } from "./[id]/actions";
import { ConfirmAction } from "@/components/editor/ConfirmAction";
import { Button } from "@/components/ui/Button";
import { getCurrentUser } from "@/lib/auth";
import { PLAN_NAMES } from "@/lib/entitlements";
import { canCreateExhbt, getPlan, limitsFor } from "@/lib/plan";
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
  const [plan, exhbts] = await Promise.all([getPlan(user.id), store.listExhbts(user.id)]);
  const max = limitsFor(plan).exhbts;
  const room = canCreateExhbt(plan, exhbts);

  return (
    <div className="bg-mist">
      <div className="mx-auto max-w-3xl px-4 pt-10 pb-16 sm:px-8 lg:pt-14">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h1>Your exhbts</h1>
          <p className="text-sm text-graphite">
            <span className="font-mono text-ink">{exhbts.length}</span> of <span className="font-mono text-ink">{max}</span> used on {PLAN_NAMES[plan]}
          </p>
        </div>

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
            <p className="mt-2" role="status">
              {room.reason}{" "}
              <Link href="/pricing" className="link font-semibold">
                See plans
              </Link>
            </p>
          )}
        </section>

        {exhbts.length === 0 ? (
          <p className="mt-8 text-graphite">Nothing here yet. Your first exhbt will show here.</p>
        ) : (
          <ol aria-label="Your exhbts, in portfolio order" className="mt-8 space-y-3">
            {exhbts.map((e, i) => {
              const title = e.doc.title.trim() || "Untitled exhbt";
              return (
                <li key={e.id} className="flex flex-col gap-3 rounded-[16px] border border-line bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <span className={e.status === "published" ? "chip" : "chip bg-mist text-graphite"}>{e.status === "published" ? "Live" : "Draft"}</span>
                    <Link href={`/exhbts/${e.id}/edit`} className="link mt-1.5 block font-semibold break-words">
                      {title}
                    </Link>
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
