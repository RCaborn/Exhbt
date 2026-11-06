import Link from "next/link";
import { ExhbtTile } from "@/components/exhbt/ExhbtTile";
import { FeatureList } from "@/components/site/FeatureList";
import { EditorExcerpt, LinkExcerpt, RoadmapExcerpt } from "@/components/home/Excerpts";
import { StartForm } from "@/components/home/StartForm";
import { demoExhbts } from "@/lib/exhbt";
import { EXHBTS_PER_JOB_LINK, PLAN_NAMES, PRICES, planFeatures } from "@/lib/entitlements";
import { SOURCING_LINE } from "@/lib/jobs/claim";

export default function Home() {
  return (
    <>
      {/* Hero: headline, one line, and the search bar. Nothing else competes with it. */}
      <section className="bg-surface">
        <div className="mx-auto max-w-[60rem] px-4 pt-14 pb-20 sm:px-8 sm:pt-20 lg:pt-28 lg:pb-28">
          <h1 className="text-[2.9rem] sm:text-[4.4rem] lg:text-[5rem]">
            Show employers what you <span className="highlight">actually did.</span>
          </h1>
          <p className="mt-6 max-w-[40rem] text-[1.15rem] text-ink-2 sm:text-[1.3rem]">
            Describe the job you want. We map the skills you can&rsquo;t prove yet, then help you turn your projects
            into a portfolio of exhbts a hiring manager can check in 30 seconds.
          </p>
          <div className="mt-10">
            <StartForm id="start-hero" />
          </div>
        </div>
      </section>

      {/* The journey: one rail, three real artifacts. */}
      <section aria-labelledby="how" className="bg-sky">
        <div className="mx-auto max-w-[78rem] px-4 py-20 sm:px-8 lg:py-28">
          <h2 id="how" className="max-w-[18ch] text-[2.4rem] sm:text-[3.4rem]">
            From a CV that says &ldquo;analytical&rdquo; to work that proves it
          </h2>

          <ol className="relative mt-16 grid gap-14 md:grid-cols-3 md:gap-8">
            <span
              aria-hidden
              className="absolute top-[11px] right-[calc(16.66%-11px)] left-[11px] hidden h-[2px] bg-ink md:block"
            />
            <Stage
              title="Find the gaps"
              body={`Describe the job you want and where you are now. You get the skills that job asks for which you can't show yet, and projects small enough to finish in a few weeks. ${SOURCING_LINE}`}
              artifact={<RoadmapExcerpt />}
            />
            <Stage
              title="Turn it into an exhbt"
              body="Add the report, notes or results. We draft a short exhbt with the methodology as a flow and a chart of the key result, from what you gave us and nothing else. You confirm it's yours, and it passes an originality check."
              artifact={<EditorExcerpt />}
            />
            <Stage
              title="Send each employer their own link"
              body={`Your exhbts live on your own link. On ${PLAN_NAMES.premium}, upload a job description and get a custom link with the ${EXHBTS_PER_JOB_LINK} that fit it best.`}
              artifact={<LinkExcerpt />}
            />
          </ol>
        </div>
      </section>

      {/* What an employer sees: a portfolio, reached by scrolling. */}
      <section aria-labelledby="example" className="bg-surface">
        <div className="mx-auto max-w-[64rem] px-4 py-20 sm:px-8 lg:py-28">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 id="example" className="text-[2.4rem] sm:text-[3.4rem]">What an employer sees</h2>
            <Link href="/demo" className="btn btn-secondary">Open the demo portfolio</Link>
          </div>
          <p className="mt-4 max-w-[40rem] text-lg text-ink-2">
            Each project as one result, the method behind it and the skills it proves. Click any of them to see the
            full exhbt.
          </p>
          <ul id="example-portfolio" className="mt-10 grid gap-4 md:grid-cols-2">
            {demoExhbts.map((e) => (
              <li key={e.slug}>
                <ExhbtTile exhbt={e} href={`/demo/${e.slug}`} />
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Pricing summary */}
      <section aria-labelledby="pricing" className="bg-sky">
        <div className="mx-auto max-w-[78rem] px-4 py-20 sm:px-8 lg:py-28">
          <h2 id="pricing" className="text-[2.4rem] sm:text-[3.4rem]">Free to start</h2>
          <p className="mt-4 max-w-2xl text-lg text-ink-2">
            Your roadmap is free. When you have work worth showing, {PLAN_NAMES.plus} and {PLAN_NAMES.premium} host it.{" "}
            <Link href="/pricing" className="link text-ink">Compare plans</Link>
          </p>
          <div className="mt-12 grid gap-4 md:grid-cols-3">
            <Plan name={PLAN_NAMES.free} price={PRICES.free} features={planFeatures("free")} href="/roadmap/new" cta="Build my roadmap" />
            <Plan name={PLAN_NAMES.plus} badge="Coming soon" features={planFeatures("plus")} href="/pricing#plus" cta="Join the waitlist" />
            <Plan
              name={PLAN_NAMES.premium}
              badge="Coming soon"
              features={planFeatures("premium")}
              href="/pricing#premium"
              cta="Join the waitlist"
              featured
            />
          </div>
          <p className="mt-8 text-ink-2">
            Universities can give every student {PLAN_NAMES.premium}.{" "}
            <Link href="/universities" className="link text-ink">How licences work</Link>
          </p>
        </div>
      </section>

      {/* Closing band: same action as the hero. */}
      <section aria-labelledby="close" className="bg-sky-2">
        <div className="mx-auto grid max-w-[78rem] items-center gap-10 px-4 py-20 sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,40rem)] lg:py-24">
          <h2 id="close" className="max-w-[12ch] text-[2.6rem] sm:text-[3.8rem]">
            Start with the roadmap. It&rsquo;s free.
          </h2>
          <StartForm id="start-close" tone="blue" />
        </div>
      </section>
    </>
  );
}

function Stage({ title, body, artifact }: { title: string; body: string; artifact: React.ReactNode }) {
  return (
    <li className="relative">
      <span aria-hidden className="relative z-10 block size-6 rounded-full border-2 border-ink bg-blue" />
      <h3 className="mt-6 text-[1.5rem] sm:text-[1.7rem]">{title}</h3>
      <p className="mt-3 max-w-[30rem] text-ink-2">{body}</p>
      <div className="mt-7 max-w-[30rem]">{artifact}</div>
    </li>
  );
}

function Plan({
  name,
  price,
  badge,
  features,
  href,
  cta,
  featured,
}: {
  name: string;
  price?: string;
  badge?: string;
  features: string[];
  href?: string;
  cta?: string;
  featured?: boolean;
}) {
  return (
    <div className={`flex flex-col rounded-[var(--radius)] p-6 ${featured ? "border-2 border-ink bg-surface" : "border border-rule bg-surface"}`}>
      <p className="flex flex-wrap items-center gap-2 font-semibold">
        {name} {badge && <span className="chip">{badge}</span>}
      </p>
      {price && <p className="mt-2 text-[2.6rem] leading-none font-extrabold tracking-[-0.03em]">{price}</p>}
      <FeatureList items={features} className="mt-4 text-[0.95rem]" />
      {href && cta && (
        <Link href={href} className="link mt-auto pt-4 font-semibold text-ink">
          {cta}
        </Link>
      )}
    </div>
  );
}
