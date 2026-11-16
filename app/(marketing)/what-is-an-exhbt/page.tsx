import type { Metadata } from "next";
import Link from "next/link";
import { BrowserFrame } from "@/components/home/BrowserFrame";
import { ExhbtTile } from "@/components/exhbt/ExhbtTile";
import { ProjectView } from "@/components/portfolio/ProjectView";
import { Button } from "@/components/ui/Button";
import { demoExhbts, demoOwner } from "@/lib/exhbt";
import { sampleDocs } from "@/lib/exhbt/sample";
import { portfolioHost } from "@/lib/hosts";
import { PLAN_NAMES } from "@/lib/entitlements";

export const metadata: Metadata = {
  title: "What is an exhbt?",
  description:
    "An exhbt is one project written up on a single page, with the method, the findings and the work behind it, so an employer can check it. A few make a portfolio at your own address.",
};

/** The parts of the example above, top to bottom. */
const PARTS: { name: string; body: string }[] = [
  {
    name: "Title",
    body: "Names the project as a result, not an activity. Under it, one line of context (a module, a placement, a side project) and, when there is one, the single number that sums it up.",
  },
  {
    name: "The question",
    body: "What the gap was and why it mattered, in a few sentences. This is where a reader decides whether the project is relevant to the job.",
  },
  {
    name: "The flowchart",
    body: "The method as a row of boxes, in order, ending on the result. It shows how you work, which a CV rarely does.",
  },
  {
    name: "Findings",
    body: "What you found, as short bullets. Each one is something you could be asked about in an interview.",
  },
  {
    name: "Graphs",
    body: "The key result drawn plainly, with every value printed on the chart so nobody has to read it off an axis. If the numbers are confidential, the graph can show the change instead.",
  },
  {
    name: "The work",
    body: "A link to the thing itself: the report, repository, dataset or recording. The page makes the claim; the work is what backs it.",
  },
  {
    name: "The checks",
    body: "A seal and ticks that Exhbt adds, not you: that you confirmed the exhbt is accurate and your own, and that the source is attached.",
  },
];

const MAKE: { name: string; body: string }[] = [
  {
    name: "Upload",
    body: "Add what you already have from the project: the report, notes, a spreadsheet, slides. Most files are read in your browser. Scans and photos go to the AI only if you say so.",
  },
  {
    name: "Read the AI draft",
    body: "The AI writes a first version from your files and nothing else. If a number in the draft isn't in your material, it's flagged so you can fix or delete it.",
  },
  {
    name: "Edit",
    body: "Change any card, add or remove findings and graphs, drag sections into the order you want, and watch the preview as you go. The whole page stays short on purpose.",
  },
  {
    name: "Publish",
    body: "Confirm it's accurate and yours, and it goes onto your portfolio. Until you publish, nobody else can see it.",
  },
];

export default function WhatIsAnExhbt() {
  const doc = sampleDocs[0]!;
  const address = portfolioHost("name");
  return (
    <>
      <section className="bg-surface">
        <div className="mx-auto max-w-[72rem] px-4 pt-14 pb-16 sm:px-8 lg:pt-20 lg:pb-20">
          <h1 className="display max-w-[14ch]">
            What is an <span className="highlight">exhbt?</span>
          </h1>
          <p className="mt-6 max-w-[40rem] text-[1.15rem] text-graphite sm:text-[1.3rem]">
            One project, written up on a single page so a hiring manager can read it quickly and check it
            for themselves. You make a few of them, and together they&rsquo;re your portfolio.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button href="/exhbts/new" size="lg">Build your exhbt</Button>
            <Button href="/roadmap/new" size="lg" variant="secondary">Build your roadmap</Button>
          </div>
        </div>
      </section>

      <section aria-labelledby="layout" className="border-t border-line bg-mist">
        <div className="mx-auto max-w-[72rem] px-4 py-20 sm:px-8 lg:py-28">
          <h2 id="layout" className="display-2 max-w-[18ch]">The same layout, every time</h2>
          <p className="mt-4 max-w-[40rem] text-lg text-graphite">
            Every exhbt has the same parts in the same order, so an employer learns the page once and can then skim
            any of them. This one is an example. {demoOwner.name} and the project are made up, so the link to the work is left out.
          </p>
          <div className="mt-12 grid gap-12 lg:grid-cols-[minmax(0,34rem)_minmax(0,1fr)] lg:gap-20">
            <div className="min-w-0 lg:sticky lg:top-8 lg:self-start">
              <ProjectView
                doc={doc}
                owner={{ name: demoOwner.name, photoUrl: null }}
                checkedOn="12 March 2026"
                headingLevel="h2"
                position={1}
              />
            </div>
            <div className="min-w-0 max-w-xl">
              <ol className="divide-y divide-line border-y border-line" aria-label="The parts of an exhbt">
                {PARTS.map((p) => (
                  <li key={p.name} className="py-5">
                    <p className="text-[1.2rem] font-bold tracking-[-0.02em]">{p.name}</p>
                    <p className="mt-1.5 text-graphite">{p.body}</p>
                  </li>
                ))}
              </ol>
              <p className="mt-6 text-graphite">
                Employers have their own short guide:{" "}
                <Link href="/how-to-read-an-exhbt" className="link text-ink">how to read an exhbt</Link>.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="proof" className="bg-surface">
        <div className="mx-auto grid max-w-[72rem] gap-10 px-4 py-20 sm:px-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-16 lg:py-28">
          <h2 id="proof" className="display-2 max-w-[14ch]">How it proves a skill</h2>
          <div className="max-w-[36rem] space-y-5 text-lg text-graphite">
            <p>
              A CV says you&rsquo;re good with data. An exhbt shows the question you asked, the steps you took, the
              figures you got and the file behind them, so the skill is something the reader watches happen, not a
              word they&rsquo;re asked to believe.
            </p>
            <p>
              The drafting tool only uses facts you gave it, and it flags any number it can&rsquo;t find in your
              files. You confirm the finished page is accurate and your own before it goes live, and Exhbt adds the
              seal to say those checks ran.
            </p>
            <p>
              An originality check on publish is coming soon. Until it arrives, no exhbt shows that tick. And the
              checks don&rsquo;t grade your work or confirm your results with anyone else; an exhbt is organised
              evidence to ask you about, not a reference.
            </p>
          </div>
        </div>
      </section>

      <section aria-labelledby="make" className="border-t border-line bg-mist">
        <div className="mx-auto max-w-[72rem] px-4 py-20 sm:px-8 lg:py-28">
          <h2 id="make" className="display-2 max-w-[18ch]">How you make one</h2>
          <ol className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {MAKE.map((s) => (
              <li key={s.name} className="rounded-[var(--radius)] border border-line bg-surface p-6">
                <p className="text-[1.2rem] font-bold tracking-[-0.02em]">{s.name}</p>
                <p className="mt-2 text-graphite">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section aria-labelledby="address" className="bg-surface">
        <div className="mx-auto grid max-w-[72rem] items-center gap-10 px-4 py-20 sm:px-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-16 lg:py-28">
          <div>
            <h2 id="address" className="display-2 max-w-[14ch]">Your own address</h2>
            <p className="mt-5 max-w-[34rem] text-lg text-graphite">
              Publish and your exhbts sit together at <span className="font-semibold text-ink">{address}</span>,
              where name is the one you choose. Put it on your CV, your LinkedIn and your email signature, and anyone
              who clicks lands on your work.
            </p>
            <p className="mt-4 max-w-[34rem] text-graphite">
              On {PLAN_NAMES.free} you can build and preview exhbts. Publishing to your address comes with{" "}
              {PLAN_NAMES.premium} and {PLAN_NAMES.max}.{" "}
              <Link href="/pricing" className="link text-ink">See pricing</Link>
            </p>
          </div>
          <div className="min-w-0">
            <BrowserFrame url={portfolioHost(demoOwner.username)}>
              <div className="bg-mist p-4">
                <ul className="grid gap-3 sm:grid-cols-2">
                  {demoExhbts.slice(0, 2).map((e, i) => (
                    <li key={e.slug}>
                      <ExhbtTile exhbt={e} href={`/demo/${e.slug}`} position={i + 1} maxSkills={2} />
                    </li>
                  ))}
                </ul>
              </div>
            </BrowserFrame>
            <p className="mt-3 text-sm text-graphite">Example: this address and {demoOwner.name} are made up.</p>
          </div>
        </div>
      </section>

      <section aria-labelledby="start" className="bg-mint">
        <div className="mx-auto flex max-w-[72rem] flex-wrap items-center justify-between gap-8 px-4 py-20 sm:px-8 lg:py-24">
          <h2 id="start" className="display-2 max-w-[14ch]">Start with the free roadmap.</h2>
          <div className="flex flex-wrap gap-3">
            <Button href="/roadmap/new" size="xl" variant="ink">Build your roadmap</Button>
            <Button href="/exhbts/new" size="xl" variant="secondary">Build your exhbt</Button>
          </div>
        </div>
      </section>
    </>
  );
}
