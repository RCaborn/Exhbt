// components/portfolio/page-ctx.ts  (types only: no "use client", no values, safe to import anywhere)
//
// The editing slots on the exhbt page (decision 0026, "One page, one renderer"). Every page part is
// given a PageCtx; on a public page `edit` is absent and the part draws what it always drew. The
// edit-on-page editor passes `edit`, an object of functions that return the editing version of
// each thing, and a part asks one question: `ctx.edit ? ctx.edit.text({ … }) : value`.
import type { ReactNode } from "react";
import type { RichText, SectionKind } from "@/lib/exhbt/blocks";
import type { Format, PageKind } from "@/lib/exhbt/formats";
import type { ItemAs } from "@/lib/exhbt/layouts";

export type Sub = "h2" | "h3";
export type ImageUrls = Record<string, string | null>;

/** The path validateForPublish reports for a field: "title", "gap", "flow.2.step", "sections.3.items.1", "sections.4.alt". */
export type FieldPath = string;

/** Plain text typed in the page's own type. The adapter returns a labelled field with no box of its own. */
export type TextSlot = {
  path: FieldPath;
  value: string;
  /** The field's accessible name: "Box 3", "Who said it". */
  label: string;
  placeholder: string;
  /** A fixed DOM id, where the tests rely on one: "title", "context", "whereWhen", "myRole", "flow-box-2". */
  id?: string;
  /** A hard cap in characters, where the model has one. */
  maxChars?: number;
};

/** Formatted text (bold, italic, links; or the highlight). The adapter renders a <div> with `className` and the field in it. */
export type RichSlot = {
  path: FieldPath;
  value: RichText;
  label: string;
  placeholder: string;
  /** The classes of the element the page draws this text in, when that element is a <p>: the adapter's <div> takes its place. "" when the page keeps its own element (<li>, <figcaption>) and the field goes inside it. */
  className: string;
  /** The context line: bold is drawn as the highlight and the one button says Highlight. */
  highlight?: boolean;
  /**
   * The words are stored as a plain string at `path`, with their bold and italic as runs beside it at `${path}Runs`
   * (decision 0032: a quote's and a pull quote's words, a link's description). `value` is the two read together
   * (richOf). The field takes bold and italic, and no links.
   */
  beside?: boolean;
  /** The page sets these words between quotation marks (a quote, a pull quote): the field draws the marks round its words itself. */
  quoted?: boolean;
};

/**
 * A part's title, typed in place (decision 0032): a section's heading, the flowchart's, or the heading over a
 * list of links. The adapter renders the heading element itself (`Sub`, with `id` and `className`, as the page
 * draws it) with the field in it, and reads the stored title from the doc by `path`.
 */
export type TitleSlot = {
  /** Where the title is stored: "sections.N.title", "flowTitle" or "refsTitle". */
  path: FieldPath;
  /** The layout's own heading, which shows until the person types a title of their own. "" where the layout draws none (a case study's flowchart). */
  fallback: string;
  /** The field's accessible name: "Findings: title". */
  label: string;
  Sub: Sub;
  id: string;
  className: string;
};

/** One page item. Every value is a string, a number or a boolean, so the frame can be memoised. */
export type ItemSlot = {
  id: string;
  kind: PageKind;
  as: ItemAs;
  /** The classes the read-only page puts on this item's root for its place in the column (the row's margin). The frame carries them and the part inside is drawn without them. "" inside a pair, a stack or a group. */
  rowClass: string;
  /** Its place among the page's items, from 0, and how many there are. */
  index: number;
  count: number;
};

/** The "+" before the page item at `at`. `end` is the one after the last item. */
export type InsertSlot = { at: number; end?: boolean };

/**
 * Edit-only things that belong to a part but are not on the published page: an image's description and picked-figure label, a link's "Web address", a graph's "Edit figures", the aim or hypothesis switch.
 * "above" is drawn over the part's top edge and "over" over a corner: they take no room (decision 0026, "Edit-only controls take no room").
 * "below" is an image's description field, in the flow under the picture and its caption: one of the two edit-only fields 0026 allows in the flow (`EDIT_ONLY_IN_FLOW`).
 */
export type ExtraSlot = { sectionId: string; kind: SectionKind; where: "above" | "below" | "over" };

/** Controls for point `index` of a list (move up, move down, remove). `index === n` is the control that adds a point. All of them are drawn over the list and take no room. */
export type ListSlot = { path: FieldPath; index: number; n: number };

/** The flowchart's own slots, so MethodFlow keeps its markup and classes. */
export type FlowEdit = {
  /** Wraps the whole list (the adapter returns the <ol> it is given, inside whatever it needs round it). */
  list(o: { count: number; stack: boolean; children: ReactNode }): ReactNode;
  /** One box. The adapter renders the <li> itself with `className`, so it can be the thing that is dragged, and gives it a key that lasts. */
  box(o: { index: number; last: boolean; className: string; children: ReactNode }): ReactNode;
  /** Inside a box, out of the flow: its grip and its remove button. */
  tools(o: { index: number; count: number }): ReactNode;
  /** In the arrow after box `after`: the "+" that adds a box there. `after === count - 1` is the one at the end. */
  add(o: { after: number; count: number }): ReactNode;
};

/** A part of the page with no frame of its own: the title with the facts, the context line, the skills. */
export type ShellTools = { block: "header" | "gap" | "skills" };

export type EditAdapter = {
  text(o: TextSlot): ReactNode;
  rich(o: RichSlot): ReactNode;
  title(o: TitleSlot): ReactNode;
  item(o: ItemSlot): ReactNode;
  insert(o: InsertSlot): ReactNode;
  extra(o: ExtraSlot): ReactNode;
  list(o: ListSlot): ReactNode;
  flow: FlowEdit;
  /** The skill pills, each with remove, then the "Add a skill" box (id `skill-new`) at their end, in the flow: one of the two edit-only fields 0026 allows there. Takes the place of the read-only list, and is drawn even when there are no skills, when the box alone is the block's placeholder. */
  skills(): ReactNode;
  /** The sidebar's control for the work. Takes the place of "See the work". */
  work(): ReactNode;
  /** A shell part's corner toolbar, out of the flow: "More actions" (rewrite, back to the AI version) where the AI drafted it. */
  tools(o: ShellTools): ReactNode;
};

/** What every page part is given. `edit` is absent on every public page. */
export type PageCtx = { Sub: Sub; imageUrls: ImageUrls; format: Format; edit?: EditAdapter };
