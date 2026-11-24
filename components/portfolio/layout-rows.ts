import type { Format, PageKind } from "@/lib/exhbt/formats";
import type { GroupOf, ItemAs, PairRatio, Row, StackName } from "@/lib/exhbt/layouts";

/*
 * The classes of the exhbt page's rows (decision 0027): the one place they are written. LayoutMain
 * draws the page with them, and the editor's drag engine lays out empty boxes with these same
 * strings to measure where a section would land, so nothing else may give a row a class. Pure:
 * strings only, no React. Whole class names, because Tailwind reads the source for them.
 *
 * Each string is copied from the wrappers today's pages carry (the case study's runs, the
 * gallery's and research's own compositions, before release 2), so every existing page is drawn
 * byte for byte as it was. A row of one item is that item's own root, so for it `rowClass` is the
 * classes that root takes for its place: its margin, and for the few parts the page wraps (a lone
 * flowchart in a gallery, research's results on their own) the wrapper's classes too.
 */

const cx = (...parts: (string | false | undefined)[]) => parts.filter(Boolean).join(" ");

/** The gap above every row but the first: 2.75rem on screen, less in print (globals.css). */
const SECTION = "xp-section";
/** Two columns from a 42rem main column, and in print. */
const TWO = "@2xl/main:grid-cols-2 print:grid-cols-2";

/**
 * The first row's gap under the context line. A case study's flowchart sits 2rem below it; research's
 * first row keeps the section gap's print rule; a gallery's first row is an ordinary section unless it
 * is the lead image (`LEAD_FIRST`). The four new layouts follow the case study, or the gallery when
 * they lead with a picture.
 */
const FIRST: Record<Format, string> = {
  "case-study": "mt-8 print:mt-3",
  gallery: SECTION,
  research: "xp-section mt-8 print:mt-3",
  build: SECTION,
  essay: "mt-8 print:mt-3",
  "before-after": "mt-8 print:mt-3",
  event: SECTION,
};
/** The lead image as the first row: close under the context line on a narrow page, roomier on a wide one. */
const LEAD_FIRST = "xp-section mt-3 @2xl/main:mt-8 print:mt-3";

/** The margin a row takes for its place. */
const margin = (f: Format, first: boolean) => (first ? FIRST[f] : SECTION);

/** The grid that holds research's results, and a stack, when either stands alone: no columns. */
const LONE_GRID = "grid items-start gap-8";

/** A pair's columns. "found": the findings a little narrower than the figure; "key": a narrow column beside the key figure. Reversed, the widths mirror. */
const PAIR: Record<PairRatio, { base: string; forward: string; reversed: string }> = {
  found: {
    base: "xp-found grid items-center gap-8 @2xl/main:gap-9 print:gap-5",
    forward: "@2xl/main:grid-cols-[minmax(0,0.92fr)_minmax(0,1fr)] print:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)]",
    reversed: "@2xl/main:grid-cols-[minmax(0,1fr)_minmax(0,0.92fr)] print:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]",
  },
  even: {
    base: "grid items-start gap-8 print:gap-5",
    forward: TWO,
    reversed: TWO,
  },
  key: {
    base: "grid items-start gap-9 print:gap-5",
    forward: "@2xl/main:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] print:grid-cols-[52mm_minmax(0,1fr)]",
    reversed: "@2xl/main:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] print:grid-cols-[minmax(0,1fr)_52mm]",
  },
};

/** Whether a stack on a row of its own is drawn as one element (the row's root is the stack's wrapper) rather than a stack's wrapper inside a row. Research's method is; the others sit in a grid as they do beside a pair. */
export const stackIsRow = (name: StackName): boolean => name === "method";

/**
 * The classes of a lone item's root for its place, when the item is not drawn in a wrapper of its
 * own: its margin. `kind` and `as` pick the parts today's page wraps in a row element.
 */
function oneItemClass(kind: PageKind, as: ItemAs, f: Format, first: boolean): string {
  if (as === "lead") return first ? LEAD_FIRST : SECTION;
  // A gallery's flowchart with nothing beside it keeps the grid today's page puts round "What I did".
  if (kind === "flow" && as === "plain" && f !== "case-study") return cx(margin(f, first), LONE_GRID);
  // Research's results with nothing beside them sit in the grid the pair would have used, with one column.
  if (kind === "findings" && as === "kicker") return cx(margin(f, first), LONE_GRID);
  return margin(f, first);
}

/** The classes of a row's root, its margin included. `first`: it is the first row under the context line. */
export function rowClass(row: Row, f: Format, first: boolean): string {
  switch (row.row) {
    case "one": {
      const c = row.cell;
      if (c.cell === "item") return oneItemClass(c.item.kind, c.as, f, first);
      return stackIsRow(c.name) ? cx(margin(f, first), stackClass(c.name, f).replace("@container ", "")) : cx(margin(f, first), LONE_GRID);
    }
    case "pair": {
      const p = PAIR[row.ratio];
      return cx(margin(f, first), p.base, row.reversed ? p.reversed : p.forward);
    }
    case "group":
      return groupClass(row.of, row.items.length, f, first);
  }
}

function groupClass(of: GroupOf, n: number, f: Format, first: boolean): string {
  switch (of) {
    case "graphs":
    case "images":
    case "figures":
    case "links":
      // Build's screenshots are often a phone's shape beside a wide one: each card keeps its own height.
      return cx(margin(f, first), "grid gap-6", n > 1 && TWO, of === "images" && f === "build" && "items-start");
    case "grid":
      // The justified rows carry their own gap above (.xp-grid in globals.css).
      return "xp-grid";
    case "refs":
      return cx(margin(f, first), "break-inside-avoid");
    case "buttons":
      // Build's demo and code: buttons side by side, each with its line under it.
      return cx(margin(f, first), "flex flex-wrap items-start gap-x-4 gap-y-3");
    case "before-after":
      return cx(margin(f, first), "grid gap-6", TWO);
  }
}

/** The classes of a stack's wrapper. The same in every layout today; `f` is there so a layout can have its own. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function stackClass(name: StackName, f: Format): string {
  switch (name) {
    case "method":
      return "@container min-w-0";
    case "closing":
      return "min-w-0";
    case "happened":
      return "min-w-0 space-y-6 print:space-y-3";
  }
}

/**
 * The classes the read-only page puts on a stack's item for following another: research's method
 * below the aim, and the limitations below the conclusion with a hairline above. "" for the first.
 * The editing page draws each item in a frame of its own, so there the stack's wrapper takes
 * `stackEditClass` instead, whose rules in globals.css give the same look.
 */
export function stackItemClass(name: StackName, index: number): string {
  if (index === 0) return "";
  switch (name) {
    case "method":
      return "mt-6 print:mt-3";
    case "closing":
      return "xp-next mt-5 border-t pt-5 print:mt-2 print:pt-2";
    case "happened":
      // The wrapper spaces them (space-y-6).
      return "";
  }
}

/** On the editing page only: the stack wrapper's class that spaces its framed items as `stackItemClass` does on the read-only page. */
export function stackEditClass(name: StackName): string {
  switch (name) {
    case "method":
      return "xp-stack-edit-method";
    case "closing":
      return "xp-stack-edit-closing";
    case "happened":
      return "";
  }
}

/**
 * The cell each item of a group sits in, where the group has one: a picture's tile in the justified
 * rows (its shape set inline as --r), a link's column, a reference's line in the list. The cell is
 * drawn round the item on both pages, so on the editing page the frame sits inside it and the cell
 * still lays out as the read-only page does. "" for a group whose items are its own cells.
 */
export function cellClass(of: GroupOf): string {
  switch (of) {
    case "grid":
      return "xp-tile";
    case "links":
      return "min-w-0 [&>section]:mt-0";
    case "refs":
      return "xp-finding border-b py-3 text-[0.9375rem] leading-snug last:border-b-0 print:py-1.5";
    default:
      return "";
  }
}

/**
 * On the read-only page, the class an item in a group's cell keeps on its own root: a link in the
 * gallery's columns is drawn as a lone link is, with the section gap, which its cell takes away
 * (`[&>section]:mt-0`). On the editing page the frame sits between them, so the item is drawn without it.
 */
export function cellItemClass(of: GroupOf): string {
  return of === "links" ? SECTION : "";
}
