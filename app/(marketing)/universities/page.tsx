import type { Metadata } from "next";
import Link from "next/link";
import { FeatureList } from "@/components/site/FeatureList";
import { PLAN_NAMES } from "@/lib/entitlements";
import { marketingFeatures } from "@/lib/marketing-features";
import { LeadForm } from "./LeadForm";

export const metadata: Metadata = {
  title: "For universities",
  description: "Give your students a free roadmap and a portfolio of their own. Get in touch about a licence.",
};

export default function UniversitiesPage() {
  return (
    <div className="mx-auto max-w-[76rem] px-4 pt-14 pb-24 sm:px-8 lg:pt-20">
      <div className="max-w-3xl">
        <h1 className="display">For universities</h1>
        <p className="mt-4 text-lg text-graphite">
          A university licence gives every student {PLAN_NAMES.max}: a skills roadmap for the job they want, and a
          portfolio of exhbts they can send to employers.
        </p>
      </div>

      <section aria-labelledby="gets" className="mt-16 grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-20">
        <div>
          <h2 id="gets">What each student gets</h2>
          <p className="mt-3 text-graphite">The same as the {PLAN_NAMES.max} plan on the pricing page:</p>
          <FeatureList items={marketingFeatures("max")} className="mt-5" />
        </div>
        <div>
          <h2>Students and their work</h2>
          <p className="mt-3 text-graphite">
            Students own their exhbts and choose when to publish them. Read how we handle their data in the{" "}
            <Link href="/legal/privacy" className="link text-ink">privacy policy</Link>.
          </p>
        </div>
      </section>

      <section aria-labelledby="contact" className="mt-24 grid gap-12 border-t border-line pt-12 lg:grid-cols-[18rem_1fr]">
        <div>
          <h2 id="contact">Talk to us</h2>
          <p className="mt-3 text-graphite">Tell us about your institution and we&rsquo;ll get in touch.</p>
        </div>
        <div className="max-w-xl">
          <LeadForm />
        </div>
      </section>
    </div>
  );
}
