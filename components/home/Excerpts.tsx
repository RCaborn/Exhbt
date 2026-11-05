import { Check } from "lucide-react";

/** Small, real-looking slices of the product used on the home page instead of illustrations. */

export function RoadmapExcerpt() {
  return (
    <figure className="rounded border border-rule bg-surface text-[0.9rem] shadow-pack" aria-label="Part of a roadmap">
      <div className="border-b border-rule px-5 py-3.5">
        <p className="font-display text-[1.15rem]">Your roadmap to junior data analyst</p>
      </div>
      <table className="w-full text-left">
        <thead className="text-xs text-ink-2">
          <tr className="border-b border-rule">
            <th scope="col" className="px-5 py-2 font-normal">Gap</th>
            <th scope="col" className="px-5 py-2 font-normal">In your CV</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-rule">
          <tr>
            <th scope="row" className="px-5 py-2.5 font-medium">SQL on real datasets</th>
            <td className="px-5 py-2.5 text-ink-2">Some, not enough</td>
          </tr>
          <tr>
            <th scope="row" className="px-5 py-2.5 font-medium">Dashboards for non-specialists</th>
            <td className="px-5 py-2.5 text-ink-2">Not yet</td>
          </tr>
        </tbody>
      </table>
      <div className="border-t border-rule px-5 py-3.5">
        <p className="text-xs text-ink-2">Suggested project</p>
        <p className="mt-0.5 font-medium">Rebuild a council&rsquo;s open bin-collection data as a dashboard</p>
        <p className="mt-0.5 font-mono text-xs text-ink-2">3 weeks</p>
      </div>
    </figure>
  );
}

export function EditorExcerpt() {
  return (
    <figure className="rounded border border-rule bg-surface text-[0.9rem] shadow-pack" aria-label="Part of the pack editor">
      <div className="px-5 pt-4">
        <div className="flex items-baseline justify-between">
          <p className="font-medium">Outcome</p>
          <p className="font-mono text-xs text-ink-2">1 sentence</p>
        </div>
        <p className="mt-2 border-b border-ink pb-2.5 leading-snug">
          Sending reminder texts 3 hours before an appointment cut missed appointments by 18% across two GP practices.
        </p>
      </div>
      <div className="mt-4 flex items-center justify-between border-y border-rule px-5 py-2.5 text-xs">
        <span className="inline-flex items-center gap-1.5 text-verify">
          <Check aria-hidden size={13} strokeWidth={2.25} /> Originality check passed
        </span>
        <span className="font-mono text-ink-2">164 / 200 words</span>
      </div>
      <div className="flex items-start gap-2.5 px-5 py-3.5">
        <span className="mt-0.5 inline-flex size-4 shrink-0 items-center justify-center rounded-sm bg-verify text-white">
          <Check aria-hidden size={12} strokeWidth={3} />
        </span>
        <p>This is accurate and it is my own work.</p>
      </div>
    </figure>
  );
}

const LINK_PACKS = [
  "Cutting missed GP appointments by changing when reminders are sent",
  "A ward-level bed occupancy dashboard in Power BI",
  "Cleaning 4 years of A&E wait-time data for a public report",
];

export function LinkExcerpt() {
  return (
    <figure className="rounded border border-rule bg-surface text-[0.9rem] shadow-pack" aria-label="A job-specific link">
      <div className="flex items-center gap-2 border-b border-rule px-5 py-2.5 font-mono text-xs text-ink-2">
        <span className="size-2 rounded-full bg-rule" aria-hidden />
        exhbt/l/7fQ2mZr9Kd…
      </div>
      <div className="px-5 pt-4 pb-1">
        <p className="text-xs text-ink-2">Amara Okafor for</p>
        <p className="font-display text-[1.15rem]">Junior data analyst, Northfield Health</p>
      </div>
      <ol className="divide-y divide-rule px-5">
        {LINK_PACKS.map((t) => (
          <li key={t} className="flex items-start justify-between gap-4 py-2.5">
            <span>{t}</span>
            <Check aria-label="Checked" size={14} strokeWidth={2.25} className="mt-1 shrink-0 text-verify" />
          </li>
        ))}
      </ol>
    </figure>
  );
}

const TEMPLATE = [
  ["Title", "80 characters"],
  ["Outcome", "1 sentence"],
  ["Method", "2 sentences"],
  ["Results", "3 lines"],
  ["The work", "1 link or file"],
  ["Reflection", "2 sentences"],
  ["Checks", "added by Exhbt"],
] as const;

export function TemplateSpec() {
  return (
    <figure className="rounded border border-ink bg-surface" aria-label="The fixed pack template">
      <div className="flex items-baseline justify-between border-b border-ink px-5 py-3">
        <p className="font-display text-[1.15rem]">Every pack</p>
        <p className="font-mono text-xs text-ink-2">≈ 200 words</p>
      </div>
      <dl className="divide-y divide-rule px-5 text-[0.95rem]">
        {TEMPLATE.map(([field, limit]) => (
          <div key={field} className="flex justify-between gap-6 py-2.5">
            <dt className="font-medium">{field}</dt>
            <dd className="font-mono text-sm text-ink-2">{limit}</dd>
          </div>
        ))}
      </dl>
    </figure>
  );
}
