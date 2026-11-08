import type { Metadata } from "next";
import Link from "next/link";
import { WaitlistForm } from "@/components/waitlist/WaitlistForm";
import { ENTITLEMENTS, EXHBTS_PER_JOB_LINK, PLAN_NAMES, PRICES, planFeatures } from "@/lib/entitlements";
import { FeatureList } from "@/components/site/FeatureList";

export const metadata: Metadata = {
  title: "Pricing",
  description: `Free includes the roadmap and a portfolio link. ${PLAN_NAMES.plus} and ${PLAN_NAMES.premium} raise the limits. Employers never pay.`,
};

const { free, plus, premium } = ENTITLEMENTS;

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-[76rem] px-4 pt-14 pb-24 sm:px-8 lg:pt-20">
      <div className="max-w-2xl">
        <h1 className="text-[2.8rem] sm:text-[4.4rem]">Pricing</h1>
        <p className="mt-4 text-lg text-ink-2">
          The roadmap is free, and {PLAN_NAMES.free} includes a portfolio link. {PLAN_NAMES.plus} and {PLAN_NAMES.premium}{" "}
          raise the limits. Employers never pay.
        </p>
      </div>

      <div className="mt-12 grid gap-4 lg:grid-cols-3">
        <section aria-labelledby="tier-free" className="flex flex-col rounded-[20px] border border-rule bg-sky p-7">
          <h2 id="tier-free" className="text-[1.5rem]">{PLAN_NAMES.free}</h2>
          <p className="mt-2 text-[2.6rem] leading-none font-extrabold tracking-[-0.03em]">{PRICES.free}</p>
          <p className="mt-3 text-ink-2">Start here. No card, nothing to install.</p>
          <FeatureList items={planFeatures("free")} className="mt-5" />
          <div className="mt-auto pt-6">
            <Link href="/roadmap/new" className="btn btn-secondary">Build my roadmap</Link>
          </div>
        </section>

        <Tier
          id="plus"
          name={PLAN_NAMES.plus}
          summary="Your best projects on one link you can send to any employer."
        />
        <Tier
          id="premium"
          name={PLAN_NAMES.premium}
          featured
          summary="A tailored link for every application, built from the job description."
        />
      </div>

      <section aria-labelledby="others" className="mt-16 grid gap-4 md:grid-cols-2">
        <div className="rounded-[20px] border border-rule p-7">
          <h2 id="others" className="text-[1.4rem]">Universities</h2>
          <p className="mt-2 text-ink-2">
            License Exhbt for your students and they all get {PLAN_NAMES.premium}, with an admin view of take-up.
            Annual invoice.
          </p>
          <Link href="/universities" className="link mt-4 inline-block font-semibold">How licences work</Link>
        </div>
        <div className="rounded-[20px] border border-rule p-7">
          <h2 className="text-[1.4rem]">Employers</h2>
          <p className="mt-2 text-ink-2">Always free. Open any link a candidate sends you; no account needed.</p>
          <Link href="/how-to-read-an-exhbt" className="link mt-4 inline-block font-semibold">How to read an exhbt</Link>
        </div>
      </section>

      <section aria-labelledby="faq" className="mt-20 grid gap-12 border-t border-rule pt-12 lg:grid-cols-[18rem_1fr]">
        <h2 id="faq" className="text-[1.9rem]">Questions</h2>
        <dl className="max-w-2xl space-y-8">
          <div>
            <dt className="font-medium">What counts as a roadmap refresh?</dt>
            <dd className="mt-1.5 text-ink-2">
              Building a new roadmap, for example for a different job or after your situation changes. {PLAN_NAMES.free}{" "}
              includes {free.roadmapsPer30Days} {free.roadmapsPer30Days === 1 ? "refresh" : "refreshes"} in any 30 days.{" "}
              {PLAN_NAMES.plus} includes {plus.roadmapsPer30Days} refreshes, and {PLAN_NAMES.premium} includes {premium.roadmapsPer30Days} refreshes.
            </dd>
          </div>
          <div>
            <dt className="font-medium">What&rsquo;s the difference between {PLAN_NAMES.plus} and {PLAN_NAMES.premium}?</dt>
            <dd className="mt-1.5 text-ink-2">
              {PLAN_NAMES.plus} gives you one portfolio link with {plus.exhbts} exhbts. {PLAN_NAMES.premium} holds up to{" "}
              {premium.exhbts}, and makes a separate link for each job you apply to, showing the {EXHBTS_PER_JOB_LINK} that
              fit that job description best.
            </dd>
          </div>
          <div>
            <dt className="font-medium">When do they open, and what will they cost?</dt>
            <dd className="mt-1.5 text-ink-2">
              We&rsquo;re opening them to the waitlist first. You&rsquo;ll get the price and an invitation by email
              before anything is charged.
            </dd>
          </div>
          <div>
            <dt className="font-medium">My university has a licence. Do I need to pay?</dt>
            <dd className="mt-1.5 text-ink-2">No. Sign up with your university email address and you get {PLAN_NAMES.premium}.</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}

function Tier({ id, name, summary, featured }: { id: "plus" | "premium"; name: string; summary: string; featured?: boolean }) {
  return (
    <section
      id={id}
      aria-labelledby={`tier-${id}`}
      className={`flex scroll-mt-8 flex-col rounded-[20px] p-7 ${featured ? "border-2 border-ink bg-surface" : "border border-rule bg-surface"}`}
    >
      <div className="flex flex-wrap items-center gap-3">
        <h2 id={`tier-${id}`} className="text-[1.5rem]">{name}</h2>
        <span className="chip">Coming soon</span>
      </div>
      <p className="mt-3 text-ink-2">{summary}</p>
      <FeatureList items={planFeatures(id)} className="mt-5" />
      <div className="mt-auto pt-7">
        <p className="mb-2 text-sm font-semibold">Join the waitlist</p>
        <WaitlistForm source={`pricing-${id}`} interest={id} />
      </div>
    </section>
  );
}
