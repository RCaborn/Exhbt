import type { ChartOf } from "@/lib/exhbt/charts";

const looksNumeric = (s: string) => /^[-+−]?[£$€]?\s?\d[\d,]*(\.\d+)?\s?(%|[a-z]{1,4})?$/i.test(s.trim());

/**
 * A small table (up to 5 columns and 6 rows). It is already the data, so unlike the other kinds
 * it is a real table, read as one by screen readers, with no hidden copy. Figures are set right
 * in tabular numbers; the highlighted row sits on the wash tint.
 */
export function TableChart({ data }: { data: ChartOf<"table"> }) {
  const c = data;
  return (
    <figure className="m-0" data-chart>
      <div>
        <table className="w-full border-collapse text-[0.85rem] [overflow-wrap:anywhere]">
          <caption className="mb-3 text-left text-sm font-semibold text-ink">{c.title}</caption>
          <thead>
            <tr className="border-b border-ink">
              {c.columns.map((h, k) => (
                <th key={k} scope="col" className={`py-1.5 pr-3 align-bottom text-xs font-semibold text-graphite last:pr-0 ${k > 0 ? "text-right" : "text-left"}`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {c.rows.map((r, j) => (
              <tr key={j} className={`border-b border-line ${j === c.highlight ? "bg-wash font-semibold" : ""}`}>
                {c.columns.map((_, k) => {
                  const cell = r[k] ?? "";
                  const cls = `py-1.5 pr-3 last:pr-0 ${k > 0 && looksNumeric(cell) ? "text-right font-mono" : k > 0 ? "text-right" : "text-left"}`;
                  return k === 0 ? (
                    <th key={k} scope="row" className={`${cls} font-normal text-ink ${j === c.highlight ? "font-semibold" : ""}`}>
                      {cell}
                    </th>
                  ) : (
                    <td key={k} className={cls}>
                      {cell}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}
