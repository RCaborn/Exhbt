import type { Issue } from "@/lib/exhbt/blocks";

/** What stops a field being published, shown under it and announced when it changes. */
export function FieldIssues({ id, issues, onInk = false }: { id: string; issues: Issue[]; onInk?: boolean }) {
  return (
    <div id={id} aria-live="polite">
      {issues.map((i, k) => (
        <p key={k} className={`mt-1 text-sm ${onInk ? "font-semibold text-white" : "text-error"}`}>
          {i.message}
        </p>
      ))}
    </div>
  );
}
