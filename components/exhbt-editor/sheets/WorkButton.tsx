"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { useRuntime } from "../context";
import { workWords } from "../geometry";
import { useDoc } from "../store";

/**
 * The sidebar's control for the work (`edit.work()`), drawn as "See the work" is, or "Add the work"
 * (a placeholder) when there is none. It opens the work sheet; it never goes to the work. I's: this is
 *
 */
export function WorkButton(): ReactNode {
  const label = useDoc((d) => d.evidence?.label);
  const has = useDoc((d) => Boolean(d.evidence));
  const { uiApi } = useRuntime();
  const words = workWords(has ? (label ?? "") : undefined);
  return (
    <div data-path="evidence" data-edit-only={has ? undefined : "placeholder"}>
      <Button variant="primary" size="md" className="xp-work-button w-full" label={words} onClick={() => uiApi.open("work")}>
        <span className="min-w-0">{words}</span>
      </Button>
    </div>
  );
}
