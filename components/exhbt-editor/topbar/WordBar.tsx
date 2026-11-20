"use client";

import type { ReactNode } from "react";
import { formatLimits, wordCount } from "@/lib/exhbt/blocks";
import { formatOf } from "@/lib/exhbt/formats";
import { useDoc } from "../store";

/**
 * The total towards the target and the limit, ported from the classic editor's WordBar. It carries
 * `data-path=""` and tabIndex -1: the word total's issue has the path "", and "Things to fix" jumps here.
 */
export function WordBar(): ReactNode {
  const total = useDoc(wordCount);
  const f = useDoc(formatOf);
  const { targetWords, totalWords } = formatLimits(f);
  const over = total > totalWords;
  const pct = Math.min(100, (total / totalWords) * 100);
  return (
    <div className="xe-wordbar" data-word-bar data-over={over || undefined} data-path="" tabIndex={-1}>
      <span className="xe-wordbar-text font-mono">
        <span className={over ? "font-semibold text-error" : "text-ink"}>{total}</span> words<span className="xe-wordbar-limits"> · aim for {targetWords}, at most {totalWords}</span>
      </span>
      <span aria-hidden className="xe-wordbar-bar">
        <span className={`absolute inset-y-0 left-0 rounded-full ${over ? "bg-error" : total > targetWords ? "bg-ink" : "bg-jade"}`} style={{ width: `${pct}%` }} />
        <span className="absolute inset-y-0 w-0.5 bg-surface" style={{ left: `${(targetWords / totalWords) * 100}%` }} />
      </span>
    </div>
  );
}
