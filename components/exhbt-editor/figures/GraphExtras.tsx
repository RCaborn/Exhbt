"use client";

import "../css/figures.css";
import type { ReactNode } from "react";
import { SlidersHorizontal } from "lucide-react";
import type { ExtraSlot } from "@/components/portfolio/page-ctx";
import { chartValues, hasData, type Chart } from "@/lib/exhbt/charts";
import { useRuntime } from "../context";
import { labelOf } from "../labels";
import { useDoc } from "../store";

/** A graph with no figures in it yet: a new graph (one row of noughts), or one whose every value is still 0. A table, when no cell has words. */
export function noNumbersYet(c: Chart): boolean {
  if (!hasData(c)) return true;
  if (c.kind === "table") return c.rows.every((r) => r.every((cell) => !cell.trim()));
  return chartValues(c).every((v) => v === 0);
}

/**
 * A graph's edit-only parts (decision 0026, "What the page does not draw"): "Edit figures" over the
 * graph's bottom corner, named for the graph ("Edit figures: Graph 1"), and the graph itself, which
 * opens the same sheet when it is clicked. The chip sits on the card's bottom edge, half in the card's
 * own padding, so it never covers the graph's title or its figures, nor the section's toolbar over the
 * top corner. A graph with no numbers yet shows "Add your numbers" over it instead of an empty axis.
 * All of it is drawn over the card and takes no room.
 */
export function GraphExtras(props: ExtraSlot): ReactNode {
  if (props.where !== "over") return null;
  return <GraphOver sectionId={props.sectionId} />;
}

function GraphOver({ sectionId }: { sectionId: string }) {
  const { uiApi } = useRuntime();
  const label = useDoc((d) => labelOf(d, sectionId));
  const empty = useDoc((d) => {
    const s = d.sections.find((x) => x.id === sectionId);
    return s?.kind === "graph" && noNumbersYet(s.chart);
  });
  const open = () => uiApi.open("chart", sectionId);
  return (
    // A press anywhere on the graph opens its figures; the button is the way in from the keyboard.
    <span className="xe-fig-graph" data-edit-only data-empty={empty ? "" : undefined} onClick={open}>
      {empty && (
        <span className="xe-fig-empty" aria-hidden>
          Add your numbers
        </span>
      )}
      <button type="button" className="xe-fig-chip xe-fig-corner" aria-label={`Edit figures: ${label}`}>
        <SlidersHorizontal aria-hidden size={13} strokeWidth={2.25} />
        Edit figures
      </button>
    </span>
  );
}
