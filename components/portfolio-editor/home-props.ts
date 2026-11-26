import { editingPerson, personOf } from "@/app/(app)/portfolio/builder-state";
import type { PortfolioData } from "@/app/(app)/portfolio/load";
import type { BuilderProject, BuilderState } from "@/app/(app)/portfolio/steps";
import type { HomeProps } from "@/components/portfolio/PortfolioHome";
import { checkTiles } from "@/lib/portfolio-customise";
import type { HomeProject } from "@/lib/portfolio-home";
import { tileKindsShownBy } from "@/lib/portfolio-layout";
import { DEFAULT_THEME, themeById, type PortfolioTheme } from "@/lib/portfolio-themes";

/*
 * The page the editor draws, worked out from the edited state and what the loader gave: the props
 * `PortfolioHome` takes (decision 0031, "The adapter"). One place, so the editing page, the loading
 * stand-in, "See as a visitor" and a section lifted for a drag are all the same page. Pure, with no
 * React in it: the stand-in is in the gate's own chunk and draws from it on the server too.
 */

/** What `PortfolioHome` is given, but its adapter. */
export type Home = Pick<HomeProps, "person" | "projects" | "featuredId" | "sections" | "tiles"> & { theme: PortfolioTheme };

/** `order`, then any of `known` it does not hold yet (an exhbt made since the page was opened), as the server puts them on a save. */
function inOrder(order: readonly string[], known: readonly string[]): string[] {
  const has = new Set(known);
  return [...order.filter((id) => has.has(id)), ...known.filter((id) => !order.includes(id))];
}

/**
 * The exhbts the page arranges, in the order they are drawn: the person's order, then any the page
 * arranges that the order does not hold yet. Hidden ones keep their place in the order and are left out here.
 */
export function shownProjects(order: readonly string[], hidden: readonly string[], listed: readonly BuilderProject[]): HomeProject[] {
  const byId = new Map(listed.map((p) => [p.id, p.home]));
  const off = new Set(hidden);
  return inOrder(order, listed.map((p) => p.id))
    .filter((id) => !off.has(id))
    .map((id) => byId.get(id)!);
}

/** The look the page is drawn in: one being previewed, else the saved one. */
export const lookOf = (themeId: string, previewing: string | null): PortfolioTheme => themeById(previewing ?? themeId) ?? DEFAULT_THEME;

/** The editing page, from a state: every word as it is typed. */
export function editingHome(state: BuilderState, data: PortfolioData, previewing: string | null = null): Home {
  const a = state.arrangement;
  const b = data.builder;
  return {
    person: editingPerson(state.profile, b.username, b.photoUrl, a.header.linkedin),
    theme: lookOf(a.themeId, previewing),
    projects: shownProjects(a.order, a.hidden, b.projects),
    featuredId: a.featured,
    sections: a.sections,
    tiles: a.tiles,
  };
}

/**
 * The page as a visitor gets it (decision 0031, "See as a visitor"): the published copies only, in the
 * person's order and without the hidden ones; the words tidied as saving tidies them; the saved look,
 * never one being previewed. Drafts, exhbts over the plan's limit and held extras are not in it: the
 * loader's `visitor` holds only what a visitor's page lists, and the state's sections only what the plan has.
 */
export function visitorHome(state: BuilderState, data: PortfolioData): Home {
  const a = state.arrangement;
  const b = data.builder;
  const byId = new Map(data.visitor.published.map((p) => [p.id, p.home]));
  const off = new Set(a.hidden);
  const { clean } = checkTiles(a.tiles, tileKindsShownBy(a.sections));
  return {
    person: personOf(state.profile, b.username, b.photoUrl, a.header.linkedin),
    theme: lookOf(a.themeId, null),
    projects: inOrder(a.order, data.visitor.published.map((p) => p.id))
      .filter((id) => !off.has(id))
      .map((id) => byId.get(id)!),
    featuredId: a.featured && byId.has(a.featured) && !off.has(a.featured) ? a.featured : null,
    sections: a.sections,
    tiles: { ...a.tiles, ...clean },
  };
}
