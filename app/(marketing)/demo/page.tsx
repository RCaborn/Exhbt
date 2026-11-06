import type { Metadata } from "next";
import Link from "next/link";
import { ExhbtTile } from "@/components/exhbt/ExhbtTile";
import { PortfolioHeader } from "@/components/exhbt/PortfolioHeader";
import { demoExhbts, demoOwner } from "@/lib/exhbt";

export const metadata: Metadata = {
  title: "Demo portfolio",
  description: "What an Exhbt portfolio looks like to an employer. A fictional graduate with four projects.",
};

/** A full demo of a public portfolio (the real one lives at exhbt.co.uk/<username>). */
export default function DemoPortfolio() {
  return (
    <div className="bg-sky pb-24">
      <div className="mx-auto max-w-[64rem] px-4 pt-8 sm:px-8 sm:pt-12">
        <p className="mb-4 text-sm text-ink-2">
          Demo portfolio. The person and projects are fictional.{" "}
          <Link href="/pricing" className="link text-ink">Get your own</Link>
        </p>
        <PortfolioHeader owner={demoOwner} exhbts={demoExhbts} />
        <h2 className="sr-only">Exhbts</h2>
        <ul className="mt-6 grid gap-4 md:grid-cols-2">
          {demoExhbts.map((e) => (
            <li key={e.slug}>
              <ExhbtTile exhbt={e} href={`/demo/${e.slug}`} />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
