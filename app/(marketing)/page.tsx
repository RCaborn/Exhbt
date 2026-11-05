import Link from "next/link";
import { Pack } from "@/components/pack/Pack";
import { EditorExcerpt, LinkExcerpt, RoadmapExcerpt, TemplateSpec } from "@/components/home/Excerpts";
import { StartForm } from "@/components/home/StartForm";
import { Swirl } from "@/components/home/Swirl";
import { examplePack } from "@/lib/pack";

export default function Home() {
  return (
    <>
      {/* Hero: explanation, then the start form, above the fold on every screen. */}
      <section className="relative overflow-hidden bg-surface">
        {/* A light-blue field behind the right column: layout, not a container. */}
        <div aria-hidden className="absolute inset-y-0 right-0 hidden w-[38%] bg-sky lg:block" />
        <div className="relative mx-auto grid max-w-[78rem] items-center gap-14 px-4 pt-10 pb-20 sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,27rem)] lg:gap-16 lg:pt-16 lg:pb-24">
          <div>
            <h1 className="text-[2.9rem] sm:text-[4.4rem] lg:text-[4.9rem]">
              Show employers what you <span className="highlight">actually did.</span>
            </h1>
            <p className="mt-6 max-w-[36rem] text-[1.15rem] text-ink-2 sm:text-[1.3rem]">
              Tell us the job you want. We map the skills your CV doesn&rsquo;t prove yet, then help you turn your
              projects into evidence a hiring manager can check in 30 seconds.
            </p>
            <div className="mt-9">
              <StartForm id="start-hero" />
            </div>
            <p className="mt-4 text-sm font-medium text-ink-2">Free. No card. Just an email.</p>
          </div>
          <div id="example-pack" className="relative scroll-mt-8">
            {/* The page's one green moment, half-hidden behind the pack. */}
            <Swirl className="absolute -top-[78px] -right-[64px] z-0 w-[13rem] sm:-top-[74px] sm:right-auto sm:-left-[196px] sm:w-[18rem]" />
            <Pack pack={examplePack} example animateChecks variant="preview" className="relative z-10" />
          </div>
        </div>
      </section>

      {/* The journey: one rail, three real artifacts. */}
      <section aria-labelledby="how" className="bg-surface">
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
              body="Upload your CV and name the role. You get the skills that role asks for which your CV doesn't show yet, and projects small enough to finish in a few weeks."
              artifact={<RoadmapExcerpt />}
            />
            <Stage
              title="Prove one, in 200 words"
              body="Add the report, notes or results. We draft each field from what you gave us and nothing else; you edit it, confirm it's yours, and it passes an originality check."
              artifact={<EditorExcerpt />}
            />
            <Stage
              title="Send one link"
              body="Every pack gets its own address. On Custom, paste a job advert and get one link with your three or four most relevant packs, in the order that suits that job."
              artifact={<LinkExcerpt />}
            />
          </ol>
        </div>
      </section>

      {/* Statement band: the one dark moment. */}
      <section aria-label="Why evidence beats claims" className="bg-ink text-white">
        <div className="mx-auto max-w-[78rem] px-4 py-24 sm:px-8 lg:py-32">
          <p className="max-w-[16ch] text-[2.6rem] leading-[1.02] font-extrabold tracking-[-0.03em] sm:text-[4.6rem] lg:text-[5.6rem]">
            A CV says &ldquo;analytical&rdquo;. A pack shows the{" "}
            <a href="#example-pack" className="text-blue underline decoration-[3px] underline-offset-[10px] hover:decoration-white">
              18%
            </a>
            .
          </p>
          <p className="mt-8 max-w-[38rem] text-[1.15rem] text-[#c9d7e8]">
            Every graduate lists the same adjectives. A number from a real project, with the work one click away, is
            something a hiring manager can actually check, and remember.
          </p>
        </div>
      </section>

      {/* What employers see */}
      <section aria-labelledby="read" className="bg-sky">
        <div className="mx-auto grid max-w-[78rem] gap-12 px-4 py-20 sm:px-8 lg:grid-cols-[minmax(0,1fr)_24rem] lg:gap-24 lg:py-28">
          <div className="max-w-2xl">
            <h2 id="read" className="text-[2.4rem] sm:text-[3.4rem]">The same seven parts, every time</h2>
            <p className="mt-6 text-lg">
              Hiring managers skim, so a pack puts the outcome first, in one sentence, where the point lands before
              anything else does. Method and results sit underneath with hard limits; numbers go in results where
              they are easy to find.
            </p>
            <p className="mt-4 text-lg">
              Below that is the work itself (the dissertation, the repository, the dataset) one click away, and a
              line of checks: the author confirmed it, the source is attached, the originality check passed. One
              layout for every pack means a reader who has seen one can read the next in thirty seconds.
            </p>
            <Link href="/how-to-read-a-pack" className="link mt-7 inline-block font-semibold">
              The guide for employers and careers staff
            </Link>
          </div>
          <TemplateSpec />
        </div>
      </section>

      {/* Pricing summary */}
      <section aria-labelledby="pricing" className="bg-surface">
        <div className="mx-auto max-w-[78rem] px-4 py-20 sm:px-8 lg:py-28">
          <h2 id="pricing" className="text-[2.4rem] sm:text-[3.4rem]">Less than a sandwich a month</h2>
          <p className="mt-4 max-w-2xl text-lg text-ink-2">
            The roadmap is free. Pay once a year when you have work worth showing.{" "}
            <Link href="/pricing" className="link text-ink">Compare plans</Link>
          </p>
          <div className="mt-12 grid gap-4 md:grid-cols-3">
            <Plan name="Free" price="£0" detail="Your skills-gap roadmap." />
            <Plan
              name="Basic"
              price="£9"
              per="a year"
              detail="Unlimited evidence packs, each checked and published at its own link."
              featured
            />
            <Plan name="Custom" price="£15" per="a year" detail="Everything in Basic, plus a tailored link for every job you apply to." />
          </div>
          <p className="mt-10 max-w-2xl text-ink-2">
            Universities can license Exhbt for every student, with an admin view of take-up.{" "}
            <Link href="/universities" className="link text-ink">How institutional licences work</Link>
          </p>
        </div>
      </section>

      {/* Closing band: light blue, same action as the hero. */}
      <section aria-labelledby="close" className="bg-sky-2">
        <div className="mx-auto grid max-w-[78rem] items-center gap-10 px-4 py-20 sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,40rem)] lg:py-24">
          <h2 id="close" className="max-w-[12ch] text-[2.6rem] sm:text-[3.8rem]">
            Start with the roadmap. It&rsquo;s free.
          </h2>
          <div>
            <StartForm id="start-close" tone="blue" />
            <p className="mt-4 text-sm font-medium">One form. You&rsquo;ll get a sign-in link by email.</p>
          </div>
        </div>
      </section>
    </>
  );
}

function Stage({ title, body, artifact }: { title: string; body: string; artifact: React.ReactNode }) {
  return (
    <li className="relative">
      <span
        aria-hidden
        className="relative z-10 block size-6 rounded-full border-2 border-ink bg-blue"
      />
      <h3 className="mt-6 text-[1.5rem] sm:text-[1.7rem]">{title}</h3>
      <p className="mt-3 max-w-[30rem] text-ink-2">{body}</p>
      <div className="mt-7 max-w-[30rem]">{artifact}</div>
    </li>
  );
}

function Plan({
  name,
  price,
  per,
  detail,
  featured,
}: {
  name: string;
  price: string;
  per?: string;
  detail: string;
  featured?: boolean;
}) {
  return (
    <div
      className={`rounded-[var(--radius)] p-6 ${
        featured ? "border-2 border-ink bg-surface" : "border border-rule bg-sky"
      }`}
    >
      <p className="font-semibold">{name}</p>
      <p className="mt-2 flex items-baseline gap-2">
        <span className="text-[2.6rem] leading-none font-extrabold tracking-[-0.03em]">{price}</span>
        {per && <span className="text-ink-2">{per}</span>}
      </p>
      <p className="mt-3 text-ink-2">{detail}</p>
    </div>
  );
}
