import Link from "next/link";
import { ExhbtTile } from "@/components/exhbt/ExhbtTile";
import { FeatureList } from "@/components/site/FeatureList";
import { EditorExcerpt, LinkExcerpt } from "@/components/home/Excerpts";
import { SkillsGapExample } from "@/components/home/SkillsGapExample";
import { StartForm } from "@/components/home/StartForm";
import { demoExhbts } from "@/lib/exhbt";
import { EXHBTS_PER_JOB_LINK, PLAN_NAMES, PRICES, planFeatures } from "@/lib/entitlements";
import { Button } from "@/components/ui/Button";

export default function Home() {
  return (
    <>
      {/* Hero: headline, one line, and the search bar. Nothing else competes with it. */}
      <section className="bg-surface">
        <div className="mx-auto max-w-[72rem] px-4 sm:px-8 pt-14 pb-20 sm:pt-20 lg:pt-28 lg:pb-28">
          <h1 className="display max-w-[18ch]">
            Show employers what you <span className="highlight">actually did.</span>
          </h1>
          <p className="mt-6 max-w-[40rem] text-[1.15rem] text-graphite sm:text-[1.3rem]">
            Describe the job you want. We map the skills you can&rsquo;t prove yet, then help you turn your projects
            into a portfolio of exhbts a hiring manager can check in 30 seconds.
          </p>
          <div className="mt-10">
            <StartForm id="start-hero" />
          </div>
        </div>
      </section>

      {/* The skills-gap chart, shown with the fictional demo graduate. */}
      <SkillsGapExample />

      {/* The rest of the journey, one step a section: the same side each time, no zigzag. */}
      <Step
        id="draft"
        ground="bg-mist"
        title="Turn a finished project into an exhbt"
        body={`Add the report, notes or results. We draft a short exhbt with the methodology as a flow and a chart of the key result, from what you gave us and nothing else. You confirm it's yours. On ${PLAN_NAMES.premium}, publishing also runs an originality check.`}
        artifact={<EditorExcerpt />}
      />
      <Step
        id="send"
        ground="bg-surface"
        title="Send each employer their own link"
        body={`Your exhbts live on your own link. On ${PLAN_NAMES.premium}, upload a job description and get a custom link with the ${EXHBTS_PER_JOB_LINK} that fit it best.`}
        artifact={<LinkExcerpt />}
      />

      {/* What an employer sees: a portfolio, reached by scrolling. */}
      <section aria-labelledby="example" className="bg-mist">
        <div className="mx-auto max-w-[72rem] px-4 sm:px-8 py-20 lg:py-28">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 id="example" className="display-2">What an employer sees</h2>
            <Button href="/demo">Open the demo portfolio</Button>
          </div>
          <p className="mt-4 max-w-[40rem] text-lg text-graphite">
            Each project as one result, the method behind it and the skills it proves. Click any of them to see the
            full exhbt.
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

      {/* Pricing summary */}
      <section aria-labelledby="pricing" className="bg-surface">
        <div className="mx-auto max-w-[72rem] px-4 sm:px-8 py-20 lg:py-28">
          <h2 id="pricing" className="display-2">Free to start</h2>
          <p className="mt-4 max-w-2xl text-lg text-graphite">
            Your roadmap is free, and {PLAN_NAMES.free} includes a portfolio link. {PLAN_NAMES.plus} and {PLAN_NAMES.premium} raise the limits.{" "}
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
          <p className="mt-8 text-graphite">
            Universities can give every student {PLAN_NAMES.premium}.{" "}
            <Link href="/universities" className="link text-ink">How licences work</Link>
          </p>
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

/** One step of the journey: what happens on the left, the real screen on the right. */
function Step({ id, ground, title, body, artifact }: { id: string; ground: string; title: string; body: string; artifact: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className={ground}>
      <div className="mx-auto grid max-w-[72rem] items-center gap-10 px-4 py-20 sm:px-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-16 lg:py-28">
        <div>
          <h2 id={id} className="display-2 max-w-[16ch]">{title}</h2>
          <p className="mt-5 max-w-[34rem] text-lg text-graphite">{body}</p>
        </div>
        <div className="min-w-0">{artifact}</div>
      </div>
    </section>
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
    <div className={`flex flex-col rounded-[var(--radius)] p-6 ${featured ? "border-2 border-ink bg-surface" : "border border-line bg-surface"}`}>
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
