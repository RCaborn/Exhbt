import type { Metadata } from "next";
import Link from "next/link";
import { WaitlistForm } from "@/components/waitlist/WaitlistForm";
import {
  BILLING_PERIOD,
  ENTITLEMENTS,
  EXHBTS_PER_JOB_LINK,
  JOB_LINKS_LIVE,
  PLAN_NAMES,
  PRICES,
  planFeatures,
} from "@/lib/entitlements";
import { FeatureList } from "@/components/site/FeatureList";
import { Button } from "@/components/ui/Button";
import { isPhase2Enabled } from "@/lib/site";

// Per request: the EXHBT_PHASE2 switch is read at runtime, so the paid plans appear (or go back
// to the waitlist) without a rebuild.
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ preview?: string }> };

/**
 * Selling for real (Phase 2 on) or the waitlist (Phase 2 off, the live site today). In development
 * `?preview=waitlist` shows the waitlist version, so its tests still run with Phase 2 on.
 */
async function selling({ searchParams }: Props): Promise<boolean> {
  if (!isPhase2Enabled()) return false;
  return !(process.env.NODE_ENV !== "production" && (await searchParams).preview === "waitlist");
}

/** What Max adds over Premium, said only as far as it's built. */
const maxExtra = (sell: boolean) =>
  !sell || JOB_LINKS_LIVE ? "adds a link for every job" : "adds room for more, with a link for every job coming soon";

export async function generateMetadata(props: Props): Promise<Metadata> {
  const sell = await selling(props);
  return {
    title: "Pricing",
    description: `Free includes the roadmap and an exhbt to try. ${PLAN_NAMES.premium} puts your exhbts on your own link, and ${PLAN_NAMES.max} ${maxExtra(sell)}. Employers never pay.`,
  };
}

const { free, premium, max } = ENTITLEMENTS;

export default async function PricingPage(props: Props) {
  const sell = await selling(props);
  return (
    <div className="mx-auto max-w-[76rem] px-4 pt-14 pb-24 sm:px-8 lg:pt-20">
      <div className="max-w-2xl">
        <h1 className="display">Pricing</h1>
        <p className="mt-4 text-lg text-graphite">
          The roadmap is free, and so is trying an exhbt. {PLAN_NAMES.premium} puts your exhbts on your own link, and{" "}
          {PLAN_NAMES.max} {maxExtra(sell)}. Employers never pay.
        </p>
      </div>

      <div className="mt-12 grid gap-4 lg:grid-cols-3">
        <section aria-labelledby="tier-free" className="flex flex-col rounded-[20px] border border-line bg-mist p-7">
          <h2 id="tier-free" className="text-[1.375rem]">{PLAN_NAMES.free}</h2>
          <p className="mt-2 text-[2.6rem] leading-none font-extrabold tracking-[-0.03em]">{PRICES.free}</p>
          <p className="mt-3 text-graphite">Start here. No card, nothing to install.</p>
          <FeatureList items={planFeatures("free")} className="mt-5" />
          <div className="mt-auto pt-6">
            <Button href="/roadmap/new">Build my roadmap</Button>
          </div>
        </section>

        <Tier
          id="premium"
          name={PLAN_NAMES.premium}
          summary="Your best projects on one link you can send to any employer."
          sell={sell}
        />
        <Tier
          id="max"
          name={PLAN_NAMES.max}
          featured
          summary={
            !sell || JOB_LINKS_LIVE
              ? "A tailored link for every application, built from the job description."
              : "Room for more exhbts, and a tailored link for every application when it arrives."
          }
          sell={sell}
        />
      </div>

      <section aria-labelledby="others" className="mt-16 grid gap-4 md:grid-cols-2">
        <div className="rounded-[20px] border border-line p-7">
          <h2 id="others" className="text-[1.375rem]">Universities</h2>
          <p className="mt-2 text-graphite">
            License Exhbt for your students and they all get {PLAN_NAMES.max}, with an admin view of take-up.
            Annual invoice.
          </p>
          <Link href="/universities" className="link mt-4 inline-block font-semibold">How licences work</Link>
        </div>
        <div className="rounded-[20px] border border-line p-7">
          <h2 className="text-[1.375rem]">Employers</h2>
          <p className="mt-2 text-graphite">Always free. Open any link a candidate sends you; no account needed.</p>
          <Link href="/how-to-read-an-exhbt" className="link mt-4 inline-block font-semibold">How to read an exhbt</Link>
        </div>
      </section>

      <section aria-labelledby="faq" className="mt-20 grid gap-12 border-t border-line pt-12 lg:grid-cols-[18rem_1fr]">
        <h2 id="faq" className="">Questions</h2>
        <dl className="max-w-2xl space-y-8">
          <div>
            <dt className="font-medium">What counts as a roadmap refresh?</dt>
            <dd className="mt-1.5 text-graphite">
              Building a new roadmap, for example for a different job or after your situation changes. {PLAN_NAMES.free}{" "}
              includes {free.roadmapsPer30Days} {free.roadmapsPer30Days === 1 ? "refresh" : "refreshes"} in any 30 days.{" "}
              {PLAN_NAMES.premium} includes {premium.roadmapsPer30Days} refreshes, and {PLAN_NAMES.max} includes {max.roadmapsPer30Days} refreshes.
            </dd>
          </div>
          <div>
            <dt className="font-medium">What&rsquo;s the difference between {PLAN_NAMES.premium} and {PLAN_NAMES.max}?</dt>
            <dd className="mt-1.5 text-graphite">
              {PLAN_NAMES.premium} gives you your own portfolio link with up to {premium.exhbts} exhbts. {PLAN_NAMES.max} holds up to{" "}
              {max.exhbts}, and makes a separate link for each job you apply to, showing the {EXHBTS_PER_JOB_LINK} that
              fit that job description best.{sell && !JOB_LINKS_LIVE && " The links for each job are coming soon."}
            </dd>
          </div>
          {sell ? (
            <div>
              <dt className="font-medium">How does paying work?</dt>
              <dd className="mt-1.5 text-graphite">
                {PLAN_NAMES.premium} is {PRICES.premium} and {PLAN_NAMES.max} is {PRICES.max} a {BILLING_PERIOD}, paid by card through
                Stripe. Change plan or cancel from Account, Billing. If you move to a smaller plan, nothing is deleted.
              </dd>
            </div>
          ) : (
            <div>
              <dt className="font-medium">When do they open, and what will they cost?</dt>
              <dd className="mt-1.5 text-graphite">
                We&rsquo;re opening them to the waitlist first. You&rsquo;ll get the price and an invitation by email
                before anything is charged.
              </dd>
            </div>
          )}
          <div>
            <dt className="font-medium">My university has a licence. Do I need to pay?</dt>
            <dd className="mt-1.5 text-graphite">No. Sign up with your university email address and you get {PLAN_NAMES.max}.</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}

function Tier({
  id,
  name,
  summary,
  featured,
  sell,
}: {
  id: "premium" | "max";
  name: string;
  summary: string;
  featured?: boolean;
  sell: boolean;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`tier-${id}`}
      className={`flex scroll-mt-8 flex-col rounded-[20px] p-7 ${featured ? "border-2 border-ink bg-surface" : "border border-line bg-surface"}`}
    >
      <div className="flex flex-wrap items-center gap-3">
        <h2 id={`tier-${id}`} className="text-[1.375rem]">{name}</h2>
        {!sell && <span className="chip">Coming soon</span>}
      </div>
      <p className="mt-2 text-[2.6rem] leading-none font-extrabold tracking-[-0.03em]">
        {PRICES[id]}
        <span className="ml-1 text-base font-semibold tracking-normal text-graphite">a {BILLING_PERIOD}</span>
      </p>
      <p className="mt-3 text-graphite">{summary}</p>
      <FeatureList items={planFeatures(id)} className="mt-5" />
      {sell ? (
        <div className="mt-auto pt-7">
          {/* Billing sends anyone signed out to sign in first, then back (app/(app)/account/billing). */}
          <Button href="/account/billing" variant={featured ? "primary" : "secondary"}>{`Choose ${name}`}</Button>
        </div>
      ) : (
        <div className="mt-auto pt-7">
          <p className="mb-2 text-sm font-semibold">Join the waitlist</p>
          <WaitlistForm source={`pricing-${id}`} interest={id} />
        </div>
      )}
    </section>
  );
}
