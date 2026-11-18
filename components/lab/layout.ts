import { runsOf } from "@/components/portfolio/ProjectView";
import type { Section } from "@/lib/exhbt/blocks";
import { FLOW_ID } from "./samples";

/**
 * How the lab lays out the main column: the items in the doc's own order, in rows. The pairing is
 * the case study's (runsOf in components/portfolio/ProjectView.tsx): findings beside a graph or
 * image that is their neighbour, graphs next to each other two to a row, images next to each
 * other two to a row, and a run of three or more images in a simple grid. The flowchart is a row
 * of its own and never pairs.
 *
 * One difference from the page today, on purpose: a pair is drawn in the doc's order. The page
 * always puts the findings on the left, even when the figure comes first, which would make a
 * section change sides when it is dropped (docs/briefs/edit-on-page/drag-prototype.md).
 */
export type Row =
  | { type: "one"; ids: [string] }
  /** Findings and a figure sharing a row. */
  | { type: "found"; ids: [string, string]; figureFirst: boolean }
  /** Two graphs, or two images, sharing a row. */
  | { type: "two"; ids: string[]; of: "graph" | "image" }
  /** Three or more images. */
  | { type: "grid"; ids: string[] };

export function rowsOf(order: string[], sections: Record<string, Section>): Row[] {
  const rows: Row[] = [];
  let run: Section[] = [];
  const flush = () => {
    for (const r of runsOf(run)) {
      if (r.kind === "found") {
        const figureFirst = run.indexOf(r.figure) < run.indexOf(r.findings);
        rows.push({ type: "found", ids: figureFirst ? [r.figure.id, r.findings.id] : [r.findings.id, r.figure.id], figureFirst });
      } else if (r.kind === "graphs" || r.kind === "images") {
        const ids = r.items.map((s) => s.id);
        if (ids.length === 1) rows.push({ type: "one", ids: [ids[0]!] });
        else if (r.kind === "images" && ids.length > 2) rows.push({ type: "grid", ids });
        else rows.push({ type: "two", ids, of: r.kind === "graphs" ? "graph" : "image" });
      } else rows.push({ type: "one", ids: [r.section.id] });
    }
    run = [];
  };
  for (const id of order) {
    if (id === FLOW_ID) {
      flush();
      rows.push({ type: "one", ids: [FLOW_ID] });
    } else if (sections[id]) run.push(sections[id]!);
  }
  flush();
  return rows;
}

/**
 * A row's classes. The spacing is the page's: each row is an `xp-section` (2.75rem above), and the
 * first row sits 2rem under the context line, as the flowchart does on the page. Shared by the
 * rows the lab draws and the hidden copy it measures while a section is dragged, so the two can't
 * lay out differently.
 */
export function rowClass(row: Row): string {
  const base = "lab-row xp-section relative first:mt-8";
  switch (row.type) {
    case "one":
      return base;
    case "found":
      return `${base} grid items-center gap-8 @2xl/main:gap-9 ${row.figureFirst ? "@2xl/main:grid-cols-[minmax(0,1fr)_minmax(0,0.92fr)]" : "@2xl/main:grid-cols-[minmax(0,0.92fr)_minmax(0,1fr)]"}`;
    case "two":
      return `${base} grid gap-6 @2xl/main:grid-cols-2`;
    case "grid":
      // Every picture in the same 4:3 box, uncropped, so the tiles are one size.
      return `${base} lab-grid grid grid-cols-2 gap-x-4 gap-y-6 @2xl/main:grid-cols-3 @2xl/main:gap-6 [&_img]:aspect-[4/3] [&_img]:object-contain`;
  }
}

/** The order with a section moved to `place`: its index in the order with the section itself taken out. */
export function orderWith(order: string[], id: string, place: number): string[] {
  const rest = order.filter((x) => x !== id);
  const to = Math.max(0, Math.min(rest.length, place));
  return [...rest.slice(0, to), id, ...rest.slice(to)];
}
