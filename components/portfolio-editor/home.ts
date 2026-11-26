"use client";

import { useMemo } from "react";
import { editingPerson } from "@/app/(app)/portfolio/builder-state";
import { lookOf, shownProjects, type Home } from "./home-props";
import { usePortfolioData, usePortfolioState, usePortfolioUi } from "./runtime";

export type { Home } from "./home-props";

/**
 * The editing page as the canvas draws it now (home-props.ts, `editingHome`), read from the editor's
 * state. Each part keeps its identity while what it is made from has not changed, so a memoised part of
 * the page (a card, a section nobody typed in) is not drawn again. For whoever has to draw the page, or
 * one section of it, a second time: a section lifted for a drag.
 */
export function useEditingHome(): Home {
  const profile = usePortfolioState((s) => s.profile);
  const a = usePortfolioState((s) => s.arrangement);
  const previewing = usePortfolioUi((u) => u.previewing);
  const { username, photoUrl, projects: listed } = usePortfolioData().builder;
  const person = useMemo(() => editingPerson(profile, username, photoUrl, a.header.linkedin), [profile, username, photoUrl, a.header.linkedin]);
  const projects = useMemo(() => shownProjects(a.order, a.hidden, listed), [a.order, a.hidden, listed]);
  const theme = lookOf(a.themeId, previewing);
  return useMemo(() => ({ person, theme, projects, featuredId: a.featured, sections: a.sections, tiles: a.tiles }), [person, theme, projects, a.featured, a.sections, a.tiles]);
}
