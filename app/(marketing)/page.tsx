import Link from "next/link";
import { ExhbtTile } from "@/components/exhbt/ExhbtTile";
import { FeatureList } from "@/components/site/FeatureList";
import { BrowserFrame } from "@/components/home/BrowserFrame";
import { EditorExcerpt } from "@/components/home/Excerpts";
import { SkillsGapExample } from "@/components/home/SkillsGapExample";
import { StartForm } from "@/components/home/StartForm";
import { Button } from "@/components/ui/Button";
import { demoExhbts, demoOwner } from "@/lib/exhbt";
import { BILLING_PERIOD, JOB_LINKS_LIVE, ORIGINALITY_CHECK_LIVE, PLAN_NAMES, PRICES } from "@/lib/entitlements";
import { portfolioHost } from "@/lib/hosts";
import { marketingFeatures } from "@/lib/marketing-features";
import { PORTFOLIO_THEMES } from "@/lib/portfolio-themes";
import { isPhase2Enabled } from "@/lib/site";

// Per request: the EXHBT_PHASE2 switch is read at runtime, so the plan cards change to the paid
// plans (or back to the waitlist) without a rebuild.
export const dynamic = "force-dynamic";

/** A few looks, shown as small bands. Colours come from the looks themselves (lib/portfolio-themes.ts). */
const LOOK_IDS = ["ink", "jade", "mint", "paper", "mist", "fresh", "deep-jade", "editorial"];

const GET: { name: string; body: string; soon?: boolean }[] = [
  {
    name: "A website of your own",
    body: `Your portfolio lives at ${portfolioHost("name")}, where name is the one you choose. One address for your CV, LinkedIn and email signature.`,
  },
  {
    name: "Projects as exhbts",
    body: "Each project gets one short page: the question, the method as a flowchart, the findings, the graphs and the work behind them.",
  },
  {
    name: "A free roadmap first",
    body: "Say which job you want. We list the skills it asks for, where you stand on each, and project ideas that would close the gaps.",
  },
  {
    name: "A look that suits you",
    body: "Pick a colour scheme and heading font, drag your tiles into order, and add a page about you, your education and your links.",
  },
];

const STEPS: { name: string; body: string }[] = [
  { name: "Upload a project", body: "Add the report, notes or results you already have. Most files are read in your browser." },
  { name: "Check the draft", body: "The AI writes a first version from your files and nothing else. You edit it, and you confirm it's yours." },
  { name: "Publish", body: `It goes live on your portfolio at ${portfolioHost("name")}. Until you publish, nobody else sees it.` },
];

export default function Home() {
  // Phase 2 on: the paid plans are sold for real. Off (the live site today): the waitlist.
  const sell = isPhase2Enabled();
  const looks = PORTFOLIO_THEMES.filter((t) => LOOK_IDS.includes(t.id));
  return (
    <>
      {/* Hero: the promise, one line under it, and the way in. */}
      <section className="bg-surface">
        <div className="mx-auto grid max-w-[72rem] items-center gap-12 px-4 pt-14 pb-20 sm:px-8 sm:pt-20 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:pt-24 lg:pb-28">
          <div>
            <h1 className="display max-w-[14ch]">
              A website of your own, <span className="highlight">built from your projects.</span>
            </h1>
            <p className="mt-6 max-w-[38rem] text-[1.15rem] text-graphite sm:text-[1.3rem]">
              Turn your project work into a portfolio at {portfolioHost("name")}. Start with a free roadmap that shows
              which skills to prove first.
            </p>
            <div className="mt-10">
              <StartForm id="start-hero" />
            </div>
          </div>
          <figure className="hidden min-w-0 lg:block" aria-label="An example portfolio address">
            <BrowserFrame url={portfolioHost(demoOwner.username)}>
              <div className="bg-mist p-4">
                <ExhbtTile exhbt={demoExhbts[0]!} href={`/demo/${demoExhbts[0]!.slug}`} position={1} maxSkills={3} />
              </div>
            </BrowserFrame>
            <figcaption className="mt-3 text-sm text-graphite">Example: {demoOwner.name} is fictional.</figcaption>
          </figure>
        </div>
      </section>

      {/* What you get. */}
      <section aria-labelledby="get" className="border-t border-line bg-mist">
        <div className="mx-auto max-w-[72rem] px-4 py-20 sm:px-8 lg:py-28">
          <h2 id="get" className="display-2 max-w-[16ch]">What you get</h2>
          <ul className="mt-12 grid gap-4 sm:grid-cols-2">
            {GET.map((g) => (
              <li key={g.name} className="rounded-[var(--radius)] border border-line bg-surface p-6">
                <p className="text-[1.2rem] font-bold tracking-[-0.02em]">{g.name}</p>
                <p className="mt-2 text-graphite">{g.body}</p>
              </li>
            ))}
          </ul>
          {(!JOB_LINKS_LIVE || !ORIGINALITY_CHECK_LIVE) && (
            <p className="mt-6 flex flex-wrap items-center gap-2 text-graphite">
              <span className="chip">Coming soon</span>
              {[
                !JOB_LINKS_LIVE && `a separate link for each job you apply to (${PLAN_NAMES.max})`,
                !ORIGINALITY_CHECK_LIVE && "an originality check when you publish",
              ]
                .filter(Boolean)
                .join(", and ")}
              .
            </p>
          )}
        </div>
      </section>

      {/* An exhbt example: the tiles of the fictional demo portfolio, reached by scrolling. */}
      <section aria-labelledby="example" className="bg-surface">
        <div className="mx-auto max-w-[72rem] px-4 py-20 sm:px-8 lg:py-28">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 id="example" className="display-2 max-w-[18ch]">An exhbt, and the portfolio around it</h2>
            <Button href="/demo">Open the example portfolio</Button>
          </div>
          <p className="mt-4 max-w-[40rem] text-lg text-graphite">
            Each project as one result, the method behind it and the skills it shows. Click any of them to see the full
            exhbt. {demoOwner.name} and these projects are made up.{" "}
            <Link href="/what-is-an-exhbt" className="link text-ink">What is an exhbt?</Link>
          </p>
          <ul id="example-portfolio" className="mt-10 grid gap-4 md:grid-cols-2">
            {demoExhbts.map((e, i) => (
              <li key={e.slug}>
                <ExhbtTile exhbt={e} href={`/demo/${e.slug}`} position={i + 1} />
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* How it works. */}
      <section aria-labelledby="how" className="border-t border-line bg-mist">
        <div className="mx-auto grid max-w-[72rem] items-center gap-10 px-4 py-20 sm:px-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-16 lg:py-28">
          <div>
            <h2 id="how" className="display-2 max-w-[14ch]">How it works</h2>
            <ol className="mt-8 space-y-6">
              {STEPS.map((s) => (
                <li key={s.name}>
                  <p className="text-[1.2rem] font-bold tracking-[-0.02em]">{s.name}</p>
                  <p className="mt-1.5 max-w-[34rem] text-lg text-graphite">{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
          <div className="min-w-0">
            <EditorExcerpt />
            <p className="mt-3 text-sm text-graphite">Example: part of the editor, with a made-up project.</p>
          </div>
        </div>
      </section>

      {/* The free roadmap, shown with the fictional demo graduate. */}
      <SkillsGapExample />

      {/* Portfolio looks. */}
      <section aria-labelledby="looks" className="border-t border-line bg-surface">
        <div className="mx-auto max-w-[72rem] px-4 py-20 sm:px-8 lg:py-28">
          <h2 id="looks" className="display-2 max-w-[18ch]">Looks for your portfolio</h2>
          <p className="mt-4 max-w-[40rem] text-lg text-graphite">
            Each look is a fixed colour scheme, heading font and photo shape, checked so the text stays easy to read.{" "}
            {PLAN_NAMES.free} has the default, {PLAN_NAMES.premium} has a set to choose from and {PLAN_NAMES.max} has them all.
          </p>
          <ul className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-4">
            {looks.map((t) => (
              <li key={t.id}>
                <div className="flex items-center gap-3 rounded-[var(--radius)] border border-line px-4 py-5" style={{ background: t.bg }}>
                  <span
                    aria-hidden
                    className={`inline-flex size-10 shrink-0 items-center justify-center text-sm font-semibold ${t.photo === "round" ? "rounded-full" : "rounded-[10px]"}`}
                    style={{ background: t.initials.bg, color: t.initials.text }}
                  >
                    AO
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold" style={{ color: t.text }}>Your name</span>
                    <span className="block truncate text-xs" style={{ color: t.soft }}>Your headline</span>
                  </span>
                </div>
                <p className="mt-2 text-sm font-medium">{t.name}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Pricing summary: the same cards and buttons as /pricing. */}
      <section aria-labelledby="pricing" className="border-t border-line bg-mist">
        <div className="mx-auto max-w-[72rem] px-4 py-20 sm:px-8 lg:py-28">
          <h2 id="pricing" className="display-2">Free to start</h2>
          <p className="mt-4 max-w-2xl text-lg text-graphite">
            Your roadmap is free, and so is trying an exhbt. {PLAN_NAMES.premium} and {PLAN_NAMES.max} publish your
            portfolio at your own address.{" "}
            <Link href="/pricing" className="link text-ink">Compare plans</Link>
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
            <Link href="/universities" className="link text-ink">For universities</Link>
          </p>
        </div>
      </section>

      {/* FAQ. */}
      <section aria-labelledby="faq" className="bg-surface">
        <div className="mx-auto grid max-w-[72rem] gap-10 px-4 py-20 sm:px-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-16 lg:py-28">
          <h2 id="faq" className="display-2">Questions</h2>
          <dl className="max-w-[40rem] space-y-8">
            <div>
              <dt className="text-[1.1rem] font-bold">Do I have to pay?</dt>
              <dd className="mt-1.5 text-graphite">
                Not to start. The roadmap is free, and on {PLAN_NAMES.free} you can build and preview exhbts. You pay
                to publish them at your own address: {PLAN_NAMES.premium} is {PRICES.premium} a {BILLING_PERIOD} and{" "}
                {PLAN_NAMES.max} is {PRICES.max} a {BILLING_PERIOD}.
              </dd>
            </div>
            <div>
              <dt className="text-[1.1rem] font-bold">Will the AI make things up?</dt>
              <dd className="mt-1.5 text-graphite">
                It&rsquo;s told to use only what you gave it, and any number it can&rsquo;t find in your files is
                flagged for you to fix. Nothing goes live until you&rsquo;ve confirmed it&rsquo;s accurate and your own.
              </dd>
            </div>
            <div>
              <dt className="text-[1.1rem] font-bold">Who can see my exhbts?</dt>
              <dd className="mt-1.5 text-graphite">
                Only you, until you publish one. A published exhbt is on your public portfolio, and you can ask search
                engines to leave it out.
              </dd>
            </div>
            <div>
              <dt className="text-[1.1rem] font-bold">What if I stop paying?</dt>
              <dd className="mt-1.5 text-graphite">
                Nothing is deleted. Your portfolio shows as many published exhbts as your new plan allows, in your order.
              </dd>
            </div>
            <div>
              <dt className="text-[1.1rem] font-bold">Can I send a different link for each job?</dt>
              <dd className="mt-1.5 text-graphite">
                {JOB_LINKS_LIVE
                  ? `Yes, on ${PLAN_NAMES.max}: upload a job description and we pick the exhbts that fit it best.`
                  : `Not yet. It's coming soon on ${PLAN_NAMES.max}: you'll upload a job description and get a link with the exhbts that fit it best.`}
              </dd>
            </div>
            <div>
              <dt className="text-[1.1rem] font-bold">Does my university need to be involved?</dt>
              <dd className="mt-1.5 text-graphite">
                No. If your university has a licence, it gives you {PLAN_NAMES.max}.{" "}
                <Link href="/universities" className="link text-ink">For universities</Link>
              </dd>
            </div>
          </dl>
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
  /** Billing period shown after a paid price. */
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
        <Button href={href} variant={featured ? "primary" : "secondary"}>{cta}</Button>
      </div>
    </div>
  );
}
