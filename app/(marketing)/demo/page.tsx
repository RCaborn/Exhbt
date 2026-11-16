import type { Metadata } from "next";
import Link from "next/link";
import { ExhbtTile } from "@/components/exhbt/ExhbtTile";
import { PortfolioHeader } from "@/components/exhbt/PortfolioHeader";
import { demoExhbts, demoOwner } from "@/lib/exhbt";
import { themeById } from "@/lib/portfolio-themes";

export const metadata: Metadata = {
  title: "Demo portfolio",
  description: "What an Exhbt portfolio looks like to an employer. A fictional graduate with four projects.",
};

/** A full demo of a public portfolio. The real host is portfolioHost() in lib/hosts.ts. */
export default function DemoPortfolio() {
  return (
    <div className="bg-mist pb-16">
      <PortfolioHeader
        // The demo keeps the ink band its copy and links are set for; the default look is now Exhbt (decision 0016).
        theme={themeById("ink")}
        owner={demoOwner}
        exhbts={demoExhbts}
        note={
          <>
            Example portfolio. The person, the address and the projects are fictional.{" "}
            <Link href="/pricing" className="font-semibold text-white underline decoration-white/40 underline-offset-4 hover:decoration-mint">
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
      </div>
    </div>
  );
}
