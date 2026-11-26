import { Assemble } from "@/components/lab/home/Assemble";
import { Close } from "@/components/lab/home/Close";
import { Employer } from "@/components/lab/home/Employer";
import { Hero } from "@/components/lab/home/Hero";
import { HomeNameProvider } from "@/components/lab/home/HomeName";
import { HomeNav } from "@/components/lab/home/HomeNav";
import { HowItWorks } from "@/components/lab/home/HowItWorks";
import { Looks } from "@/components/lab/home/Looks";
import { Prices } from "@/components/lab/home/Prices";
import { Roadmap } from "@/components/lab/home/Roadmap";
import { labGate, labMetadata } from "@/components/lab/server";
import "@/components/lab/home/home.css";

export const generateMetadata = labMetadata("Home");

/**
 * The home page, as a mock-up in the design lab (decision 0033 and the page for Rory, 26 Nov 2026):
 * the page that has to make a stranger understand Exhbt and want to start. Real components on the
 * made-up person's sample data; no sign-in, no database, no AI, and nothing typed is sent.
 *
 * The story, in order: the promise with a real page in the first screen (and, from confident, your
 * name in its address); one exhbt putting itself together; the same page in eight looks; a CV line
 * beside an exhbt, and what an employer sees; how an exhbt is made; the free roadmap for someone with
 * nothing to show yet; the prices in a line; and the address again, on ink, with the one action.
 * What each level adds is in components/lab/home/README.md.
 */
export default function LabHome() {
  labGate();
  return (
    <HomeNameProvider>
      <header className="hl-header">
        <HomeNav />
      </header>
      <main id="main" className="hl">
        <Hero />
        <Assemble />
        <Looks />
        <Employer />
        <HowItWorks />
        <Roadmap />
        <Prices />
        <Close />
      </main>
    </HomeNameProvider>
  );
}
