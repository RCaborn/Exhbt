import type { Page } from "@playwright/test";
import { ADD_EXHBT, BUILD_IT_YOURSELF, DRAFT_WITH_AI } from "../lib/add-exhbt";
import { FORMAT_RULES, type Format } from "../lib/exhbt/formats";

/**
 * What the browser tests know about "Add an exhbt" (/exhbts/new): its addresses, which are the app's own
 * (lib/add-exhbt.ts), and the names of its headings and controls. e2e/add-exhbt.spec.ts tests the screen
 * itself. Every other spec that only needs the upload form or an empty exhbt gets there through this
 * file, so a change to the chooser changes this file and that spec, and nothing else.
 */
export { ADD_EXHBT, BUILD_IT_YOURSELF, DRAFT_WITH_AI };

export const ADD = {
  /** On "Your exhbts": the one way to start an exhbt. */
  listLink: "Add an exhbt",
  chooserHeading: { level: 1 as const, name: "Add an exhbt to your portfolio" },
  /** The chooser's two ways, each a card (`data-way`) with one link. */
  draftWay: '[data-way="draft"]',
  draftLink: "Upload my files",
  blankWay: '[data-way="blank"]',
  layoutsLink: "Choose a layout",
  layoutsHeading: { level: 1 as const, name: "Choose a layout" },
  /** A layout's card on the layouts screen, and the button in it. */
  layoutCard: (f: Format) => `[data-layout="${f}"]`,
  layoutButton: (f: Format) => `Use the ${FORMAT_RULES[f].name} layout`,
  editUrl: /\/exhbts\/[0-9a-f-]{36}\/edit$/,
};

/**
 * Makes an empty exhbt: opens the layouts and presses one. A case study unless told otherwise, which is
 * what "Start from scratch" made before the chooser. Leaves the page on its way to the editor: the caller
 * waits for whatever it needs there.
 */
export async function startBlank(page: Page, layout: Format = "case-study") {
  await page.goto(BUILD_IT_YOURSELF);
  await page.getByRole("button", { name: ADD.layoutButton(layout) }).click();
}
