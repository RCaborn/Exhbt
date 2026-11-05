import { Check } from "lucide-react";
import { BrowserFrame } from "./BrowserFrame";

/** Small, real-looking slices of the product used on the home page instead of illustrations. */

export function RoadmapExcerpt() {
  return (
    <BrowserFrame url="exhbt/roadmap">
      <figure className="text-[0.9rem]" aria-label="Part of a roadmap">
        <p className="border-b border-rule px-5 py-3.5 text-[1.05rem] font-bold tracking-[-0.01em]">
          Your roadmap to junior data analyst
        </p>
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
          <span className="chip mt-2 font-mono">3 weeks</span>
        </div>
      </figure>
    </BrowserFrame>
  );
}

export function EditorExcerpt() {
  return (
    <BrowserFrame url="exhbt/packs/new">
      <figure className="text-[0.9rem]" aria-label="Part of the pack editor">
        <div className="px-5 pt-4">
          <div className="flex items-baseline justify-between">
            <p className="font-semibold">Outcome</p>
            <p className="font-mono text-xs text-ink-2">1 sentence</p>
          </div>
          <p className="mt-2 border-b-2 border-ink pb-2.5 font-serif text-[1rem] leading-snug">
            Sending reminder texts 3 hours before an appointment cut missed appointments by 18% across two GP
            practices.
          </p>
        </div>
        <div className="mt-4 flex items-center justify-between border-y border-rule px-5 py-2.5 text-xs">
          <span className="inline-flex items-center gap-1.5 font-medium">
            <span className="inline-flex size-4 items-center justify-center rounded-full border border-ink bg-green">
              <Check aria-hidden size={10} strokeWidth={3} />
            </span>
            Originality check passed
          </span>
          <span className="font-mono text-ink-2">164 / 200 words</span>
        </div>
        <div className="flex items-start gap-2.5 px-5 py-3.5">
          <span className="mt-0.5 inline-flex size-4 shrink-0 items-center justify-center rounded-[3px] border border-ink bg-green">
            <Check aria-hidden size={12} strokeWidth={3} />
          </span>
          <p>This is accurate and it is my own work.</p>
        </div>
      </figure>
    </BrowserFrame>
  );
}

const LINK_PACKS = [
  "Cutting missed GP appointments by changing when reminders are sent",
  "A ward-level bed occupancy dashboard in Power BI",
  "Cleaning 4 years of A&E wait-time data for a public report",
];

export function LinkExcerpt() {
  return (
    <BrowserFrame url="exhbt/l/7fQ2mZr9Kd…">
      <figure className="text-[0.9rem]" aria-label="A job-specific link">
        <div className="px-5 pt-4 pb-1">
          <p className="text-xs text-ink-2">Amara Okafor for</p>
          <p className="text-[1.05rem] font-bold tracking-[-0.01em]">Junior data analyst, Northfield Health</p>
        </div>
        <ol className="divide-y divide-rule px-5">
          {LINK_PACKS.map((t) => (
            <li key={t} className="flex items-start justify-between gap-4 py-2.5">
              <span className="font-serif">{t}</span>
              <span className="mt-0.5 inline-flex size-4 shrink-0 items-center justify-center rounded-full border border-ink bg-green">
                <Check aria-label="Checked" size={10} strokeWidth={3} />
              </span>
            </li>
          ))}
        </ol>
      </figure>
    </BrowserFrame>
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
    <figure className="rounded-[var(--radius)] border-[1.5px] border-ink bg-surface" aria-label="The fixed pack template">
      <div className="flex items-center justify-between border-b-[1.5px] border-ink px-5 py-3.5">
        <p className="text-[1.15rem] font-bold tracking-[-0.01em]">Every pack</p>
        <span className="chip font-mono">≈ 200 words</span>
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
