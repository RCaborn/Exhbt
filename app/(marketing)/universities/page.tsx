import type { Metadata } from "next";
import { PLAN_NAMES } from "@/lib/entitlements";
import { LeadForm } from "./LeadForm";

export const metadata: Metadata = {
  title: "For universities",
  description: "License Exhbt for every student, with an admin view of take-up. UK data hosting, WCAG 2.1 AA.",
};

const USAGE = [
  ["Seats used", "1,284 of 2,000"],
  ["Roadmaps completed", "1,102"],
  ["Students with a published exhbt", "617"],
  ["Exhbts opened by employers, last 30 days", "2,940"],
] as const;

const COURSES = [
  ["Computer Science", "212", "61%"],
  ["Economics", "148", "54%"],
  ["Biomedical Science", "131", "47%"],
  ["History", "64", "31%"],
] as const;

export default function UniversitiesPage() {
  return (
    <div className="mx-auto max-w-[76rem] px-4 pt-14 sm:px-8 lg:pt-20">
      <div className="max-w-3xl">
        <h1 className="display">For universities</h1>
        <p className="mt-4 text-lg text-graphite">
          Give every student a roadmap and {PLAN_NAMES.premium}, and see which courses are turning project work into
          evidence employers open. Licences run for a year and are invoiced, from £6,000 depending on cohort size.
        </p>
      </div>

      <section aria-labelledby="view" className="mt-16 grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:gap-20">
        <figure className="overflow-hidden rounded border border-line bg-surface shadow-pack" aria-labelledby="view">
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-5 py-3.5">
            <p className="font-medium">Admin view</p>
            <p className="font-mono text-xs text-graphite">Licence 1 Sep 2026 – 31 Aug 2027</p>
          </div>
          <dl className="grid grid-cols-2 border-b border-line">
            {USAGE.map(([k, v]) => (
              <div key={k} className="border-line px-5 py-4 odd:border-r [&:nth-child(-n+2)]:border-b">
                <dt className="text-sm text-graphite">{k}</dt>
                <dd className="mt-1 font-mono text-[1.05rem]">{v}</dd>
              </div>
            ))}
          </dl>
          <table className="w-full text-left text-[0.92rem]">
            <thead className="text-xs text-graphite">
              <tr className="border-b border-line">
                <th scope="col" className="px-5 py-2 font-normal">Course</th>
                <th scope="col" className="px-5 py-2 text-right font-normal">Students</th>
                <th scope="col" className="px-5 py-2 text-right font-normal">With an exhbt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {COURSES.map(([c, n, p]) => (
                <tr key={c}>
                  <th scope="row" className="px-5 py-2.5 font-normal">{c}</th>
                  <td className="px-5 py-2.5 text-right font-mono">{n}</td>
                  <td className="px-5 py-2.5 text-right font-mono">{p}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <figcaption className="sr-only">Sample admin dashboard with illustrative numbers</figcaption>
        </figure>

        <div>
          <h2 id="view" className="">What your team sees</h2>
          <p className="mt-3">
            Take-up by course, so careers staff know where to spend workshop time. You see counts, never the content
            of a student&rsquo;s CV or exhbts.
          </p>
          <p className="mt-3 text-sm text-graphite">Numbers shown are illustrative.</p>
        </div>
      </section>

      <section aria-labelledby="terms" className="mt-24 grid gap-12 border-t border-line pt-12 lg:grid-cols-[18rem_1fr]">
        <h2 id="terms" className="">What procurement will ask</h2>
        <dl className="grid max-w-3xl gap-x-12 gap-y-8 sm:grid-cols-2">
          <div>
            <dt className="font-medium">Data</dt>
            <dd className="mt-1.5 text-graphite">
              Stored in the UK, encrypted at rest and in transit. Students can export or delete their data
              themselves. We publish our list of processors.
            </dd>
          </div>
          <div>
            <dt className="font-medium">Accessibility</dt>
            <dd className="mt-1.5 text-graphite">Built to WCAG 2.1 AA, including the exhbt editor.</dd>
          </div>
          <div>
            <dt className="font-medium">Onboarding</dt>
            <dd className="mt-1.5 text-graphite">
              Students join with their university email address, or you upload a CSV. No IT integration needed.
            </dd>
          </div>
          <div>
            <dt className="font-medium">Billing</dt>
            <dd className="mt-1.5 text-graphite">Annual invoice. Seat count and dates agreed up front.</dd>
          </div>
        </dl>
      </section>

      <section aria-labelledby="contact" className="mt-24 grid gap-12 border-t border-line pt-12 lg:grid-cols-[18rem_1fr]">
        <div>
          <h2 id="contact" className="">Talk to us</h2>
          <p className="mt-3 text-graphite">We reply within two working days.</p>
        </div>
        <div className="max-w-xl">
          <LeadForm />
        </div>
      </section>
    </div>
  );
}
