"use client";

import type { ReactNode } from "react";
import type { HomeOwnerPlace } from "@/components/portfolio/home-ctx";

/*
 * STUB (brief E, milestone 1). Brief F takes this file over: what only the owner sees on the page.
 *  - "band": the look's own button, "Add an exhbt", in the band's button row (the page draws the band
 *    and "Your best project goes here" itself; `bandButtonClass` in PortfolioHome.tsx gives the classes);
 *  - "work-end": the owner-only tiles (a draft, an exhbt over the plan's limit), the Add tile and the
 *    hidden row, as <li>s: it is the last child of the work's <ul> or <ol>;
 *  - "page-end": the same parts after the last section, when More of my work is off the page: a bare
 *    child of the page's root, with no wrapper.
 * Until then it draws nothing.
 */
export function OwnerParts(props: { where: HomeOwnerPlace }): ReactNode {
  void props;
  return null;
}
