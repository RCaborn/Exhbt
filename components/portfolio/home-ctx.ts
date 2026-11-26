// components/portfolio/home-ctx.ts  (types only: no "use client", no values, safe to import anywhere)
import type { ReactNode } from "react";
import type { SectionKey } from "@/lib/portfolio-layout";

/** A path into the editor's state (`BuilderState`): "profile.name", "arrangement.tiles.about.text", "arrangement.tiles.education.lines.1". */
export type HomePath = string;

/** One line of plain text in the page's own type. Enter does nothing. */
export type HomeTextSlot = {
  path: HomePath;
  value: string;
  /** The field's accessible name: "Your name", "Who said it". */
  label: string;
  placeholder: string;
  /** "block" where the page sets the words on their own (a name, a headline, a line); "inline" where they flow among other words (a quote between its marks; its name and role on one line). */
  as: "block" | "inline";
  /** For a line of education or experience only: which half this field is. The adapter writes the whole line back with joinYear. */
  part?: "label" | "year";
  maxChars?: number;
};

/** Paragraphs in the page's own type: Enter starts a new paragraph (a blank line in the stored text). The intro and About me's words. */
export type HomeParasSlot = {
  path: HomePath;
  value: string;
  label: string;
  placeholder: string;
  /** The classes the page puts on each paragraph, so the field's paragraphs are set exactly the same. */
  paraClass: string;
};

/** One section, for its frame and corner toolbar. Plain values only. */
export type HomeSectionSlot = { key: SectionKey; index: number; count: number };

/** One exhbt as the page draws it: in the band, as a card, or as a row (the list and index looks). */
export type HomeTileSlot = { id: string; where: "band" | "card" | "row"; index: number; count: number };

/** A list of education or experience lines, for the controls drawn over it (add a line; move or remove one). */
export type HomeLinesSlot = { path: HomePath; kind: "education" | "experience"; count: number; max: number };

/** Where the page asks for what only the owner sees. */
export type HomeOwnerPlace =
  /** The band, when the band is on the page and there is no exhbt yet: the vision. */
  | "band"
  /** After the last card of More of my work: owner-only tiles, the Add tile, the hidden row. */
  | "work-end"
  /** After the last section, when More of my work is not on the page: the same parts. */
  | "page-end";

export type HomeEdit = {
  text(s: HomeTextSlot): ReactNode;
  paras(s: HomeParasSlot): ReactNode;
  /** The photo or the initials with the button over it that opens the photo sheet. `face` is what the page draws without an adapter. */
  photo(face: ReactNode): ReactNode;
  /** A section in its frame. `node` is the section as the page draws it, its fields included. */
  section(s: HomeSectionSlot, node: ReactNode): ReactNode;
  /** An exhbt with the owner's controls over its corner. `node` is the band, card or row as the page draws it. */
  tile(s: HomeTileSlot, node: ReactNode): ReactNode;
  /** Drawn over a list of lines; takes no room. */
  lineTools(s: HomeLinesSlot): ReactNode;
  owner(where: HomeOwnerPlace): ReactNode;
  /** The corner toolbar of a part with no frame of its own: the intro's (Suggest an intro) and Get in touch's (Your links). Takes no room. */
  tools(where: "intro" | "contact"): ReactNode;
};

// HomeProps (components/portfolio/PortfolioHome.tsx) gains one optional prop:
//   edit?: HomeEdit
// No public caller passes it. With `edit`, the page draws every section in `sections` (none is left out
// for being empty), draws empty word sections with their fields rather than EmptySection's outline, and
// keeps the top bar and the footer inert (as `inertChrome` does). `frame` stays for the step builder
// until the clean-up removes it.

// lib/portfolio-layout.ts gains, beside splitYear:
//   export function joinYear(label: string, year: string | null): string
// It writes "label, year". splitYear(joinYear(label, year)) gives back { label, year } for any label that does
// not itself end in a year and any year splitYear reads ("2024", "2021–2024", "2023 to now");
// joinYear(label, null) and joinYear(label, "") give label.trim(). A line is rewritten only when one of its
// two fields is typed in, so a stored line nobody touches keeps its own punctuation.
