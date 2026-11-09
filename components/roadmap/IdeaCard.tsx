import type { Project } from "@/lib/ai/schemas";

/** One project idea: title, length, brief, what you end up with, and the gaps it closes. */
export function IdeaCard({ idea, control }: { idea: Project; control?: React.ReactNode }) {
  return (
    <div className="rounded-[16px] border border-rule p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="text-[1.35rem]">{idea.title}</h2>
        <div className="flex items-center gap-3">
          <span className="chip font-mono">
            {idea.weeks} {idea.weeks === 1 ? "week" : "weeks"}
          </span>
          {control}
        </div>
      </div>
      <p className="mt-2 text-ink-2">{idea.brief}</p>
      <dl className="mt-4 grid gap-3 text-[0.95rem] sm:grid-cols-2">
        <div>
          <dt className="text-sm text-ink-2">You end up with</dt>
          <dd className="font-medium">{idea.deliverable}</dd>
        </div>
        {idea.closesGaps.length > 0 && (
          <div>
            <dt className="text-sm text-ink-2">Closes</dt>
            <dd className="font-medium">{idea.closesGaps.join(", ")}</dd>
          </div>
        )}
      </dl>
    </div>
  );
}
