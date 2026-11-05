/**
 * Browser window frame, adapted from garden-skills web-design-engineer
 * (advanced-patterns.md#browser-window-frame) to Exhbt tokens. Used to show
 * what an employer actually opens, rather than a floating card.
 */
export function BrowserFrame({ url, children }: { url: string; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-[var(--radius)] border border-rule bg-surface shadow-pack">
      <div className="flex items-center gap-3 border-b border-rule bg-sky px-3.5 py-2.5">
        <div className="flex gap-1.5" aria-hidden>
          <span className="size-2.5 rounded-full bg-sky-2" />
          <span className="size-2.5 rounded-full bg-sky-2" />
          <span className="size-2.5 rounded-full bg-sky-2" />
        </div>
        <p className="flex-1 truncate rounded-[var(--radius-sm)] bg-surface px-3 py-1 font-mono text-xs text-ink-2">
          {url}
        </p>
      </div>
      {children}
    </div>
  );
}
