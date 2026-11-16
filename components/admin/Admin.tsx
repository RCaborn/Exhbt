import type { ReactNode } from "react";
import { ChartFrame } from "@/components/charts/ChartFrame";
import { SERIES_DARK } from "@/components/charts/series";

/**
 * Small building blocks for the admin panel (decision 0021). White panels on mist, dense and calm
 * (DESIGN.md, "Operate"). The one chart is a column-per-day graph in the brand's one hue, with
 * the figures printed and the same figures in a hidden table.
 */

const nf = new Intl.NumberFormat("en-GB");
export const num = (n: number) => nf.format(Math.round(n));
export const usd = (n: number) => `$${n.toFixed(n < 10 ? 4 : 2)}`;
export const bytes = (n: number) => (n < 1024 ? `${n} B` : n < 1024 ** 2 ? `${(n / 1024).toFixed(1)} KB` : n < 1024 ** 3 ? `${(n / 1024 ** 2).toFixed(1)} MB` : `${(n / 1024 ** 3).toFixed(2)} GB`);
/** "2026-11-16 14:03" (UTC), or a dash. */
export const when = (iso: string | null | undefined) => (iso ? iso.slice(0, 16).replace("T", " ") : "-");
export const pct = (part: number, whole: number) => (whole > 0 ? `${Math.round((part / whole) * 100)}%` : "-");

export function Panel({ id, title, note, children, wide }: { id: string; title: string; note?: string; children: ReactNode; wide?: boolean }) {
  return (
    <section aria-labelledby={id} className={`rounded-[16px] border border-line bg-surface p-5 ${wide ? "lg:col-span-2" : ""}`}>
      <h2 id={id} className="text-[1.125rem]">
        {title}
      </h2>
      {note && <p className="mt-1 text-[0.85rem] text-graphite">{note}</p>}
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

export function Unavailable({ note }: { note: string }) {
  return <p className="text-[0.9rem] text-graphite">{note}</p>;
}

/** Figures in a row. `id` goes on the value as data-stat so tests can read it. */
export function Stats({ items }: { items: { id?: string; label: string; value: string; hint?: string }[] }) {
  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {items.map((s) => (
        <div key={s.label} className="flex flex-col-reverse justify-end rounded-[12px] border border-line px-3 py-2.5">
          <dt className="mt-1.5 text-[0.85rem] leading-snug text-graphite">
            {s.label}
            {s.hint && <span className="block text-[0.75rem] text-slate">{s.hint}</span>}
          </dt>
          <dd data-stat={s.id} className="font-[family-name:var(--font-display)] text-[1.5rem] leading-none font-semibold tracking-[-0.02em] text-ink tabular-nums">
            {s.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** A table you can read. Numbers are right-aligned and tabular. */
export function DataTable({
  caption,
  head,
  rows,
  numeric = [],
  empty = "Nothing yet.",
}: {
  caption: string;
  head: string[];
  rows: ReactNode[][];
  numeric?: number[];
  empty?: string;
}) {
  if (rows.length === 0) return <p className="text-[0.9rem] text-graphite">{empty}</p>;
  return (
    <div className="overflow-x-auto" tabIndex={0} role="region" aria-label={caption}>
      <table className="w-full min-w-[28rem] border-collapse text-left text-[0.88rem]">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {head.map((h, i) => (
              <th key={h} scope="col" className={`border-b border-line px-2 py-1.5 text-[0.78rem] font-semibold text-graphite ${numeric.includes(i) ? "text-right" : ""}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, j) => (
            <tr key={j} className="border-b border-line last:border-0">
              {r.map((cell, k) => (
                <td key={k} className={`px-2 py-1.5 align-top text-ink ${numeric.includes(k) ? "text-right font-mono text-[0.82rem] tabular-nums" : "break-words"}`}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * One column per day, in the brand hue. Up to 14 days every value is printed above its column;
 * beyond that the peak is printed and every figure is in the hidden table.
 */
export function DayColumns({ title, data, format = num }: { title: string; data: { day: string; n: number }[]; format?: (n: number) => string }) {
  const max = Math.max(0, ...data.map((d) => d.n));
  const total = data.reduce((n, d) => n + d.n, 0);
  const peak = data.find((d) => d.n === max);
  const every = data.length <= 14;
  return (
    <ChartFrame
      title={title}
      summary={`${title}: ${format(total)} in ${data.length} days${peak && max > 0 ? `, most on ${peak.day} (${format(max)})` : ""}.`}
      notes={[max > 0 && !every && peak ? `Most in a day: ${format(max)} on ${peak.day}.` : null]}
      table={{ head: ["Day", title], rows: data.map((d) => [d.day, format(d.n)]) }}
    >
      <div className="flex h-28 items-end gap-[2px] border-b border-graphite" aria-hidden>
        {data.map((d) => (
          <div key={d.day} className="relative flex h-full min-w-0 flex-1 items-end justify-center">
            {every && d.n > 0 && <span className="absolute -top-0.5 -translate-y-full font-mono text-[0.68rem] text-ink">{format(d.n)}</span>}
            <span className="block w-full rounded-t-[3px]" style={{ height: max > 0 ? `${Math.max(d.n > 0 ? 3 : 0, (d.n / max) * 88)}%` : 0, background: SERIES_DARK }} />
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between font-mono text-[0.68rem] text-slate" aria-hidden>
        <span>{data[0]?.day}</span>
        <span>{data[data.length - 1]?.day}</span>
      </div>
    </ChartFrame>
  );
}
