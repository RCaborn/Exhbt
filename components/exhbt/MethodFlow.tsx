import { ArrowDown, ArrowRight } from "lucide-react";

type Step = { step: string; detail?: string };

/**
 * The methodology as a pipeline: step boxes joined by arrows, the last step (the
 * result) filled ink as the endpoint. Lays out by the space it is given, not the
 * screen: a row when its container is wide enough, a vertical pipeline otherwise
 * (narrow cards, phones). Needs an ancestor with the `@container` class.
 * Semantically an ordered list, so screen readers hear "1 of 6, Collected data…".
 *
 * `variant="page"` is the exhbt page's flowchart (decision 0022): bigger boxes, no step
 * numbers, a row from 42rem of container width, colours from the page's --xp-* variables
 * so a portfolio look can restyle it. The default is the Phase 1 card's.
 */
export function MethodFlow({ steps, variant = "card" }: { steps: Step[]; variant?: "card" | "page" }) {
  if (variant === "page") return <PageFlow steps={steps} />;
  return (
    <ol className="flex flex-col gap-0 @xl:flex-row @xl:items-stretch" aria-label="Methodology">
      {steps.map((s, i) => {
        const last = i === steps.length - 1;
        return (
          <li key={`${i}-${s.step}`} className="flex flex-col items-stretch @xl:min-w-0 @xl:flex-1 @xl:flex-row @xl:items-center">
            <div
              className={`flex items-baseline gap-3 rounded-[8px] border px-3 py-2.5 @xl:h-full @xl:min-w-0 @xl:flex-1 @xl:flex-col @xl:items-start @xl:gap-0.5 @xl:px-2 @xl:py-2 ${
                last ? "border-ink bg-ink text-white" : "border-line bg-surface"
              }`}
            >
              <span className={`font-mono text-[0.68rem] ${last ? "text-mint" : "text-slate"}`} aria-hidden>
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="min-w-0 break-words">
                <span className="block text-[0.86rem] leading-tight font-semibold">{s.step}</span>
                {s.detail && (
                  <span className={`mt-0.5 block font-mono text-[0.8125rem] leading-snug ${last ? "text-wash" : "text-graphite"}`}>
                    {s.detail}
                  </span>
                )}
              </span>
            </div>
            {!last && (
              <span aria-hidden className="flex justify-center py-1 text-field @xl:px-0.5 @xl:py-0">
                <ArrowDown size={14} strokeWidth={2} className="@xl:hidden" />
                <ArrowRight size={14} strokeWidth={2} className="hidden @xl:block" />
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/** The page's flowchart: a row of boxes on wide columns and in print, a column on narrow ones. */
function PageFlow({ steps }: { steps: Step[] }) {
  return (
    <ol className="xp-flow flex flex-col @2xl:flex-row @2xl:items-stretch print:flex-row print:items-stretch" aria-label="Methodology">
      {steps.map((s, i) => {
        const last = i === steps.length - 1;
        return (
          <li key={`${i}-${s.step}`} className="flex flex-col items-stretch @2xl:min-w-0 @2xl:flex-1 @2xl:flex-row @2xl:items-center print:min-w-0 print:flex-1 print:flex-row print:items-center">
            <div
              data-last={last || undefined}
              className="xp-flow-box min-w-0 px-3 py-3 @2xl:h-full @2xl:flex-1 print:h-full print:flex-1 print:px-2.5 print:py-2"
            >
              <span className="block text-[0.8125rem] leading-snug font-semibold break-words print:text-[0.85rem]">{s.step}</span>
              {s.detail && <span className="xp-flow-detail mt-1 block text-[0.8125rem] leading-snug">{s.detail}</span>}
            </div>
            {!last && (
              <span aria-hidden className="xp-flow-arrow flex justify-center py-1.5 @2xl:px-1.5 @2xl:py-0 print:px-1 print:py-0">
                <ArrowDown size={15} strokeWidth={2} className="@2xl:hidden print:hidden" />
                <ArrowRight size={15} strokeWidth={2} className="hidden @2xl:block print:block" />
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
