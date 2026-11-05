import type { Metadata } from "next";
import { Pack } from "@/components/pack/Pack";
import { examplePack } from "@/lib/pack";

export const metadata: Metadata = {
  title: "How to read a pack",
  description: "A two-minute guide for hiring managers and careers staff to Exhbt evidence packs.",
};

const FIELDS: { name: string; body: string }[] = [
  {
    name: "Title and outcome",
    body: "The title names the project. The outcome is one sentence saying what was achieved, written as a result rather than an activity. If you read nothing else, read this line.",
  },
  {
    name: "Method",
    body: "Two sentences on how the work was done: the approach, the tools, the scale. Useful for judging whether the skills match the job.",
  },
  {
    name: "Results",
    body: "Up to three lines, usually with numbers. Our drafting tool only uses figures the author supplied, and the author confirms each one before publishing.",
  },
  {
    name: "The work",
    body: "A link to the thing itself: a report, repository, dataset or recording. Open it if a claim matters to your decision.",
  },
  {
    name: "Reflection",
    body: "Two sentences on what the author learned or would change. It tells you how they think about their own work, which a CV rarely does.",
  },
  {
    name: "Checks",
    body: "Added by Exhbt, not the author. Confirmed by author: they declared the pack accurate and their own. Source attached: the underlying work is linked. Originality checked: the text and attached work passed a third-party originality check on the date shown.",
  },
];

export default function HowToRead() {
  return (
    <div className="mx-auto max-w-[76rem] px-4 pt-14 sm:px-8 lg:pt-20">
      <div className="max-w-2xl">
        <h1 className="text-[2.8rem] sm:text-[4.4rem]">How to read a pack</h1>
        <p className="mt-4 text-lg text-ink-2">
          For hiring managers and careers staff. Every pack uses the same layout and limits, about 200 words in
          all, so once you know the parts you can read any pack in about thirty seconds.
        </p>
      </div>

      <div className="mt-14 grid gap-14 lg:grid-cols-[minmax(0,34rem)_minmax(0,1fr)] lg:gap-20">
        <div className="lg:sticky lg:top-8 lg:self-start">
          <Pack pack={examplePack} example />
        </div>
        <div className="max-w-xl">
          <dl className="divide-y divide-rule border-y border-rule">
            {FIELDS.map((f) => (
              <div key={f.name} className="py-6">
                <dt className="text-[1.3rem] font-bold tracking-[-0.02em]">{f.name}</dt>
                <dd className="mt-2">{f.body}</dd>
              </div>
            ))}
          </dl>

          <section aria-labelledby="not" className="mt-12">
            <h2 id="not" className="text-[1.6rem]">What a pack does not tell you</h2>
            <p className="mt-3">
              The checks confirm that the author stands behind the pack and that the work is attached and original.
              They do not grade the work or verify results with a third party such as a supervisor. Treat a pack as
              well-organised evidence to look at and ask about, not as a reference.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
