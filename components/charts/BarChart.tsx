import type { ReactNode } from "react";
import { chartSummary, displayed, protectNote, valueFormatter, type ChartOf } from "@/lib/exhbt/charts";
import { ChartFrame } from "./ChartFrame";
import { scaleFor, tickLabel, type Scale } from "./scale";
import { CHART_STRONG, MUTED_BAR, seriesColour } from "./series";

/**
 * Bars and grouped bars, drawn across the page: a label per row, bars from one zero line, and
 * every value printed at its bar's end in text ink (never the bar's colour). HTML rather than
 * SVG, so labels stay crisp and wrap on phones and the rows reflow in the exhbt's container.
 * Bars are at most 16px thick with a 4px rounded end, square at the zero line.
 */

export function BarChart({ data }: { data: ChartOf<"bar"> }) {
  const c = displayed(data) as ChartOf<"bar">;
  const f = valueFormatter(c);
  const s = scaleFor(c.rows.map((r) => r.value), { zero: true });
  const hi = c.highlight !== undefined && c.highlight >= 0 && c.highlight < c.rows.length ? c.highlight : undefined;
  return (
    <ChartFrame
      title={c.title}
      summary={chartSummary(data)}
      notes={[c.lowerIsBetter ? "Lower is better." : null, protectNote(data)]}
      table={{ head: [c.xTitle || "Bar", c.yTitle || "Value"], rows: c.rows.map((r) => [r.label, f(r.value)]) }}
    >
      <Rows xTitle={c.xTitle} scale={s}>
        {c.rows.map((r, j) => (
          <Row key={j} label={r.label}>
            <Track scale={s}>
              <Bar scale={s} value={r.value} colour={hi === undefined || hi === j ? CHART_STRONG : MUTED_BAR} thick />
              <ValueLabel scale={s} value={r.value} text={f(r.value)} strong={hi === j} />
            </Track>
          </Row>
        ))}
      </Rows>
      <Axis scale={s} title={c.yTitle} unit={c.unit} />
    </ChartFrame>
  );
}

export function GroupedBarChart({ data }: { data: ChartOf<"groupedBar"> }) {
  const c = displayed(data) as ChartOf<"groupedBar">;
  const f = valueFormatter(c);
  const n = c.series.length;
  const s = scaleFor(c.rows.flatMap((r) => r.values), { zero: true });
  const name = (k: number) => c.series[k]?.trim() || `Series ${k + 1}`;
  return (
    <ChartFrame
      title={c.title}
      summary={chartSummary(data)}
      legend={c.series.map((_, k) => ({ label: name(k), colour: seriesColour(k, n, c.highlight) }))}
      notes={[c.lowerIsBetter ? "Lower is better." : null, protectNote(data)]}
      table={{ head: [c.xTitle || "Group", ...c.series.map((_, k) => name(k))], rows: c.rows.map((r) => [r.label, ...c.series.map((_, k) => f(r.values[k] ?? 0))]) }}
    >
      <Rows xTitle={c.xTitle} scale={s}>
        {c.rows.map((r, j) => (
          <Row key={j} label={r.label}>
            <div className="space-y-[2px]">
              {c.series.map((_, k) => (
                <Track key={k} scale={s} slim>
                  <Bar scale={s} value={r.values[k] ?? 0} colour={seriesColour(k, n, c.highlight)} />
                  <ValueLabel scale={s} value={r.values[k] ?? 0} text={f(r.values[k] ?? 0)} strong={k === (c.highlight ?? 0)} />
                </Track>
              ))}
            </div>
          </Row>
        ))}
      </Rows>
      <Axis scale={s} title={c.yTitle} unit={c.unit} />
    </ChartFrame>
  );
}

/* ---------------- Shared by the bar kinds ---------------- */

/** Label column beside the bars from 28rem wide; above them when narrower. */
const COLUMNS = "grid grid-cols-1 @md:grid-cols-[9rem_minmax(0,1fr)] @md:gap-x-3";

/**
 * The rows, with the categories' name (if any) over them. When labels sit beside the bars,
 * hairline gridlines run through every row at the axis ticks; when labels sit above, only each
 * bar's zero line is drawn, so no line crosses a label.
 */
export function Rows({ xTitle, scale, children }: { xTitle?: string; scale: Scale; children: ReactNode }) {
  return (
    <div>
      {xTitle && <p className="mb-2 text-xs font-semibold text-graphite">{xTitle}</p>}
      <div className="relative">
        <div aria-hidden className="pointer-events-none absolute inset-0 hidden @md:grid @md:grid-cols-[9rem_minmax(0,1fr)] @md:gap-x-3">
          <span />
          <div className={`relative ${margins(scale)}`}>
            {scale.ticks.map((t) => (
              <span key={t} className={`absolute inset-y-0 w-px ${t === 0 ? "bg-graphite" : "bg-line"}`} style={{ left: `${scale.at(t)}%` }} />
            ))}
          </div>
        </div>
        <div className="relative space-y-2.5">{children}</div>
      </div>
    </div>
  );
}

/** A label and its bars. */
export function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={`${COLUMNS} gap-y-1 @md:items-center`}>
      <span className="text-[0.85rem] leading-tight break-words text-graphite">{label}</span>
      {children}
    </div>
  );
}

/** Room either side of the bars for the printed values, so they never sit on top of a bar. */
const margins = (s: Scale) => `mr-16 ${s.lo < 0 ? "ml-16" : ""}`;

/** One bar's lane, with its zero line. */
export function Track({ scale, slim = false, children }: { scale: Scale; slim?: boolean; children: ReactNode }) {
  return (
    <div className={`relative ${slim ? "h-3" : "h-5"} ${margins(scale)}`}>
      <span aria-hidden className="absolute inset-y-0 w-px bg-graphite" style={{ left: `${scale.at(0)}%` }} />
      {children}
    </div>
  );
}

/** A bar from the zero line to the value: 4px rounded at its end, square at zero. */
export function Bar({ scale, value, colour, thick = false }: { scale: Scale; value: number; colour: string; thick?: boolean }) {
  const z = scale.at(0);
  const v = scale.at(value);
  const left = Math.min(z, v);
  return (
    <span
      className={`absolute top-1/2 -translate-y-1/2 ${thick ? "h-4" : "h-3"} ${value < 0 ? "rounded-l-[4px]" : "rounded-r-[4px]"}`}
      style={{ left: `${left}%`, width: `${Math.abs(v - z)}%`, background: colour, minWidth: value === 0 ? 0 : 2 }}
    />
  );
}

/** The value, printed just past the bar's end. */
export function ValueLabel({ scale, value, text, strong = false }: { scale: Scale; value: number; text: string; strong?: boolean }) {
  const at = scale.at(value);
  return (
    <span
      className={`absolute top-1/2 -translate-y-1/2 font-mono text-[0.72rem] whitespace-nowrap text-ink ${strong ? "font-semibold" : ""}`}
      style={value < 0 ? { right: `calc(${100 - at}% + 5px)` } : { left: `calc(${at}% + 5px)` }}
    >
      {text}
    </span>
  );
}

/** Tick labels under the bars, from the same scale, with the values' name below. */
export function Axis({ scale, title, unit }: { scale: Scale; title?: string; unit?: string }) {
  return (
    <div className={`mt-1.5 ${COLUMNS}`} aria-hidden>
      <span className="hidden @md:block" />
      <div>
        <div className={`relative h-4 ${margins(scale)}`}>
          {scale.ticks.map((t, i) => (
            <span
              key={t}
              className={`absolute top-0 font-mono text-[0.68rem] text-slate ${i === 0 ? "" : i === scale.ticks.length - 1 ? "-translate-x-full" : "-translate-x-1/2"}`}
              style={{ left: `${scale.at(t)}%` }}
            >
              {tickLabel(t, scale, unit)}
            </span>
          ))}
        </div>
        {title && <p className={`mt-0.5 text-center text-xs text-graphite ${margins(scale)}`}>{title}</p>}
      </div>
    </div>
  );
}

