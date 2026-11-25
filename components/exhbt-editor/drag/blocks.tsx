"use client";

import { ChartBar, Flag, Image as ImageIcon, Lightbulb, Link2, ListChecks, Quote, Target, TextQuote, Workflow, type LucideIcon } from "lucide-react";
import { LIMITS, wordCount, type ExhbtDoc } from "@/lib/exhbt/blocks";
import { FORMAT_RULES, formatOf } from "@/lib/exhbt/formats";
import type { BlockKind, BlockOption } from "@/lib/exhbt/layouts";

/*
 * What the "+" menu and the tray both show for the blocks a layout can hold (decision 0026, "The
 * chrome"): each kind's icon, the words left, and the line for a layout that is full. The list itself
 * and its reasons are blockOptions' (lib/exhbt/layouts.ts).
 */

const ICONS: Record<BlockKind, LucideIcon> = {
  findings: ListChecks,
  graph: ChartBar,
  image: ImageIcon,
  quote: Quote,
  reflection: Lightbulb,
  link: Link2,
  aim: Target,
  conclusion: Flag,
  pullquote: TextQuote,
  flow: Workflow,
};

export function BlockIcon({ kind, size = 16 }: { kind: BlockKind; size?: number }) {
  const Icon = ICONS[kind] ?? ListChecks;
  return <Icon aria-hidden size={size} strokeWidth={2.25} className="xe-block-icon" />;
}

/** "120 words left of 200." or "12 words over the 200-word limit." */
export function wordsLeft(doc: ExhbtDoc): { text: string; over: boolean } {
  const cap = LIMITS.totalWords;
  const left = cap - wordCount(doc);
  if (left >= 0) return { text: `${left} ${left === 1 ? "word" : "words"} left of ${cap}.`, over: false };
  return { text: `${-left} ${left === -1 ? "word" : "words"} over the ${cap}-word limit. Trim something before you publish.`, over: true };
}

/** The one line above the list when every kind is full, or null when something fits. */
export function fullLine(doc: ExhbtDoc, options: BlockOption[]): string | null {
  if (!options.length || options.some((o) => !o.full)) return null;
  return `This ${FORMAT_RULES[formatOf(doc)].name.toLowerCase()} is full. Remove a section to add another, or try another layout.`;
}
