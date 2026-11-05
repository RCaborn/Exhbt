import type { Metadata } from "next";
import Link from "next/link";
import { Check, Minus } from "lucide-react";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Free roadmap. Evidence packs from £9 a year. Job-specific links for £15 a year.",
};

type Cell = boolean | string;
const ROWS: { feature: string; free: Cell; basic: Cell; custom: Cell }[] = [
  { feature: "Skills-gap roadmap", free: true, basic: true, custom: true },
  { feature: "Evidence packs", free: false, basic: "Unlimited", custom: "Unlimited" },
  { feature: "AI drafting from your own files", free: false, basic: true, custom: true },
  { feature: "Originality check on every pack", free: false, basic: true, custom: true },
  { feature: "Public link for each pack", free: false, basic: true, custom: true },
  { feature: "Job-specific links (3–4 best packs per advert)", free: false, basic: false, custom: "Unlimited" },
];

const PLANS = [
  { key: "free", name: "Free", price: "£0", note: "No card needed" },
  { key: "basic", name: "Basic", price: "£9", note: "a year, renews automatically" },
  { key: "custom", name: "Custom", price: "£15", note: "a year, renews automatically" },
] as const;

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-[76rem] px-4 pt-14 sm:px-8 lg:pt-20">
      <div className="max-w-2xl">
        <h1 className="text-[2.8rem] sm:text-[4.4rem]">Pricing</h1>
        <p className="mt-4 text-lg text-ink-2">
          The roadmap is free for everyone. Pay once a year when you have work worth showing, and cancel whenever
          you like.
        </p>
      </div>

      <div className="mt-12 overflow-x-auto">
        <table className="w-full min-w-[40rem] rounded-[14px] bg-surface text-left">
          <caption className="sr-only">Plans compared</caption>
          <thead>
            <tr className="border-b border-rule align-bottom">
              <th scope="col" className="w-[40%] py-6 pr-6 font-normal text-ink-2">
                <span className="sr-only">Feature</span>
              </th>
              {PLANS.map((p) => (
                <th key={p.key} scope="col" className="px-4 py-6 font-normal">
                  <span className="block font-medium">{p.name}</span>
                  <span className="mt-1 block text-[2.6rem] leading-none font-extrabold tracking-[-0.03em]">{p.price}</span>
                  <span className="mt-1.5 block text-sm text-ink-2">{p.note}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-rule">
            {ROWS.map((r) => (
              <tr key={r.feature}>
                <th scope="row" className="py-3.5 pr-6 font-normal">{r.feature}</th>
                {(["free", "basic", "custom"] as const).map((k) => (
                  <td key={k} className="px-4 py-3.5">
                    <CellValue value={r[k]} />
                  </td>
                ))}
              </tr>
            ))}
            <tr>
              <td className="py-6 pr-6" />
              <td className="px-4 py-6">
                <Link href="/roadmap/new" className="btn btn-secondary">Get your roadmap</Link>
              </td>
              <td className="px-4 py-6">
                {/* Checkout arrives in Release 2. */}
                <Link href="/roadmap/new" className="btn btn-secondary">Start free</Link>
              </td>
              <td className="px-4 py-6">
                <Link href="/roadmap/new" className="btn btn-primary">Start free</Link>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="hint mt-3">
        Paid plans open soon. Start with the free roadmap and you can upgrade from your account.
      </p>

      <section aria-labelledby="faq" className="mt-24 grid gap-12 border-t border-rule pt-12 lg:grid-cols-[18rem_1fr]">
        <h2 id="faq" className="text-[1.9rem]">Questions</h2>
        <dl className="max-w-2xl space-y-8">
          <div>
            <dt className="font-medium">What happens to my packs if I stop paying?</dt>
            <dd className="mt-1.5 text-ink-2">
              Published packs and links stay live and readable. You cannot edit them or publish new ones until you
              renew.
            </dd>
          </div>
          <div>
            <dt className="font-medium">Can I move from Basic to Custom part-way through the year?</dt>
            <dd className="mt-1.5 text-ink-2">Yes. You pay the difference for the months that are left.</dd>
          </div>
          <div>
            <dt className="font-medium">My university has a licence. Do I need to pay?</dt>
            <dd className="mt-1.5 text-ink-2">
              No. Sign up with your university email address and you get every Custom feature at no cost.
            </dd>
          </div>
          <div>
            <dt className="font-medium">Do employers need an account?</dt>
            <dd className="mt-1.5 text-ink-2">Never. They open the link you send them, on any device.</dd>
          </div>
          <div>
            <dt className="font-medium">How do you take payment?</dt>
            <dd className="mt-1.5 text-ink-2">
              Through Stripe. Your card details go to Stripe directly and never touch our servers.
            </dd>
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
