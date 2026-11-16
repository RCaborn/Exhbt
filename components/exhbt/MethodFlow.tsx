import { ArrowDown, ArrowRight } from "lucide-react";

type Step = { step: string; detail?: string };

/**
 * The methodology as a pipeline: step boxes joined by arrows, the last step (the
 * result) filled navy as the endpoint. Lays out by the space it is given, not the
 * screen: a row when its container is at least 36rem wide, a vertical pipeline
 * otherwise (narrow cards, phones). Needs an ancestor with the `@container` class.
 * Semantically an ordered list, so screen readers hear "1 of 6, Collected data…".
 */
export function MethodFlow({ steps }: { steps: Step[] }) {
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
