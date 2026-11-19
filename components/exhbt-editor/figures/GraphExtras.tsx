"use client";

import type { ReactNode } from "react";
import type { ExtraSlot } from "@/components/portfolio/page-ctx";
import { useRuntime } from "../context";

/** A graph's "Edit figures", over its corner, opening the chart sheet (decision 0026). J's: this is G's stub. */
export function GraphExtras(props: ExtraSlot): ReactNode {
  const { uiApi } = useRuntime();
  if (props.where !== "over") return null;
  return (
    <span className="xe-over" data-edit-only>
      <button type="button" className="xe-chip" onClick={() => uiApi.open("chart", props.sectionId)}>
        Edit figures
      </button>
    </span>
  );
}
