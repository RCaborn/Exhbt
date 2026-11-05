import Link from "next/link";
import { Pack } from "@/components/pack/Pack";
import { EditorExcerpt, LinkExcerpt, RoadmapExcerpt, TemplateSpec } from "@/components/home/Excerpts";
import { examplePack } from "@/lib/pack";

export default function Home() {
  return (
    <>
      {/* Hero */}
      <section className="mx-auto grid max-w-[76rem] items-center gap-12 px-4 pt-14 pb-20 sm:px-8 lg:min-h-[calc(100svh-4.5rem)] lg:grid-cols-[minmax(0,1fr)_minmax(0,34rem)] lg:gap-16 lg:pt-10 lg:pb-14">
        <div>
          <h1 className="max-w-[13ch] text-[2.9rem] leading-[1.04] sm:text-[4rem] lg:text-[4.6rem]">
            Show employers what you actually did.
          </h1>
          <p className="mt-6 max-w-[34rem] text-lg text-ink-2 sm:text-xl">
            Every graduate CV claims the same skills. Exhbt starts with a free roadmap of what your target role
            needs, then turns your finished projects into short evidence packs a hiring manager can check in half a
            minute.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-4">
            <Link href="/roadmap/new" className="btn btn-primary min-h-12 px-6 text-base">
              Get your free roadmap
            </Link>
            <Link href="/how-to-read-a-pack" className="link">
              How employers read a pack
            </Link>
          </div>
          <p className="hint mt-4">Free. All you need is an email address.</p>
        </div>
        <Pack pack={examplePack} example headingLevel="h2" />
      </section>

      {/* How it works */}
      <section aria-labelledby="how" className="border-t border-rule">
        <div className="mx-auto max-w-[76rem] px-4 py-20 sm:px-8 lg:py-28">
          <h2 id="how" className="max-w-[20ch] text-[2.2rem] sm:text-[2.8rem]">
            From a CV that says &ldquo;analytical&rdquo; to work that proves it
          </h2>

          <div className="mt-16 space-y-20 lg:space-y-24">
            <Step
              title="Find out what is missing"
              body="Upload your CV and name the role you want. The roadmap lists the skills that role asks for which your CV does not show yet, and suggests projects small enough to finish in a few weeks that would prove them."
              artifact={<RoadmapExcerpt />}
            />
            <Step
              title="Write the project up in 200 words"
              body="Upload the report, notes or results and we draft each field of the pack from what you gave us; nothing is added. You edit it within the limits, and it only goes live once you confirm it is accurate and your own and it passes an originality check."
              artifact={<EditorExcerpt />}
              flip
            />
            <Step
              title="Send one link with your application"
              body="Every pack gets its own address. On the Custom plan you can paste a job advert and get a single link showing your three or four most relevant packs, in the order that suits that job."
              artifact={<LinkExcerpt />}
            />
          </div>
        </div>
      </section>

      {/* What employers see */}
      <section aria-labelledby="read" className="border-t border-rule bg-surface">
        <div className="mx-auto grid max-w-[76rem] gap-12 px-4 py-20 sm:px-8 lg:grid-cols-[minmax(0,1fr)_24rem] lg:gap-24 lg:py-28">
          <div className="max-w-2xl">
            <h2 id="read" className="text-[2.2rem] sm:text-[2.8rem]">The same seven parts, every time</h2>
            <p className="mt-6 text-lg">
              Hiring managers skim. A pack is built for that: the outcome comes first, in one sentence, so the point
              lands before anything else does. Method and results sit underneath with hard limits, and numbers go in
              results where they are easy to find.
            </p>
            <p className="mt-4 text-lg">
              Below that is the work itself (the dissertation, the repository, the dataset) one click away, and a
              line of checks: the author confirmed the pack, the source is attached, and the originality check
              passed. Because every pack follows one layout, a reader who has seen one can read the next in thirty
              seconds.
            </p>
            <Link href="/how-to-read-a-pack" className="link mt-6 inline-block font-medium">
              The guide for employers and careers staff
            </Link>
          </div>
          <TemplateSpec />
        </div>
      </section>

      {/* Pricing summary */}
      <section aria-labelledby="pricing" className="border-t border-rule">
        <div className="mx-auto max-w-[76rem] px-4 py-20 sm:px-8 lg:py-28">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <h2 id="pricing" className="text-[2.2rem] sm:text-[2.8rem]">Less than a sandwich a month</h2>
            <Link href="/pricing" className="link">Compare plans in full</Link>
          </div>
          <div className="mt-10 grid border-t border-ink sm:grid-cols-3">
            <Plan name="Free" price="£0" detail="Your skills-gap roadmap." />
            <Plan name="Basic" price="£9 a year" detail="Unlimited evidence packs, each checked and published at its own link." />
            <Plan name="Custom" price="£15 a year" detail="Everything in Basic, plus a tailored link for each job you apply to." />
          </div>
          <p className="mt-10 max-w-2xl text-ink-2">
            Universities can license Exhbt for every student, with an admin view of take-up.{" "}
            <Link href="/universities" className="link text-ink">How institutional licences work</Link>
          </p>
        </div>
      </section>

      {/* Close */}
      <section className="border-t border-rule">
        <div className="mx-auto flex max-w-[76rem] flex-wrap items-center justify-between gap-8 px-4 py-16 sm:px-8">
          <p className="max-w-[24ch] font-display text-[2rem] leading-tight">
            Start with the roadmap. It costs nothing and takes one form.
          </p>
          <Link href="/roadmap/new" className="btn btn-primary min-h-12 px-6 text-base">
            Get your free roadmap
          </Link>
        </div>
      </section>
    </>
  );
}

function Step({
  title,
  body,
  artifact,
  flip,
}: {
  title: string;
  body: string;
  artifact: React.ReactNode;
  flip?: boolean;
}) {
  return (
    <div className="grid items-center gap-8 md:grid-cols-2 md:gap-16">
      <div className={flip ? "md:order-2" : ""}>
        <h3 className="text-[1.75rem] sm:text-[2rem]">{title}</h3>
        <p className="mt-4 max-w-[34rem] text-lg text-ink-2">{body}</p>
      </div>
      <div className={`w-full max-w-[30rem] ${flip ? "md:order-1 md:justify-self-start" : "md:justify-self-end"}`}>
        {artifact}
      </div>
    </div>
  );
}

function Plan({ name, price, detail }: { name: string; price: string; detail: string }) {
  return (
    <div className="border-b border-rule py-6 sm:border-b-0 sm:border-r sm:px-6 sm:first:pl-0 sm:last:border-r-0">
      <p className="font-medium">{name}</p>
      <p className="mt-1 font-display text-[1.9rem]">{price}</p>
      <p className="mt-2 text-ink-2">{detail}</p>
    </div>
  );
}
