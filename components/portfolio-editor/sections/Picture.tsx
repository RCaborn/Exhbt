"use client";

import type { ReactNode } from "react";
import type { HomeEdit } from "@/components/portfolio/home-ctx";
import { PortfolioHome } from "@/components/portfolio/PortfolioHome";
import { lookAttrs, themeStyle } from "@/components/portfolio/themeFonts";
import type { SectionKey } from "@/lib/portfolio-layout";
import type { Home } from "../home";

/*
 * A picture of one section, for the copy lifted while it is dragged (decision 0026, "Dragging": it
 * keeps its look). It is the page's own section drawn through an adapter that has no fields and no
 * controls: each field is its words, or its placeholder in the look's faint colour where it is empty,
 * so an empty section looks as it does on the editing page. Nothing in it can be focused or pressed,
 * and it registers nothing (no sortables, no paths, no render counts).
 */

const faint = (s: string) => <span className="text-[color:var(--pf-faint)]">{s}</span>;

const PICTURE: HomeEdit = {
  text: (s) => (s.value ? s.value : faint(s.placeholder)),
  paras: (s) => {
    const paras = s.value.split(/\n{2,}/).filter((p) => p.trim());
    return paras.length ? paras.map((p, i) => <p key={i} className={s.paraClass}>{p}</p>) : <p className={s.paraClass}>{faint(s.placeholder)}</p>;
  },
  photo: (face) => face,
  section: (_s, node) => node,
  tile: (_s, node) => node,
  lineTools: () => null,
  owner: () => null,
  tools: () => null,
};

export function SectionPicture({ home, sectionKey }: { home: Home; sectionKey: SectionKey }): ReactNode {
  return (
    <div {...lookAttrs(home.theme)} style={themeStyle(home.theme)} inert aria-hidden data-lifted="section">
      <PortfolioHome {...home} sections={[sectionKey]} sectionsOnly edit={PICTURE} />
    </div>
  );
}
