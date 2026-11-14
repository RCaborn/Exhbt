import type { ReactNode } from "react";
import type { Marker } from "./series";

export type LegendItem = { label: string; colour: string; marker?: Marker; dash?: string };
export type DataTable = { head: string[]; rows: string[][] };

/**
 * What every graph shares: the title and legend above, the drawing as one image with a short
 * summary for screen readers, any notes under it, and a visually hidden table with every
 * figure. The legend is hidden from screen readers because the table names the series.
 */
export function ChartFrame({
  title,
  legend = [],
  summary,
  notes = [],
  table,
  children,
}: {
  title: string;
  legend?: LegendItem[];
  summary: string;
  notes?: (string | null | undefined)[];
  table: DataTable;
  children: ReactNode;
}) {
  const shown = notes.filter((n): n is string => Boolean(n));
  return (
    <figure className="m-0" data-chart>
      <figcaption className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className="text-sm font-semibold text-ink">{title}</span>
        {legend.length > 1 && (
          <span className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-graphite" aria-hidden>
            {legend.map((l, i) => (
              <span key={i} className="inline-flex items-center gap-1.5">
                <Key item={l} />
                {l.label}
              </span>
            ))}
          </span>
        )}
      </figcaption>
      <div role="img" aria-label={summary} className="@container mt-3">
        {children}
      </div>
      {shown.length > 0 && (
        <div className="mt-2 space-y-0.5 text-xs text-graphite">
          {shown.map((n) => (
            <p key={n}>{n}</p>
          ))}
        </div>
      )}
      {/* The wrapper clips the table: a table ignores sr-only's 1px width and would widen the page. */}
      <div className="sr-only">
        <table>
          <caption>{title}</caption>
          <thead>
            <tr>
              {table.head.map((h, i) => (
                <th key={i} scope="col">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((r, j) => (
              <tr key={j}>
                {r.map((cell, k) =>
                  k === 0 ? (
                    <th key={k} scope="row">
                      {cell}
                    </th>
                  ) : (
                    <td key={k}>{cell}</td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}

/** A legend key: a line sample with its marker for line graphs, a swatch otherwise. */
function Key({ item }: { item: LegendItem }) {
  if (item.marker) {
    return (
      <svg aria-hidden width="22" height="10" viewBox="0 0 22 10" className="shrink-0 overflow-visible">
        <line x1="1" x2="21" y1="5" y2="5" stroke={item.colour} strokeWidth="2" strokeDasharray={item.dash || undefined} strokeLinecap="round" />
        <MarkerShape marker={item.marker} colour={item.colour} cx={11} cy={5} r={3.5} />
      </svg>
    );
  }
  return <span className="inline-block size-2.5 shrink-0 rounded-[2px]" style={{ background: item.colour }} />;
}

/** A point marker: circle, square, triangle or diamond, so lines differ by shape as well as shade. */
export function MarkerShape({ marker, colour, cx, cy, r }: { marker: Marker; colour: string; cx: number; cy: number; r: number }) {
  const ring = { stroke: "var(--color-surface)", strokeWidth: 1.5 };
  switch (marker) {
    case "circle":
      return <circle cx={cx} cy={cy} r={r} fill={colour} {...ring} />;
    case "square":
      return <rect x={cx - r * 0.9} y={cy - r * 0.9} width={r * 1.8} height={r * 1.8} fill={colour} {...ring} />;
    case "triangle":
      return <polygon points={`${cx},${cy - r * 1.1} ${cx + r * 1.05},${cy + r * 0.8} ${cx - r * 1.05},${cy + r * 0.8}`} fill={colour} {...ring} />;
    case "diamond":
      return <polygon points={`${cx},${cy - r * 1.2} ${cx + r * 1.2},${cy} ${cx},${cy + r * 1.2} ${cx - r * 1.2},${cy}`} fill={colour} {...ring} />;
  }
}
