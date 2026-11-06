import { ArrowDown, ArrowRight } from "lucide-react";

type Step = { step: string; detail?: string };

/**
 * The methodology as a pipeline: step boxes joined by arrows, the last step (the
 * result) filled navy as the endpoint. Lays out by the space it is given, not the
 * screen: a row when its container is at least 42rem wide, a vertical pipeline
 * otherwise (narrow cards, phones). Needs an ancestor with the `@container` class.
 * Semantically an ordered list, so screen readers hear "1 of 6, Collected data…".
 */
export function MethodFlow({ steps }: { steps: Step[] }) {
  return (
    <ol className="flex flex-col gap-0 @2xl:flex-row @2xl:items-stretch" aria-label="Methodology">
      {steps.map((s, i) => {
        const last = i === steps.length - 1;
        return (
          <li key={`${i}-${s.step}`} className="flex flex-col items-stretch @2xl:flex-1 @2xl:flex-row @2xl:items-center">
            <div
              className={`flex items-baseline gap-3 rounded-[8px] border px-3 py-2.5 @2xl:h-full @2xl:flex-1 @2xl:flex-col @2xl:items-start @2xl:gap-1 ${
                last ? "border-ink bg-ink text-white" : "border-rule bg-surface"
              }`}
            >
              <span className={`font-mono text-[0.68rem] ${last ? "text-blue" : "text-quiet"}`} aria-hidden>
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="min-w-0">
                <span className="block text-[0.86rem] leading-tight font-semibold">{s.step}</span>
                {s.detail && (
                  <span className={`mt-0.5 block font-mono text-[0.72rem] leading-snug ${last ? "text-sky-2" : "text-ink-2"}`}>
                    {s.detail}
                  </span>
                )}
              </span>
            </div>
            {!last && (
              <span aria-hidden className="flex justify-center py-1 text-field @2xl:px-1 @2xl:py-0">
                <ArrowDown size={14} strokeWidth={2} className="@2xl:hidden" />
                <ArrowRight size={14} strokeWidth={2} className="hidden @2xl:block" />
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
