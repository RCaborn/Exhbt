import type { Metadata } from "next";
import { PortfolioHome } from "@/components/portfolio/PortfolioHome";
import { DemoNote } from "@/components/home/DemoNote";
import { demoHomeProjects, demoOwner, demoPortfolio } from "@/lib/exhbt";

export const metadata: Metadata = {
  title: "Demo portfolio",
  description: "What an Exhbt portfolio looks like to an employer. A fictional graduate with four projects.",
};

/**
 * The demo portfolio: Amara's home page drawn by the real portfolio home (`PortfolioHome`,
 * decision 0016) in the default look, with a bar above it saying it's made up. Her exhbts open at
 * /demo/<slug>, drawn by the real exhbt page.
 */
export default function DemoPortfolio() {
  return (
    <>
      <DemoNote>
        <span className="font-semibold">Example portfolio.</span> {demoOwner.name}, the address and the projects are made
        up.
      </DemoNote>
      <PortfolioHome
        person={demoPortfolio.person}
        projects={demoHomeProjects()}
        featuredId={null}
        sections={demoPortfolio.sections}
        tiles={demoPortfolio.tiles}
      />
    </>
  );
}
