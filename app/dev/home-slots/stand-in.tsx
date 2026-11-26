import type { HomeProps } from "@/components/portfolio/PortfolioHome";
import type { HomeEdit } from "@/components/portfolio/home-ctx";
import { SECTION_KEYS } from "@/lib/portfolio-layout";

/*
 * The portfolio slot harness's own parts (app/dev/home-slots, development only): the variants of a
 * seeded page it draws, and a stand-in for the portfolio editor's adapter. The stand-in marks each
 * slot and adds no box of its own, so e2e/home-slots.spec.ts can find every slot and compare the
 * page's boxes with and without it. Nothing here is the editor: it never types, saves or moves anything.
 *
 * What it draws, slot by slot:
 *  - text: the words in a <span data-slot="text" data-path data-label data-as data-part> with
 *    `display: contents`; an empty field shows its placeholder in --xp-muted and carries data-empty;
 *  - paras: a `display: contents` <div data-slot="paras"> holding one <p> with the slot's classes per
 *    paragraph of the stored text (paragraphs split at a blank line), or one with the placeholder;
 *  - photo, section and tile: the page's own node inside a marked `display: contents` element;
 *  - lineTools, owner and tools: marked, empty elements that take no room (`hidden`). The end of the
 *    work sits inside the work's list, so it is an <li> there.
 */

/** The ways a seeded page is drawn (`?case=`). */
export const CASES = {
  /** As seeded. */
  full: (p: HomeProps) => p,
  /** No exhbt yet: the band is the vision. */
  none: (p: HomeProps) => ({ ...p, projects: [], featuredId: null }),
  /** One exhbt, in the band: More of my work has no card. */
  one: (p: HomeProps) => ({ ...p, projects: p.projects.slice(0, 1), featuredId: null }),
  /** More of my work off the page: the owner's parts come after the last section. */
  "no-work": (p: HomeProps) => ({ ...p, sections: p.sections.filter((k) => k !== "work") }),
  /** All six sections with no words in any of them, and no links: every word section drawn whole. */
  empty: (p: HomeProps) => ({ ...p, sections: [...SECTION_KEYS], tiles: {}, person: { ...p.person, links: {} } }),
} satisfies Record<string, (p: HomeProps) => HomeProps>;
export type CaseName = keyof typeof CASES;
export const isCase = (v: unknown): v is CaseName => typeof v === "string" && v in CASES;

const muted = { color: "var(--xp-muted)" } as const;
const contents = { display: "contents" } as const;

/** The stand-in adapter: what the page draws without one, each slot marked. */
export function standIn(): HomeEdit {
  return {
    text: (s) => (
      <span data-slot="text" data-path={s.path} data-label={s.label} data-as={s.as} data-part={s.part} data-empty={s.value.trim() ? undefined : ""} style={contents}>
        {s.value.trim() ? s.value : <span style={muted}>{s.placeholder}</span>}
      </span>
    ),
    paras: (s) => {
      const paras = s.value.split(/\n{2,}/).filter((p) => p.trim());
      return (
        <div data-slot="paras" data-path={s.path} data-label={s.label} data-empty={paras.length ? undefined : ""} style={contents}>
          {paras.length ? (
            paras.map((p, i) => (
              <p key={i} className={s.paraClass}>
                {p}
              </p>
            ))
          ) : (
            <p className={s.paraClass} style={muted}>
              {s.placeholder}
            </p>
          )}
        </div>
      );
    },
    photo: (face) => (
      <span data-slot="photo" style={contents}>
        {face}
      </span>
    ),
    section: (s, node) => (
      <div data-slot="section" data-key={s.key} data-index={s.index} data-count={s.count} style={contents}>
        {node}
      </div>
    ),
    tile: (s, node) => (
      <div data-slot="tile" data-id={s.id} data-where={s.where} data-index={s.index} data-count={s.count} style={contents}>
        {node}
      </div>
    ),
    lineTools: (s) => <div data-slot="line-tools" data-path={s.path} data-kind={s.kind} data-count={s.count} data-max={s.max} hidden />,
    owner: (where) => (where === "work-end" ? <li data-slot="owner" data-where={where} hidden /> : <div data-slot="owner" data-where={where} hidden />),
    tools: (where) => <span data-slot="tools" data-where={where} hidden />,
  };
}
