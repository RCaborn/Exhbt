"use client";

import type { ReactNode } from "react";
import type { HomeOwnerPlace } from "@/components/portfolio/home-ctx";
import { lookOf } from "../home-props";
import { usePortfolioApi, usePortfolioData, usePortfolioState, usePortfolioUi } from "../runtime";
import { showTile } from "../sections/arrange";
import { AddSection } from "../sections/AddSection";
import { W } from "../sections/words";
import { useArranged } from "./arranged";
import { OwnerView } from "./OwnerView";

/*
 * What only the owner sees on the page (brief F, steps 6 to 9), live: the state it is drawn from, Show
 * in the hidden row, and "Add a section" when no section is left. What it draws is OwnerView.tsx's, which
 * the loading stand-in draws too (`OwnerPartsStill`), so the two take the same room.
 */
export function OwnerParts({ where }: { where: HomeOwnerPlace }): ReactNode {
  const api = usePortfolioApi();
  const { addRoom, ownerOnly, builder } = usePortfolioData();
  const themeId = usePortfolioState((s) => s.arrangement.themeId);
  const noSections = usePortfolioState((s) => s.arrangement.sections.length === 0);
  const previewing = usePortfolioUi((u) => u.previewing);
  const full = usePortfolioUi((u) => u.full);
  const arranged = useArranged();
  const look = lookOf(themeId, previewing);

  const show = (id: string) => {
    const title = arranged.title(id);
    api.change((s) => showTile(s, id), W.showed(title));
    api.say(W.saidShowed(title));
    requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-tile-frame="${CSS.escape(id)}"] [data-pe-tools] button, [data-hidden-row] button`)?.focus());
  };

  return (
    <OwnerView
      where={where}
      cta={look.treatment.cta}
      treatment={look.treatment.work}
      room={addRoom}
      isPublic={builder.plan.isPublic}
      full={full}
      ownerOnly={ownerOnly}
      workCount={arranged.work.length}
      hidden={arranged.hidden.map((id) => ({ id, title: arranged.title(id) }))}
      noSections={noSections}
      onShow={show}
      addSection={<AddSection inFlow />}
    />
  );
}
