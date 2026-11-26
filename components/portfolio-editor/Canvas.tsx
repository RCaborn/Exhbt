"use client";

import type { ReactNode } from "react";
import { PortfolioHome } from "@/components/portfolio/PortfolioHome";
import { lookAttrs, themeStyle } from "@/components/portfolio/themeFonts";
import { useAdapter } from "./adapter";
import { GROUND } from "./geometry";
import { useEditingHome } from "./home";
import { useRenderCount } from "./renders";
import { ArrangeBoard } from "./sections/ArrangeBoard";

/**
 * The editing page (decision 0031, "The portfolio editor"): the person's own page, drawn by the same
 * `PortfolioHome` a visitor gets, with the adapter, in their look, at the width visitors get. The
 * wrapper carries the look as the page's own root does, so whatever the editor draws round the page (a
 * section lifted for a drag) is in the look too.
 *
 * It reads the whole state, so it is drawn again on every change; what keeps that cheap is in adapter.tsx.
 */
export function Canvas(): ReactNode {
  const home = useEditingHome();
  const edit = useAdapter();
  useRenderCount("page");
  return (
    <div {...lookAttrs(home.theme)} style={themeStyle(home.theme)} className={GROUND} data-canvas="edit">
      <ArrangeBoard>
        <PortfolioHome {...home} edit={edit} />
      </ArrangeBoard>
    </div>
  );
}
