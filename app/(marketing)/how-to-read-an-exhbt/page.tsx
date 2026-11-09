import type { Metadata } from "next";
import { Exhbt } from "@/components/exhbt/Exhbt";
import { exampleExhbt } from "@/lib/exhbt";

export const metadata: Metadata = {
  title: "For employers: how to read an exhbt",
  description: "A two-minute guide for hiring managers and careers staff to Exhbt portfolios. Free, no account needed.",
};

const FIELDS: { id?: string; name: string; body: string }[] = [
  {
    name: "Catalogue number and title",
    body: "EX·01, EX·02 and so on give each exhbt's place in the portfolio, so you can refer to one in an interview. The title names the project.",
  },
  {
    name: "Outcome",
    body: "One sentence saying what was achieved, written as a result rather than an activity. If you read nothing else, read this line.",
  },
  {
    name: "Methodology",
    body: "The steps the author took, in order, drawn as a flow. The dark final step is where the result came from. Useful for judging whether the way they work fits the job.",
  },
  {
    name: "Key result",
    body: "When a project has numbers, the main one is shown as a before-and-after chart, with the change on the right. Every value is printed, so you never have to read it off an axis. Our drafting tool only uses figures the author supplied, and the author confirms each one before publishing.",
  },
  {
    name: "Skills",
    body: "The skills this project demonstrates, in boxes. On a job-specific link, the exhbts are chosen and ordered by how well these match your advert.",
  },
  {
    name: "The work",
    body: "A link to the thing itself: a report, repository, dataset or recording. Open it if a claim matters to your decision.",
  },
  {
    id: "checks",
    name: "Checked by exhbt",
    body: "The seal and the three ticks are added by Exhbt, not the author. Confirmed by author: they declared it accurate and their own. Source attached: the underlying work is linked. Originality checked: the text and attached work passed a third-party originality check on the date on the seal.",
  },
  {
    name: "Reflection",
    body: "Two sentences on what the author learned or would change. It tells you how they think about their own work, which a CV rarely does.",
  },
];

export default function HowToRead() {
  return (
    <div className="mx-auto max-w-[76rem] px-4 pt-14 pb-24 sm:px-8 lg:pt-20">
      <div className="max-w-2xl">
        <h1 className="display">How to read an exhbt</h1>
        <p className="mt-4 text-lg text-graphite">
          For hiring managers and careers staff. An exhbt is one project from a graduate&rsquo;s portfolio. Every
          one uses the same layout and limits, about 200 words plus a chart, so once you know the parts you can
          read any of them in about thirty seconds. Free, and you never need an account.
        </p>
      </div>

      <div className="mt-14 grid gap-14 lg:grid-cols-[minmax(0,34rem)_minmax(0,1fr)] lg:gap-20">
        <div className="lg:sticky lg:top-8 lg:self-start">
          <Exhbt exhbt={exampleExhbt} example position={1} />
        </div>
        <div className="max-w-xl">
          <dl className="divide-y divide-line border-y border-line">
            {FIELDS.map((f) => (
              <div key={f.name} id={f.id} className="scroll-mt-8 py-6">
                <dt className="text-[1.3rem] font-bold tracking-[-0.02em]">{f.name}</dt>
                <dd className="mt-2">{f.body}</dd>
              </div>
            ))}
          </dl>

          <section aria-labelledby="not" className="mt-12">
            <h2 id="not">What an exhbt does not tell you</h2>
            <p className="mt-3">
              The checks confirm that the author stands behind it and that the work is attached and original. They
              do not grade the work or verify results with a third party such as a supervisor. Treat an exhbt as
              well-organised evidence to look at and ask about, not as a reference.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
