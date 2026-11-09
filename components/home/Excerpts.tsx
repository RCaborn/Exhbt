import { Check } from "lucide-react";
import { APP_HOST, portfolioUrl } from "@/lib/hosts";
import { BrowserFrame } from "./BrowserFrame";

/** Small, real-looking slices of the product used on the home page instead of illustrations. */

export function EditorExcerpt() {
  return (
    <BrowserFrame url={`${APP_HOST}/exhbts/new`}>
      <figure className="text-[0.9rem]" aria-label="Part of the exhbt editor">
        <div className="px-5 pt-4">
          <div className="flex items-baseline justify-between">
            <p className="font-semibold">Outcome</p>
            <p className="font-mono text-xs text-graphite">1 sentence</p>
          </div>
          <p className="mt-2 border-b-2 border-ink pb-2.5 text-[1rem] leading-snug">
            Sending reminder texts 3 hours before an appointment cut missed appointments by 18% across two GP
            practices.
          </p>
        </div>
        <div className="mt-4 flex items-center justify-between border-y border-line px-5 py-2.5 text-xs">
          <span className="inline-flex items-center gap-1.5 font-medium">
            <span className="inline-flex size-4 items-center justify-center rounded-full border border-ink bg-mint">
              <Check aria-hidden size={10} strokeWidth={3} />
            </span>
            Originality check passed
          </span>
          <span className="font-mono text-graphite">164 / 200 words</span>
        </div>
        <div className="flex items-start gap-2.5 px-5 py-3.5">
          <span className="mt-0.5 inline-flex size-4 shrink-0 items-center justify-center rounded-[3px] border border-ink bg-mint">
            <Check aria-hidden size={12} strokeWidth={3} />
          </span>
          <p>This is accurate and it is my own work.</p>
        </div>
      </figure>
    </BrowserFrame>
  );
}

const LINK_EXHBTS = [
  "Cutting missed GP appointments by changing when reminders are sent",
  "A ward-level bed occupancy dashboard in Power BI",
  "Cleaning 4 years of A&E wait-time data for a public report",
];

export function LinkExcerpt() {
  return (
    <BrowserFrame url={portfolioUrl("amara", "northfield-health")}>
      <figure className="text-[0.9rem]" aria-label="A job-specific link">
        <div className="px-5 pt-4 pb-1">
          <p className="text-xs text-graphite">Amara Okafor for</p>
          <p className="text-[1.05rem] font-bold tracking-[-0.01em]">Junior data analyst, Northfield Health</p>
        </div>
        <ol className="divide-y divide-line px-5">
          {LINK_EXHBTS.map((t) => (
            <li key={t} className="flex items-start justify-between gap-4 py-2.5">
              <span>{t}</span>
              <span className="mt-0.5 inline-flex size-4 shrink-0 items-center justify-center rounded-full border border-ink bg-mint">
                <Check aria-label="Checked" size={10} strokeWidth={3} />
              </span>
            </li>
          ))}
        </ol>
      </figure>
    </BrowserFrame>
  );
}
