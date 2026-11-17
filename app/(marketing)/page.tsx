import Link from "next/link";
import { Faq, type Question } from "@/components/home/Faq";
import { HowItWorks } from "@/components/home/HowItWorks";
import { JobLinks } from "@/components/home/JobLinks";
import { LookPreview } from "@/components/home/LookPreview";
import { Preview } from "@/components/home/Preview";
import { SkillsGapExample } from "@/components/home/SkillsGapExample";
import { StartForm } from "@/components/home/StartForm";
import { ProjectView } from "@/components/portfolio/ProjectView";
import { FeatureList } from "@/components/site/FeatureList";
import { Button } from "@/components/ui/Button";
import { demoExhbts, demoHomeProjects, demoOwner, demoPortfolio } from "@/lib/exhbt";
import { BILLING_PERIOD, JOB_LINKS_LIVE, ORIGINALITY_CHECK_LIVE, PLAN_NAMES, PRICES } from "@/lib/entitlements";
import { portfolioHost, portfolioUrl } from "@/lib/hosts";
import { marketingFeatures } from "@/lib/marketing-features";
import { marketingMetadata } from "@/lib/seo";
import { isPhase2Enabled } from "@/lib/site";

// Canonical, description and link preview (lib/seo.ts). The title leads with what Exhbt is.
export const metadata = marketingMetadata("home");

// Per request: the EXHBT_PHASE2 switch is read at runtime, so the plan cards change to the paid
// plans (or back to the waitlist) without a rebuild.
export const dynamic = "force-dynamic";

const ADDRESS = portfolioHost("name");

const GET: { name: string; body: string }[] = [
  {
    name: "A website of your own",
    body: `Your portfolio at ${ADDRESS}, on ${PLAN_NAMES.premium} and ${PLAN_NAMES.max}. One address for your CV, LinkedIn and email signature.`,
  },
  {
    name: "Projects as exhbts",
    body: "One short page per project: the question, the method as a flowchart, what you found and the work behind it.",
  },
  {
    name: "A free roadmap first",
    body: "Say which job you want. We list the skills it asks for, where you stand on each, and projects that would close the gaps.",
  },
  {
    name: "A look that suits you",
    body: "Choose the colours and heading font, put your sections in order, and add a few lines about you.",
  },
];

/** Where each part of the example exhbt is, in the words beside it. */
const PARTS: { name: string; body: string }[] = [
  { name: "The question", body: "The title is what the work set out to answer. The line under it highlights the gap it fills." },
  { name: "The method", body: "Your steps as a flowchart, ending on the result." },
  { name: "What you found", body: "A few short points beside the key graph, with every value printed." },
  { name: "The proof", body: "The file itself, one click away, and ticks for the checks that ran." },
];

export default function Home() {
  // Phase 2 on: the paid plans are sold for real. Off (the live site today): the waitlist.
  const sell = isPhase2Enabled();
  const [featured] = demoExhbts;
  const first = demoOwner.name.split(" ")[0];
  const bySlug = Object.fromEntries(demoExhbts.map((e) => [e.slug, e.doc.title]));

  const questions: Question[] = [
    {
      q: "Do I have to pay?",
      a: (
        <>
          Not to start. The roadmap is free, and on {PLAN_NAMES.free} you can try an exhbt and preview your page. You pay to
          publish at your own address: {PLAN_NAMES.premium} is {PRICES.premium} a {BILLING_PERIOD} and {PLAN_NAMES.max} is{" "}
          {PRICES.max} a {BILLING_PERIOD}.
        </>
      ),
    },
    {
      q: "Is the address really mine?",
      a: (
        <>
          Yes: {ADDRESS}, with the name you choose. It&rsquo;s a name on exhbt.co.uk rather than a domain you buy, so
          there&rsquo;s nothing to set up or renew. If you move down to {PLAN_NAMES.free}, the name stays yours and
          the page is hidden until you&rsquo;re back on {PLAN_NAMES.premium} or {PLAN_NAMES.max}.
        </>
      ),
    },
    {
      q: "Will the AI make things up?",
      a: (
        <>
          It&rsquo;s told to use only what you gave it, and any number it can&rsquo;t find in your files is flagged for you
          to fix. Nothing goes live until you&rsquo;ve confirmed it&rsquo;s accurate and your own.
        </>
      ),
    },
    {
      q: "Who can see my exhbts?",
      a: "Only you, until you publish one. A published exhbt is on your public portfolio, and you can ask search engines to leave it out.",
    },
    {
      q: "What if I stop paying?",
      a: "Nothing is deleted. Your portfolio shows as many published exhbts as your new plan allows, in your order.",
    },
    {
      q: "Can I send a different link for each job?",
      a: JOB_LINKS_LIVE
        ? `Yes, on ${PLAN_NAMES.max}: paste a job description and we pick the exhbts that fit it best.`
        : `Not yet. It's coming soon on ${PLAN_NAMES.max}: you'll paste a job description and get a link with the exhbts that fit it best.`,
    },
    {
      q: "Does my university need to be involved?",
      a: (
        <>
          No. If your university has a licence, it gives you {PLAN_NAMES.max}.{" "}
          <Link href="/universities" className="link text-ink">
            For universities
          </Link>
        </>
      ),
    },
  ];

  return (
    <>
      {/* Hero: the promise, one line under it, and the way in. */}
      <section className="bg-surface">
        <div className="mx-auto flex max-w-[72rem] flex-col items-center px-4 pt-12 pb-14 text-center sm:px-8 sm:pt-16 lg:pt-20 lg:pb-16">
          <h1 className="display max-w-[21ch]">
            A website of your own, <span className="highlight">built from your projects.</span>
          </h1>
          <p className="mt-6 max-w-[38rem] text-[1.15rem] text-balance text-graphite sm:text-[1.3rem]">
            Turn your project work into a portfolio at {ADDRESS}. Start with a free roadmap that shows which skills to
            prove first.
          </p>
          <div className="mt-10 flex w-full justify-center">
            <StartForm id="start-hero" />
          </div>
          <p className="mt-5 text-[0.9375rem] text-slate">
            The roadmap is free. Your own address comes with {PLAN_NAMES.premium} and {PLAN_NAMES.max}.
          </p>
        </div>
      </section>

      {/* One real exhbt, drawn by the product's own page (ProjectView) with the fictional demo, and what each part is for. */}
      <section aria-labelledby="one-exhbt" className="bg-surface">
        <div className="mx-auto grid max-w-[72rem] gap-10 px-4 pb-20 sm:px-8 lg:grid-cols-[minmax(0,15.5rem)_minmax(0,1fr)] lg:gap-12 lg:pb-28">
          <div className="lg:pt-8">
            <h2 id="one-exhbt" className="display-2 max-w-[12ch]">
              One project, one page
            </h2>
            <p className="mt-4 max-w-[34rem] text-lg text-graphite">
              That&rsquo;s an exhbt: a piece of your work written up so an employer can read it in a minute and check it.
            </p>
            <dl className="mt-8 grid gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-1">
              {PARTS.map((p) => (
                <div key={p.name} className="border-t border-line pt-3">
                  <dt className="font-semibold">{p.name}</dt>
                  <dd className="mt-1 text-[0.95rem] text-graphite">{p.body}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-[0.95rem]">
              <Link href={`/demo/${featured!.slug}`} className="link font-semibold">
                Open this exhbt
              </Link>
              <Link href="/what-is-an-exhbt" className="link">
                What is an exhbt?
              </Link>
            </p>
            <p className="mt-3 text-sm text-slate">{demoOwner.name} and her projects are made up.</p>
          </div>
          <div className="pattern-viewfinder min-w-0 rounded-[28px] p-3 sm:p-6 lg:p-8">
            <Preview
              url={portfolioUrl(demoOwner.username, featured!.slug)}
              label={`An example exhbt by ${demoOwner.name}, as it looks on her site: ${featured!.doc.title}`}
              // Below lg it's the page as a phone shows it, cropped to its first screen; from lg the whole page, smaller.
              crop="max-h-[50rem] lg:max-h-none"
              className="bg-surface p-4 sm:p-6 lg:p-8 lg:[zoom:0.72]"
            >
              <ProjectView
                doc={featured!.doc}
                owner={{ name: demoOwner.name, photoUrl: null, bio: demoOwner.headline, homeHref: "/demo" }}
                evidenceUrl="#"
                checkedOn={featured!.checkedOn}
                headingLevel="h2"
              />
            </Preview>
          </div>
        </div>
      </section>

      {/* How it works: the four steps as an exhbt draws a method. */}
      <section aria-labelledby="how" className="border-t border-line bg-mist">
        <div className="mx-auto max-w-[72rem] px-4 py-20 sm:px-8 lg:py-28">
          <h2 id="how" className="display-2">
            How it works
          </h2>
          <p className="mt-4 max-w-[40rem] text-lg text-graphite">From the file you already have to a page on your own site.</p>
          <HowItWorks username={demoOwner.username} fileName={featured!.doc.evidence?.label ?? "Dissertation.pdf"} question={featured!.doc.title} slug={featured!.slug} />
        </div>
      </section>

      {/* The address: the one ink section, built round the real portfolio home and its looks. */}
      <section aria-labelledby="address" className="bg-ink text-white">
        <div className="mx-auto max-w-[72rem] px-4 py-20 sm:px-8 lg:py-28">
          <h2 id="address" className="display-2 text-white">
            A site that&rsquo;s all yours
          </h2>
          <p className="mt-6 font-[family-name:var(--font-display)] text-[clamp(1.75rem,8.2vw,6.5rem)] leading-none font-semibold tracking-[-0.045em] text-white [overflow-wrap:anywhere]">
            <span className="text-mint">{demoOwner.username}</span>
            {portfolioHost(demoOwner.username).slice(demoOwner.username.length)}
          </p>
          <div className="mt-8 grid gap-6 text-[1.0625rem] lg:grid-cols-2 lg:gap-16">
            <p className="max-w-[36rem] text-on-ink">
              Pick a name and your portfolio lives at {ADDRESS}: your photo and intro at the top, your best work in the
              band, the rest underneath, in the look you choose. One link for your CV, your LinkedIn and your email
              signature, and it opens on your work.
            </p>
            <p className="max-w-[36rem] text-on-ink">
              Your own address comes with <span className="font-semibold text-white">{PLAN_NAMES.premium}</span> and{" "}
              <span className="font-semibold text-white">{PLAN_NAMES.max}</span>. On {PLAN_NAMES.free} you can try an
              exhbt and preview your page first.{" "}
              <Link href="/pricing" className="font-semibold text-white underline decoration-graphite decoration-2 underline-offset-4 hover:decoration-mint">
                Compare plans
              </Link>
            </p>
          </div>
          <div className="mt-12">
            <LookPreview
              person={demoPortfolio.person}
              projects={demoHomeProjects()}
              tiles={demoPortfolio.tiles}
              sections={demoPortfolio.sections}
            />
            <p className="mt-4 text-sm text-on-ink">
              {first} is made up.{" "}
              <Link href="/demo" className="font-semibold text-white underline decoration-graphite decoration-2 underline-offset-4 hover:decoration-mint">
                Open her portfolio
              </Link>
            </p>
          </div>
        </div>
      </section>

      {/* A link per application (Max). */}
      <JobLinks
        username={demoOwner.username}
        owner={demoOwner.name}
        picks={[
          { slug: "lloyds", job: "the graduate data analyst role at Lloyds", lead: bySlug["ae-forecast"]! },
          { slug: "city-council", job: "the performance analyst role at a city council", lead: bySlug["bed-dashboard"]! },
          { slug: "hospital-trust", job: "the junior data scientist role at a hospital trust", lead: bySlug["gp-reminders"]! },
        ]}
      />

      {/* What you get. */}
      <section aria-labelledby="get" className="border-t border-line bg-mist">
        <div className="mx-auto max-w-[72rem] px-4 py-20 sm:px-8 lg:py-28">
          <h2 id="get" className="display-2">
            What you get
          </h2>
          <ul className="mt-12 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
            {GET.map((g) => (
              <li key={g.name} className="border-t-2 border-ink pt-5">
                <p className="text-[1.125rem] leading-snug font-semibold tracking-[-0.01em]">{g.name}</p>
                <p className="mt-2 text-graphite">{g.body}</p>
              </li>
            ))}
          </ul>
          {!ORIGINALITY_CHECK_LIVE && (
            <p className="mt-10 flex flex-wrap items-center gap-2 text-graphite">
              <span className="chip">Coming soon</span>
              An originality check when you publish, on {PLAN_NAMES.premium} and {PLAN_NAMES.max}.
            </p>
          )}
        </div>
      </section>

      {/* The free roadmap, shown with the fictional demo graduate. */}
      <SkillsGapExample />

      {/* Pricing summary: the same cards and buttons as /pricing. */}
      <section aria-labelledby="pricing" className="border-t border-line bg-mist">
        <div className="mx-auto max-w-[72rem] px-4 py-20 sm:px-8 lg:py-28">
          <h2 id="pricing" className="display-2">
            Free to start
          </h2>
          <p className="mt-4 max-w-2xl text-lg text-graphite">
            Your roadmap is free, and so is trying an exhbt. {PLAN_NAMES.premium} and {PLAN_NAMES.max} publish your
            portfolio at your own address.{" "}
            <Link href="/pricing" className="link text-ink">
              Compare plans
            </Link>
          </p>
          <div className="mt-12 grid gap-4 lg:grid-cols-3 lg:items-start">
            <Plan name={PLAN_NAMES.free} price={PRICES.free} features={marketingFeatures("free")} href="/roadmap/new" cta="Build your roadmap" />
            <Plan
              name={PLAN_NAMES.premium}
              price={PRICES.premium}
              per={BILLING_PERIOD}
              badge={sell ? undefined : "Coming soon"}
              features={marketingFeatures("premium")}
              href={sell ? "/account/billing" : "/pricing#premium"}
              cta={sell ? `Choose ${PLAN_NAMES.premium}` : "Join the waitlist"}
            />
            <Plan
              name={PLAN_NAMES.max}
              price={PRICES.max}
              per={BILLING_PERIOD}
              badge={sell ? undefined : "Coming soon"}
              features={marketingFeatures("max")}
              href={sell ? "/account/billing" : "/pricing#max"}
              cta={sell ? `Choose ${PLAN_NAMES.max}` : "Join the waitlist"}
              featured
            />
          </div>
          <p className="mt-8 text-graphite">
            Universities can give every student {PLAN_NAMES.max}.{" "}
            <Link href="/universities" className="link text-ink">
              For universities
            </Link>
          </p>
        </div>
      </section>

      {/* Questions, each one a disclosure. */}
      <section aria-labelledby="faq" className="bg-surface">
        <div className="mx-auto grid max-w-[72rem] gap-10 px-4 py-20 sm:px-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16 lg:py-28">
          <h2 id="faq" className="display-2">
            Questions
          </h2>
          <Faq items={questions} />
        </div>
      </section>

      {/* Closing band: the one mint band on the page, same action as the hero. */}
      <section aria-labelledby="close" className="bg-mint">
        <div className="mx-auto grid max-w-[72rem] items-center gap-10 px-4 py-20 sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,40rem)] lg:py-24">
          <h2 id="close" className="display-2 max-w-[12ch]">
            Start with the roadmap. It&rsquo;s free.
          </h2>
          <StartForm id="start-close" tone="band" />
        </div>
      </section>
    </>
  );
}

function Plan({
  name,
  price,
  per,
  badge,
  features,
  href,
  cta,
  featured,
}: {
  name: string;
  price?: string;
  /** Billing period shown after a paid price, e.g. "year". */
  per?: string;
  badge?: string;
  features: string[];
  href: string;
  cta: string;
  featured?: boolean;
}) {
  return (
    <div className={`flex flex-col rounded-[20px] bg-surface p-7 ${featured ? "border-2 border-ink" : "border border-line"}`}>
      <p className="flex flex-wrap items-center gap-2 text-[1.375rem] font-bold">
        {name} {badge && <span className="chip">{badge}</span>}
      </p>
      {price && (
        <p className="mt-2 text-[2.6rem] leading-none font-extrabold tracking-[-0.03em]">
          {price}
          {per && <span className="ml-1 text-base font-semibold tracking-normal text-graphite">a {per}</span>}
        </p>
      )}
      <FeatureList items={features} className="mt-5 text-[0.95rem]" />
      <div className="pt-6">
        <Button href={href} variant={featured ? "primary" : "secondary"}>
          {cta}
        </Button>
      </div>
    </div>
  );
}
