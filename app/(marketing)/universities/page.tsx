import type { Metadata } from "next";
import Link from "next/link";
import { FeatureList } from "@/components/site/FeatureList";
import { Button } from "@/components/ui/Button";
import { PLAN_NAMES } from "@/lib/entitlements";
import { portfolioHost } from "@/lib/hosts";
import { marketingFeatures } from "@/lib/marketing-features";
import { marketingMetadata } from "@/lib/seo";
import { LeadForm } from "./LeadForm";

export const metadata: Metadata = marketingMetadata("universities");

const FAQ: { q: string; a: React.ReactNode }[] = [
  {
    q: "What would our students get with a licence?",
    a: (
      <>
        Every student gets {PLAN_NAMES.max}. The list above is what that plan includes today, and the{" "}
        <Link href="/pricing" className="link">pricing page</Link> shows it next to the other plans.
      </>
    ),
  },
  {
    q: "Who owns what students write?",
    a: "The student. They write and edit their own exhbts, they choose which ones to publish, and they can unpublish one at any time.",
  },
  {
    q: "Can a student keep their site out of search results?",
    a: "Yes. A setting in their portfolio asks search engines not to list it. Anyone who has the link can still open the page, so students send it to the people they choose.",
  },
  {
    q: "Where is student data stored?",
    a: (
      <>
        In the European Union (Paris, France). The{" "}
        <Link href="/legal/privacy" className="link">privacy policy</Link> lists what we collect and who processes it
        for us.
      </>
    ),
  },
  {
    q: "Does the AI make things up?",
    a: (
      <>
        The AI is told to use only facts the student supplied. We then check every number in a draft against the
        student&rsquo;s own material and flag any we can&rsquo;t find, and the student decides what is published.{" "}
        <Link href="/how-to-read-an-exhbt" className="link">How to read an exhbt</Link> explains what the checks on
        a published exhbt do and don&rsquo;t show.
      </>
    ),
  },
];

const SECTION = "mt-16 border-t border-line pt-12";
const BODY = "mt-4 max-w-2xl space-y-4 text-graphite";

export default function UniversitiesPage() {
  return (
    <div className="mx-auto max-w-[72rem] px-4 pt-14 pb-24 sm:px-8 lg:pt-20">
      <div className="max-w-3xl">
        <h1 className="display">For universities</h1>
        <p className="mt-4 text-lg text-graphite">
          Exhbt helps students work out what a job asks for, close the gaps with real projects, and show the result to
          employers. A licence gives every student {PLAN_NAMES.max}.
        </p>
        <p className="mt-8">
          <Button href="#contact" size="lg">Talk to us</Button>
        </p>
      </div>

      <section aria-labelledby="roadmap" className={SECTION}>
        <h2 id="roadmap" className="display-2">A roadmap for the job they want</h2>
        <div className={BODY}>
          <p>
            A student names the job, adds their CV if they have one, and says where they are now with their education
            and skills. They get a free skills-gap roadmap: what the job asks for, what they already have, and where
            the gaps are.
          </p>
          <p>
            Then they get project ideas that close those gaps, so the next piece of work they do, for a module, a
            placement or on their own, is aimed at something an employer wants to see.
          </p>
        </div>
      </section>

      <section aria-labelledby="exhbts" className={SECTION}>
        <h2 id="exhbts" className="display-2">Exhbts: proof an employer can check</h2>
        <div className={BODY}>
          <p>
            An exhbt is a short write-up of one project: the question, the method, what was found and a key-result
            chart, with the work itself attached. It carries checks that the student confirmed it is accurate and
            their own, and that the source is attached.
          </p>
          <p>
            A student&rsquo;s exhbts sit together on a personal website at{" "}
            <span className="font-mono text-[0.9em] text-ink">{portfolioHost("name")}</span>, an address they can put
            on a CV or in an application.
          </p>
          <p>
            <Link href="/what-is-an-exhbt" className="link">See what an exhbt looks like</Link>
          </p>
        </div>
      </section>

      <section aria-labelledby="job-links" className={SECTION}>
        <h2 id="job-links" className="display-2">A link for each job</h2>
        <div className={BODY}>
          <p>
            For a particular application, a student can make a link that shows one employer only the exhbts that fit
            that job best, in order, each under a line on why it fits. The employer doesn&rsquo;t have to hunt through
            everything else.
          </p>
        </div>
      </section>

      <section aria-labelledby="licence" className={SECTION}>
        <h2 id="licence" className="display-2">How a licence works</h2>
        <div className={BODY}>
          <p>
            Every student at your university gets {PLAN_NAMES.max}. That is what the licence is. This is what the
            plan includes:
          </p>
        </div>
        <FeatureList items={marketingFeatures("max")} className="mt-5" />
        <div className={BODY}>
          <p>For the details of how it would work for your institution, talk to us.</p>
        </div>
      </section>

      <section aria-labelledby="data" className={SECTION}>
        <h2 id="data" className="display-2">Students own their work</h2>
        <div className={BODY}>
          <p>
            Students own their exhbts and choose what to publish. They can hide their site from search engines, and
            their data is stored in the European Union. The{" "}
            <Link href="/legal/privacy" className="link">privacy policy</Link> has the full detail.
          </p>
        </div>
      </section>

      <section aria-labelledby="faq" className={SECTION}>
        <h2 id="faq" className="display-2">Questions</h2>
        <div className="mt-6 max-w-2xl divide-y divide-line border-y border-line">
          {FAQ.map((item) => (
            <details key={item.q} className="py-4">
              <summary className="cursor-pointer font-semibold text-ink">{item.q}</summary>
              <p className="mt-3 text-graphite">{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section aria-labelledby="contact" className={`${SECTION} grid gap-12 lg:grid-cols-[18rem_1fr]`}>
        <div>
          <h2 id="contact" className="display-2">Talk to us</h2>
          <p className="mt-3 text-graphite">Tell us about your institution and we&rsquo;ll get in touch.</p>
        </div>
        <div className="max-w-xl">
          <LeadForm />
        </div>
      </section>
    </div>
  );
}
