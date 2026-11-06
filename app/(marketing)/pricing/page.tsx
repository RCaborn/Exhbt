import type { Metadata } from "next";
import Link from "next/link";
import { Check, Minus } from "lucide-react";
import { WaitlistForm } from "@/components/waitlist/WaitlistForm";
import { ENTITLEMENTS, EXHBTS_PER_JOB_LINK, PLAN_NAMES, PRICES } from "@/lib/entitlements";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Free skills roadmap. Plus hosts 4 exhbts with your own link. Premium hosts 10, with a custom link for every job. Free for employers.",
};

type Cell = boolean | string;
const { free, plus, premium } = ENTITLEMENTS;
const refreshes = (n: number | null) => (n === null ? "Unlimited" : `${n} a month`);
const count = (n: number) => (n === 0 ? false : `${n}`);

const ROWS: { feature: string; free: Cell; plus: Cell; premium: Cell }[] = [
  { feature: "Skills roadmap for the job you want", free: true, plus: true, premium: true },
  { feature: "Roadmap refreshes", free: refreshes(free.roadmapsPer30Days), plus: refreshes(plus.roadmapsPer30Days), premium: refreshes(premium.roadmapsPer30Days) },
  { feature: "Exhbts hosted", free: count(free.exhbts), plus: count(plus.exhbts), premium: `Up to ${premium.exhbts}` },
  { feature: "Your own link to send employers (exhbt.co.uk/you)", free: free.personalLink, plus: plus.personalLink, premium: premium.personalLink },
  {
    feature: `A custom link for each job: upload the description, we pick your ${EXHBTS_PER_JOB_LINK} best-fit exhbts`,
    free: free.jobLinks,
    plus: plus.jobLinks,
    premium: premium.jobLinks,
  },
  { feature: "AI drafting and originality check for each exhbt", free: false, plus: true, premium: true },
];

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-[76rem] px-4 pt-14 pb-24 sm:px-8 lg:pt-20">
      <div className="max-w-2xl">
        <h1 className="text-[2.8rem] sm:text-[4.4rem]">Pricing</h1>
        <p className="mt-4 text-lg text-ink-2">
          The roadmap is free. Plus and Premium host your finished projects as exhbts and give you links to send
          employers. Employers never pay.
        </p>
      </div>

      <div className="mt-12 grid gap-4 lg:grid-cols-3">
        <section aria-labelledby="tier-free" className="flex flex-col rounded-[20px] border border-rule bg-sky p-7">
          <h2 id="tier-free" className="text-[1.5rem]">{PLAN_NAMES.free}</h2>
          <p className="mt-2 text-[2.6rem] leading-none font-extrabold tracking-[-0.03em]">{PRICES.free}</p>
          <p className="mt-3 text-ink-2">
            Your skills roadmap, refreshed up to {free.roadmapsPer30Days} times a month as your plans change.
          </p>
          <div className="mt-auto pt-6">
            <Link href="/roadmap/new" className="btn btn-secondary">Build my roadmap</Link>
          </div>
        </section>

        <Tier
          id="plus"
          name={PLAN_NAMES.plus}
          summary={`Host ${plus.exhbts} exhbts on your own link, exhbt.co.uk/you, and send it to any employer. Unlimited roadmap refreshes.`}
        />
        <Tier
          id="premium"
          name={PLAN_NAMES.premium}
          featured
          summary={`Up to ${premium.exhbts} exhbts. Upload a job description and get a custom link with the ${EXHBTS_PER_JOB_LINK} that suit it best, one for every application.`}
        />
      </div>

      <div className="mt-14 overflow-x-auto">
        <table className="w-full min-w-[40rem] text-left">
          <caption className="sr-only">What each plan includes</caption>
          <thead>
            <tr className="border-b border-ink text-sm">
              <th scope="col" className="w-[52%] py-3 pr-6 font-semibold">Feature</th>
              <th scope="col" className="px-3 py-3 font-semibold">{PLAN_NAMES.free}</th>
              <th scope="col" className="px-3 py-3 font-semibold">{PLAN_NAMES.plus}</th>
              <th scope="col" className="px-3 py-3 font-semibold">{PLAN_NAMES.premium}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-rule">
            {ROWS.map((r) => (
              <tr key={r.feature}>
                <th scope="row" className="py-3.5 pr-6 font-normal">{r.feature}</th>
                <td className="px-3 py-3.5"><CellValue value={r.free} /></td>
                <td className="px-3 py-3.5"><CellValue value={r.plus} /></td>
                <td className="px-3 py-3.5"><CellValue value={r.premium} /></td>
              </tr>
            ))}
          </tbody>
        </table>
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
              Building a new roadmap, for example for a different job or after your situation changes. Free accounts
              can do this {free.roadmapsPer30Days} times in any 30 days; {PLAN_NAMES.plus} and {PLAN_NAMES.premium} have no limit.
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
      <div className="mt-auto pt-6">
        <p className="mb-2 text-sm font-semibold">Join the waitlist</p>
        <WaitlistForm source={`pricing-${id}`} interest={id} />
      </div>
    </section>
  );
}

function CellValue({ value }: { value: Cell }) {
  if (value === true)
    return (
      <span className="inline-flex size-5 items-center justify-center rounded-full border border-ink bg-green">
        <Check aria-label="Included" size={12} strokeWidth={3} />
      </span>
    );
  if (value === false) return <Minus aria-label="Not included" size={18} strokeWidth={1.5} className="text-quiet" />;
  return <span>{value}</span>;
}
