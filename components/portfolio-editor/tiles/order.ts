import type { BuilderProject, BuilderState } from "@/app/(app)/portfolio/steps";
import { shownProjects } from "../home-props";
import { fullOrder } from "../sections/arrange";

/*
 * Which exhbts the page draws where, as PortfolioHome works it out (`featuredOf`, `workProjects`). Pure,
 * with no React in it, so the loading stand-in (on the server too) and the editor's own hook
 * (arranged.ts, `useArranged`) work it out the same way.
 */

export type Arranged = {
  /** Every exhbt the page arranges, in the order drawn, hidden ones left out. */
  shown: string[];
  /** The band's exhbt, when the band is on the page and there is one. */
  band: string | null;
  /** The ones More of my work lists, in order (without the band's). */
  work: string[];
  /** Every arranged exhbt the page knows, hidden ones too, in the order drawn. */
  known: string[];
  /** The hidden ones the page knows, in their order. */
  hidden: string[];
  title(id: string): string;
  /** Whether it is live: on Free none is, as Free cannot publish. */
  live(id: string): boolean;
};

export function arrangedOf(a: Pick<BuilderState["arrangement"], "order" | "hidden" | "featured" | "sections">, projects: readonly BuilderProject[], isPublic: boolean): Arranged {
  const byId = new Map(projects.map((p) => [p.id, p]));
  const shown = shownProjects(a.order, a.hidden, projects).map((p) => p.id);
  const first = shown.find((id) => id === a.featured) ?? shown[0] ?? null;
  const band = a.sections.includes("featured") ? first : null;
  const known = fullOrder(a.order, projects.map((p) => p.id));
  return {
    shown,
    band,
    work: band ? shown.filter((id) => id !== band) : shown,
    known,
    hidden: known.filter((id) => a.hidden.includes(id)),
    title: (id) => byId.get(id)?.title.trim() || "Untitled exhbt",
    live: (id) => isPublic && Boolean(byId.get(id)?.live),
  };
}
