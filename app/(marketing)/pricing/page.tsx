import type { Metadata } from "next";
import Link from "next/link";
import { Check, Minus } from "lucide-react";
import { WaitlistForm } from "@/components/waitlist/WaitlistForm";
import { ENTITLEMENTS, EXHBTS_PER_EMPLOYER_LINK } from "@/lib/entitlements";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Free skills-gap roadmaps. Premium hosts your exhbts with a custom link for each employer. Free for employers.",
};

type Cell = boolean | string;
const free = ENTITLEMENTS.free;
const premium = ENTITLEMENTS.premium;

const ROWS: { feature: string; free: Cell; premium: Cell }[] = [
  { feature: "Skills-gap roadmap for the job you want", free: true, premium: true },
  { feature: "Roadmap refreshes", free: `${free.roadmapsPer30Days} a month`, premium: "Unlimited" },
  { feature: "Exhbts hosted in your portfolio", free: false, premium: `Up to ${premium.exhbts}` },
  { feature: "AI drafting from your own files", free: false, premium: true },
  { feature: "Originality check on every exhbt", free: false, premium: true },
  { feature: "Portfolio link to send employers", free: false, premium: true },
  {
    feature: `Custom link per employer (${EXHBTS_PER_EMPLOYER_LINK} best-fit exhbts for each advert)`,
    free: false,
    premium: true,
  },
];

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-[76rem] px-4 pt-14 pb-24 sm:px-8 lg:pt-20">
      <div className="max-w-2xl">
        <h1 className="text-[2.8rem] sm:text-[4.4rem]">Pricing</h1>
        <p className="mt-4 text-lg text-ink-2">
          Roadmaps are free. Premium turns your finished projects into exhbts, hosted in a portfolio you can send
          to employers, with a tailored link for each one. Employers never pay.
        </p>
      </div>

      <div className="mt-12 grid gap-4 lg:grid-cols-[1fr_1.25fr]">
        <section aria-labelledby="free" className="rounded-[20px] border border-rule bg-sky p-7 sm:p-8">
          <h2 id="free" className="text-[1.5rem]">Free</h2>
          <p className="mt-2 text-[2.6rem] leading-none font-extrabold tracking-[-0.03em]">£0</p>
          <p className="mt-3 text-ink-2">
            Your skills-gap roadmap, refreshed up to {free.roadmapsPer30Days} times a month as your plans change.
          </p>
          <Link href="/roadmap/new" className="btn btn-secondary mt-6">Build my roadmap</Link>
        </section>

        <section aria-labelledby="premium-title" id="premium" className="scroll-mt-8 rounded-[20px] border-2 border-ink bg-surface p-7 sm:p-8">
          <div className="flex flex-wrap items-center gap-3">
            <h2 id="premium-title" className="text-[1.5rem]">Premium</h2>
            <span className="chip">Coming soon</span>
          </div>
          <p className="mt-3 max-w-[30rem] text-ink-2">
            Host up to {premium.exhbts} exhbts in your portfolio at <span className="font-mono text-sm text-ink">exhbt.co.uk/you</span>,
            and send each employer a custom link with the {EXHBTS_PER_EMPLOYER_LINK} exhbts that best fit their advert.
          </p>
          <p className="mt-5 font-semibold">Join the waitlist for early access</p>
          <div className="mt-3">
            <WaitlistForm source="pricing" />
          </div>
        </section>
      </div>

      <div className="mt-14 overflow-x-auto">
        <table className="w-full min-w-[34rem] text-left">
          <caption className="sr-only">What each plan includes</caption>
          <thead>
            <tr className="border-b border-ink text-sm">
              <th scope="col" className="w-[60%] py-3 pr-6 font-semibold">Feature</th>
              <th scope="col" className="px-4 py-3 font-semibold">Free</th>
              <th scope="col" className="px-4 py-3 font-semibold">Premium</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-rule">
            {ROWS.map((r) => (
              <tr key={r.feature}>
                <th scope="row" className="py-3.5 pr-6 font-normal">{r.feature}</th>
                <td className="px-4 py-3.5"><CellValue value={r.free} /></td>
                <td className="px-4 py-3.5"><CellValue value={r.premium} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section aria-labelledby="others" className="mt-16 grid gap-4 md:grid-cols-2">
        <div className="rounded-[20px] border border-rule p-7">
          <h2 id="others" className="text-[1.4rem]">Universities</h2>
          <p className="mt-2 text-ink-2">
            License Exhbt for your students and they all get Premium, with an admin view of take-up. Annual invoice.
          </p>
          <Link href="/universities" className="link mt-4 inline-block font-semibold">How licences work</Link>
        </div>
        <div className="rounded-[20px] border border-rule p-7">
          <h2 className="text-[1.4rem]">Employers</h2>
          <p className="mt-2 text-ink-2">Always free. Open any portfolio or exhbt link a candidate sends you; no account needed.</p>
          <Link href="/how-to-read-an-exhbt" className="link mt-4 inline-block font-semibold">How to read an exhbt</Link>
        </div>
      </section>

      <section aria-labelledby="faq" className="mt-20 grid gap-12 border-t border-rule pt-12 lg:grid-cols-[18rem_1fr]">
        <h2 id="faq" className="text-[1.9rem]">Questions</h2>
        <dl className="max-w-2xl space-y-8">
          <div>
            <dt className="font-medium">What counts as a roadmap refresh?</dt>
            <dd className="mt-1.5 text-ink-2">
              Building a new roadmap, for example for a different role or after updating your CV. Free accounts can do
              this {free.roadmapsPer30Days} times in any 30 days.
            </dd>
          </div>
          <div>
            <dt className="font-medium">When does Premium open, and what will it cost?</dt>
            <dd className="mt-1.5 text-ink-2">
              We&rsquo;re opening it to the waitlist first. You&rsquo;ll get the price and an invitation by email before
              anything is charged.
            </dd>
          </div>
          <div>
            <dt className="font-medium">My university has a licence. Do I need to pay?</dt>
            <dd className="mt-1.5 text-ink-2">No. Sign up with your university email address and you get Premium.</dd>
          </div>
          <div>
            <dt className="font-medium">Do employers need an account?</dt>
            <dd className="mt-1.5 text-ink-2">Never. They open the link you send them, on any device, for free.</dd>
          </div>
        </dl>
      </section>
    </div>
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
