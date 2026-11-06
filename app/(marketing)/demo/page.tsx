import type { Metadata } from "next";
import Link from "next/link";
import { MadeWith } from "@/components/brand/MadeWith";
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
    <div className="bg-sky pb-16">
      <PortfolioHeader
        owner={demoOwner}
        exhbts={demoExhbts}
        note={
          <>
            Demo portfolio. The person and projects are fictional.{" "}
            <Link href="/pricing" className="font-semibold text-white underline decoration-white/40 underline-offset-4 hover:decoration-blue">
              Get your own
            </Link>
          </>
        }
      />
      <div className="mx-auto max-w-[64rem] px-4 pt-8 sm:px-8 sm:pt-10">
        <h2 className="sr-only">Exhbts</h2>
        <ul className="grid gap-4 md:grid-cols-2">
          {demoExhbts.map((e, i) => (
            <li key={e.slug}>
              <ExhbtTile exhbt={e} href={`/demo/${e.slug}`} position={i + 1} />
            </li>
          ))}
        </ul>
        <MadeWith />
      </div>
    </div>
  );
}
