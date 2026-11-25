"use client";

import type { FieldPath } from "@/components/portfolio/page-ctx";
import { useUi, type SheetName } from "../context";

/** The sheet an issue path lives in, when the page does not draw it: the card's summary and headline number, and the work. */
export function sheetOf(path: string): Extract<SheetName, "card" | "work"> | null {
  const head = path.split(".")[0];
  if (head === "summary" || head === "headline") return "card";
  if (head === "evidence") return "work";
  return null;
}

/** The field in a sheet that has the cursor when a jump lands there. */
const FIELD_OF = { card: "summary", work: "evidence-href" } as const;

/**
 * "Show me" from the publish sheet: close it, then either open the sheet the path lives in with the
 * cursor in its field, or jump on the page. The close goes first and finishes before anything opens,
 * because a closing dialog gives the focus back and says "closed".
 */
export function useShowMe(): (path: FieldPath) => void {
  const ui = useUi();
  return (path) => {
    ui.close();
    const sheet = sheetOf(path);
    setTimeout(() => {
      if (!sheet) return ui.jumpTo(path);
      ui.open(sheet);
      setTimeout(() => {
        const el = document.getElementById(FIELD_OF[sheet]) ?? document.getElementById("evidence-label");
        el?.focus();
      }, 50);
    }, 50);
  };
}
