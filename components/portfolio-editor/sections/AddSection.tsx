"use client";

import type { ReactNode } from "react";
import { DropdownMenu } from "@astryxdesign/core/DropdownMenu";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { EXTRA_SECTIONS, SECTION_HINTS, SECTION_KEYS, type SectionKey } from "@/lib/portfolio-layout";
import { usePortfolioApi, usePortfolioData, usePortfolioState } from "../runtime";
import { addSection, withSectionWords } from "./arrange";
import { sectionName, W } from "./words";

/*
 * "Add a section" (brief F, step 3): after the last section and out of the flow (over the last
 * section's bottom edge; in its own place at the end of the page when no section is left). An Astryx
 * DropdownMenu of the six, by their names, with what each holds; those already on the page dimmed and
 * said so; Experience and Quote, where the plan lacks them, dimmed with the plan's reason and the way to
 * upgrade under the list. Adding one puts it at the end with the cursor in its first field. It carries
 * `data-path="arrangement.sections"`, where the sections' own problem is shown and "Show me" lands.
 */

/** The first field of a section just added, where the cursor goes. */
const FIRST_FIELD: Partial<Record<SectionKey, string>> = {
  about: "arrangement.tiles.about.text",
  experience: "arrangement.tiles.experience.lines.0",
  quote: "arrangement.tiles.quote.text",
};

export function AddSection({ inFlow = false }: { inFlow?: boolean }): ReactNode {
  const api = usePortfolioApi();
  const sections = usePortfolioState((s) => s.arrangement.sections);
  const plan = usePortfolioData().builder.plan;
  const locked = (k: SectionKey) => EXTRA_SECTIONS.includes(k) && !plan.extraTiles;
  const anyLocked = SECTION_KEYS.some((k) => locked(k) && !sections.includes(k));
  const allOn = SECTION_KEYS.every((k) => sections.includes(k));

  const add = (key: SectionKey) => {
    // Its empty words first, with no Undo step, so Undo of the add keeps what is typed into it (arrange.ts).
    api.change((s) => withSectionWords(s, key));
    api.change((s) => addSection(s, key), W.added(sectionName(key)));
    api.say(W.saidAdded(sectionName(key)));
    const path = FIRST_FIELD[key];
    if (path) api.jumpTo(path);
    else requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-section-frame="${key}"] [data-pe-tools] button`)?.focus());
  };

  const items = SECTION_KEYS.map((k) => {
    const on = sections.includes(k);
    const lock = !on && locked(k);
    return {
      id: k,
      label: sectionName(k),
      description: on ? W.onPageAlready : lock ? (plan.extraTilesReason ?? "") : SECTION_HINTS[k],
      isDisabled: on || lock,
      onClick: () => add(k),
    };
  });

  return (
    <div className={inFlow ? "pe-add-section pe-add-section-flow" : "pe-add-section"} data-path="arrangement.sections" data-pe-add="section">
      <DropdownMenu
        items={items}
        menuWidth={320}
        menuMaxHeight={520}
        placement="below"
        alignment="center"
        hasChevron={false}
        footer={
          anyLocked ? (
            <div className="pe-menu-foot">
              <Button href="/pricing" size="sm">
                {W.seePlans}
              </Button>
            </div>
          ) : undefined
        }
        renderTrigger={(p) => (
          <Button {...(p as object)} size="sm" label={allOn ? W.addSectionAllOn : W.addSection}>
            <Plus aria-hidden size={16} strokeWidth={2.5} /> {W.addSection}
          </Button>
        )}
      />
    </div>
  );
}
