import { FLOW_ID, formatLimits, isContent, type ContentSection, type ExhbtDoc, type FlowMarker, type FlowStep, type Section, type SectionKind, type SectionOf } from "./blocks";
import { flowShown, FORMAT_COPY, FORMAT_RULES, formatOf, hasMarker, isArranged, isShown, withFormat, type Format, type PageKind } from "./formats";
import { newImageSection, newSection, roomFor, sectionName } from "./sections";

/**
 * The layout engine (decision 0027): what the main column of an exhbt draws, in what order, and
 * in which rows. Pure and server-safe: no React, no DOM. Every layout is drawn in the doc's own
 * order; a doc the new editor has never touched (no flowchart marker, no flowOff) is drawn as
 * adopt(doc), the same page with the order written down. The rows come from per-layout rules
 * (ROW_RULES), tried at each place in that order; nothing is ever reordered to make a row.
 */

export { flowShown, hasMarker, isArranged };

/** One thing the page draws in the main column, in page order. `index` is its place in doc.sections as stored (for issue paths); -1 for a flowchart with no marker. */
export type PageItem =
  | { id: "flow"; kind: "flow"; index: number; steps: FlowStep[] }
  | { id: string; kind: SectionKind; index: number; s: ContentSection };

/** How one item is drawn. "plain" is the item on its own row. */
export type ItemAs = "plain" | "lead" | "key" | "tile" | "stacked" | "kicker" | "before" | "after" | "button" | "listed";
export type ItemCell = { cell: "item"; item: PageItem; as: ItemAs };
/** Items one under another in one column of a pair, or on a row of their own. */
export type StackName = "happened" | "method" | "closing";
export type StackCell = { cell: "stack"; name: StackName; items: ItemCell[] };
export type Cell = ItemCell | StackCell;
/** "found": findings beside a figure. "even": two equal columns. "key": a narrow column beside the key figure. */
export type PairRatio = "found" | "even" | "key";
export type GroupOf = "graphs" | "images" | "figures" | "grid" | "links" | "refs" | "buttons" | "before-after";
export type Row =
  | { row: "one"; cell: Cell }
  /** `left` and `right` are in the doc's order. `reversed` is true when the usual right-hand part comes first, so the column widths mirror. */
  | { row: "pair"; ratio: PairRatio; reversed: boolean; left: Cell; right: Cell }
  | { row: "group"; of: GroupOf; items: ItemCell[] };

/** One side of a pair: a single item, or a stack. `first: true` matches only the layout's lead or key item; `first: false` never matches it. */
type Side =
  | { kinds: readonly PageKind[]; as?: ItemAs; first?: boolean }
  | { stack: StackName; kinds: readonly PageKind[] };
export type RowRule =
  /** `a` straight before `b` (reversed: false), or `b` straight before `a` (reversed: true). Forward wins: a reversed match is not taken when its `a` item is straight followed by an item that makes a forward pair with it. */
  | { rule: "pair"; ratio: PairRatio; a: Side; b: Side }
  /** A run of one or more of these kinds, each kind once, on a row of its own. Its items are drawn "stacked". */
  | { rule: "stack"; stack: StackName; kinds: readonly PageKind[] }
  /** A run of one or more sections of these kinds. Never takes the lead or key item. */
  | { rule: "group"; of: GroupOf; kinds: readonly SectionKind[]; as: ItemAs }
  /** An image marked "before" straight before one marked "after". */
  | { rule: "before-after" };

const FIGURE = ["graph", "image"] as const;
/** Tried in this order at each place in the doc's order; the first that matches takes its items. Nothing matches: the item is a row of its own, drawn "plain" (or as LONE says). */
export const ROW_RULES: Record<Format, readonly RowRule[]> = {
  "case-study": [
    { rule: "pair", ratio: "found", a: { kinds: ["findings"] }, b: { kinds: FIGURE } },
    { rule: "group", of: "graphs", kinds: ["graph"], as: "plain" },
    { rule: "group", of: "images", kinds: ["image"], as: "plain" },
  ],
  gallery: [
    { rule: "pair", ratio: "even", a: { kinds: ["flow"], as: "stacked" }, b: { stack: "happened", kinds: ["findings", "graph"] } },
    { rule: "group", of: "grid", kinds: ["image"], as: "tile" },
    { rule: "group", of: "links", kinds: ["link"], as: "plain" },
  ],
  research: [
    { rule: "pair", ratio: "key", a: { stack: "method", kinds: ["aim", "flow"] }, b: { kinds: FIGURE, first: true, as: "key" } },
    { rule: "stack", stack: "method", kinds: ["aim", "flow"] },
    { rule: "group", of: "figures", kinds: FIGURE, as: "plain" },
    { rule: "pair", ratio: "even", a: { kinds: ["findings"], as: "kicker" }, b: { stack: "closing", kinds: ["conclusion", "reflection"] } },
    { rule: "stack", stack: "closing", kinds: ["conclusion", "reflection"] },
    { rule: "group", of: "refs", kinds: ["link"], as: "listed" },
  ],
  build: [
    { rule: "pair", ratio: "found", a: { kinds: ["findings"] }, b: { kinds: FIGURE, first: false } },
    { rule: "group", of: "images", kinds: ["image"], as: "plain" },
    { rule: "group", of: "buttons", kinds: ["link"], as: "button" },
  ],
  essay: [
    { rule: "pair", ratio: "found", a: { kinds: ["findings"] }, b: { kinds: ["pullquote"] } },
    { rule: "group", of: "refs", kinds: ["link"], as: "listed" },
  ],
  "before-after": [
    { rule: "before-after" },
    { rule: "pair", ratio: "found", a: { kinds: ["findings"] }, b: { kinds: ["graph"] } },
    { rule: "group", of: "images", kinds: ["image"], as: "plain" },
  ],
  event: [
    { rule: "pair", ratio: "even", a: { kinds: ["flow"], as: "stacked" }, b: { stack: "happened", kinds: ["findings", "graph"] } },
    { rule: "group", of: "grid", kinds: ["image"], as: "tile" },
    { rule: "group", of: "links", kinds: ["link"], as: "plain" },
  ],
};
/** How an item on a row of its own is drawn when it is not "plain". The lead and key items are always "lead" and "key". */
export const LONE: Partial<Record<Format, Partial<Record<PageKind, ItemAs>>>> = { research: { findings: "kicker" } };

/* ---------------- The order ---------------- */

const marker = (): FlowMarker => ({ id: FLOW_ID, kind: "flow" });
const drawsKind = (f: Format, kind: PageKind): boolean => kind === "flow" || (FORMAT_RULES[f].kinds as readonly string[]).includes(kind);
const isFigure = (s: Section | undefined): boolean => s?.kind === "graph" || s?.kind === "image";

/**
 * Today's case-study pairing (runsOf, components/portfolio/ProjectView.tsx before release 2),
 * ported as it was, with its runs written out flat: a findings-and-figure run as the findings then
 * the figure. "What I found" next to a graph or image that is its neighbour (before or after it)
 * pairs with it; a figure already in a run of its kind does not; graphs next to each other share
 * a row, and so do images.
 */
function caseStudyOrder(sections: ContentSection[]): ContentSection[] {
  type Run = { kind: "found"; findings: ContentSection; figure: ContentSection } | { kind: "graphs" | "images"; items: ContentSection[] } | { kind: "one"; section: ContentSection };
  const out: Run[] = [];
  for (let i = 0; i < sections.length; i++) {
    const s = sections[i]!;
    const next = sections[i + 1];
    const last = out[out.length - 1];
    if (s.kind === "findings" && isFigure(next)) {
      out.push({ kind: "found", findings: s, figure: next! });
      i++;
    } else if (isFigure(s) && next?.kind === "findings" && !(last?.kind === "graphs" && s.kind === "graph") && !(last?.kind === "images" && s.kind === "image")) {
      out.push({ kind: "found", findings: next, figure: s });
      i++;
    } else if (s.kind === "graph") {
      if (last?.kind === "graphs") last.items.push(s);
      else out.push({ kind: "graphs", items: [s] });
    } else if (s.kind === "image") {
      if (last?.kind === "images") last.items.push(s);
      else out.push({ kind: "images", items: [s] });
    } else out.push({ kind: "one", section: s });
  }
  return out.flatMap((r) => (r.kind === "found" ? [r.findings, r.figure] : r.kind === "one" ? [r.section] : r.items));
}

/** Each item's place in the layout's usual order (FORMAT_RULES[f].template). A `first` slot takes only the first item of its kinds. A kind with no slot goes last. */
function slotsOf(kinds: readonly PageKind[], f: Format): number[] {
  const template = FORMAT_RULES[f].template;
  const taken = new Set<number>();
  return kinds.map((kind) => {
    for (let k = 0; k < template.length; k++) {
      const slot = template[k]!;
      if (!slot.kinds.includes(kind)) continue;
      if (slot.first) {
        if (taken.has(k)) continue;
        taken.add(k);
      }
      return k;
    }
    return template.length;
  });
}

/** A stable sort into the layout's usual order. */
function templateOrder<T extends Section>(list: T[], f: Format): T[] {
  const slots = slotsOf(list.map((s) => s.kind), f);
  return list
    .map((s, i) => ({ s, k: slots[i]!, i }))
    .sort((a, b) => a.k - b.k || a.i - b.i)
    .map((x) => x.s);
}

/**
 * `sections` in a new order of the drawn ones (the marker counts as drawn), with each section the
 * layout keeps but does not draw put straight after the drawn section it followed (first, when it
 * followed none).
 */
function keepingHidden(sections: Section[], f: Format, order: (drawn: Section[]) => Section[]): Section[] {
  const after = new Map<Section | null, Section[]>();
  let prev: Section | null = null;
  const drawn: Section[] = [];
  for (const s of sections) {
    if (drawsKind(f, s.kind)) {
      drawn.push(s);
      prev = s;
    } else after.set(prev, [...(after.get(prev) ?? []), s]);
  }
  return [...(after.get(null) ?? []), ...order(drawn).flatMap((s) => [s, ...(after.get(s) ?? [])])];
}

/** The same page with the order written down: the marker put in, the sections in the order they are drawn. The same object when already arranged. */
export function adopt(doc: ExhbtDoc): ExhbtDoc {
  if (isArranged(doc)) return doc;
  const f = formatOf(doc);
  const sections =
    FORMAT_RULES[f].legacy === "flow-first"
      ? keepingHidden(doc.sections, f, (drawn) => [marker(), ...caseStudyOrder(drawn.filter(isContent))])
      : keepingHidden(doc.sections, f, (drawn) => templateOrder([...drawn, marker()], f));
  return { ...doc, sections };
}

/** A layout switch in the new editor: adopt, set the layout, sort the sections into its usual order (a stable sort). */
export function applyTemplate(doc: ExhbtDoc, to: Format): ExhbtDoc {
  const a = adopt(doc);
  const next = withFormat(a, to);
  let sections = a.sections;
  // The flowchart was off and the new layout always has one: it comes back, in its usual place, with its boxes.
  if (!hasMarker(a) && !FORMAT_RULES[to].flowRemovable) {
    sections = [...sections, marker()];
    delete next.flowOff;
  }
  return { ...next, sections: keepingHidden(sections, to, (drawn) => templateOrder(drawn, to)) };
}

/**
 * What the main column draws, in order: the items of adopt(doc) that the layout shows, each with its index in `doc` as given.
 * `skip` leaves sections out before the order is worked out (the read-only page skips an image with no address and an aim
 * or conclusion with no words, as today's page does before it pairs anything). The editor never passes it.
 */
export function pageItems(doc: ExhbtDoc, skip?: (s: ContentSection) => boolean): PageItem[] {
  const stored = new Map<Section, number>(doc.sections.map((s, i) => [s, i]));
  const a = adopt(skip ? { ...doc, sections: doc.sections.filter((s) => !isContent(s) || !skip(s)) } : doc);
  const items: PageItem[] = [];
  const shown = flowShown(a);
  // A case study or research page always has its flowchart: with flowOff and no marker, it is drawn first.
  if (shown && !hasMarker(a)) items.push({ id: FLOW_ID, kind: "flow", index: -1, steps: doc.flow });
  for (const s of a.sections) {
    if (!isContent(s)) items.push({ id: FLOW_ID, kind: "flow", index: stored.get(s) ?? -1, steps: doc.flow });
    else if (isShown(a, s)) items.push({ id: s.id, kind: s.kind, index: stored.get(s) ?? -1, s });
  }
  return items;
}

/** Sections the layout keeps but does not draw. */
export function keptItems(doc: ExhbtDoc): PageItem[] {
  return doc.sections.flatMap((s, index): PageItem[] => (isContent(s) && !isShown(doc, s) ? [{ id: s.id, kind: s.kind, index, s }] : []));
}

/* ---------------- The rows ---------------- */

export function rowsFor(items: PageItem[], f: Format): Row[] {
  const first = FORMAT_RULES[f].first;
  /** The lead image or the key figure: the first item of the layout's `first` kinds. */
  const lead = first ? items.findIndex((it) => (first.kinds as readonly PageKind[]).includes(it.kind)) : -1;
  const leadAs: ItemAs = first?.as ?? "plain";
  const item = (at: number, as: ItemAs): ItemCell => ({ cell: "item", item: items[at]!, as: at === lead ? leadAs : as });

  /** A run from `at` of one or more of these kinds, each kind once, never the lead or key item. */
  const stack = (name: StackName, kinds: readonly PageKind[], at: number): { cell: StackCell; n: number } | null => {
    const used = new Set<PageKind>();
    const cells: ItemCell[] = [];
    for (let k = at; k < items.length && k !== lead && kinds.includes(items[k]!.kind) && !used.has(items[k]!.kind); k++) {
      used.add(items[k]!.kind);
      cells.push(item(k, "stacked"));
    }
    return cells.length ? { cell: { cell: "stack", name, items: cells }, n: cells.length } : null;
  };
  const side = (sd: Side, at: number): { cell: Cell; n: number } | null => {
    if ("stack" in sd) return stack(sd.stack, sd.kinds, at);
    const it = items[at];
    if (!it || !sd.kinds.includes(it.kind)) return null;
    if ((sd.first === true && at !== lead) || (sd.first === false && at === lead)) return null;
    return { cell: item(at, sd.as ?? "plain"), n: 1 };
  };
  const match = (r: RowRule, at: number): { row: Row; n: number } | null => {
    switch (r.rule) {
      case "pair": {
        const a = side(r.a, at);
        const b = a && side(r.b, at + a.n);
        if (a && b) return { row: { row: "pair", ratio: r.ratio, reversed: false, left: a.cell, right: b.cell }, n: a.n + b.n };
        const rb = side(r.b, at);
        const ra = rb && side(r.a, at + rb.n);
        // Forward wins: the `a` part pairs with what follows it, and this one stands alone.
        if (rb && ra && !side(r.b, at + rb.n + ra.n)) return { row: { row: "pair", ratio: r.ratio, reversed: true, left: rb.cell, right: ra.cell }, n: rb.n + ra.n };
        return null;
      }
      case "stack": {
        const s = stack(r.stack, r.kinds, at);
        return s && { row: { row: "one", cell: s.cell }, n: s.n };
      }
      case "group": {
        const cells: ItemCell[] = [];
        for (let k = at; k < items.length && k !== lead && (r.kinds as readonly PageKind[]).includes(items[k]!.kind); k++) cells.push(item(k, r.as));
        return cells.length ? { row: { row: "group", of: r.of, items: cells }, n: cells.length } : null;
      }
      case "before-after": {
        const x = items[at];
        const y = items[at + 1];
        if (at === lead || at + 1 === lead || stageOf(x) !== "before" || stageOf(y) !== "after") return null;
        return { row: { row: "group", of: "before-after", items: [item(at, "before"), item(at + 1, "after")] }, n: 2 };
      }
    }
  };

  const rows: Row[] = [];
  for (let at = 0; at < items.length; ) {
    let found: { row: Row; n: number } | null = null;
    for (const r of ROW_RULES[f]) if ((found = match(r, at))) break;
    if (found) {
      rows.push(found.row);
      at += found.n;
    } else {
      rows.push({ row: "one", cell: item(at, LONE[f]?.[items[at]!.kind] ?? "plain") });
      at++;
    }
  }
  return rows;
}

const stageOf = (it: PageItem | undefined): "before" | "after" | undefined => (it?.kind === "image" ? (it.s as SectionOf<"image">).stage : undefined);

/* ---------------- Structural changes ---------------- */

/** Where in `sections` a thing goes to sit at page place `at` (0 is first): before the page item there, or straight after the last. */
function storedPlace(sections: Section[], items: PageItem[], at: number): number {
  const p = Math.max(0, Math.min(Math.trunc(at) || 0, items.length));
  if (p < items.length) return items[p]!.index;
  return items.length ? items[items.length - 1]!.index + 1 : sections.length;
}

/**
 * An arranged doc whose flowchart is drawn with no marker (flowOff in a case study or research,
 * which always draw it, first) with the marker written in, first, so every page item has its
 * place in doc.sections. The page is the same. Any other doc as it is.
 */
function pinned(doc: ExhbtDoc): ExhbtDoc {
  if (hasMarker(doc) || !flowShown(doc)) return doc;
  const next = { ...doc, sections: [marker(), ...doc.sections] };
  delete next.flowOff;
  return next;
}

/**
 * Puts a removed flowchart back and deletes flowOff. Every other item keeps its place, and the doc stays arranged. The same object when the flowchart is shown.
 * With `at` (a page-item place, as insertBlock's), the marker goes in there: the new editor's "+" and tray always pass it.
 * Without it (the classic editor's "Put the flowchart back", which has no place to give), the marker goes in before the first page item whose place in the layout's usual order comes after the flowchart's, or at the end if none.
 */
export function restoreFlow(doc: ExhbtDoc, at?: number): ExhbtDoc {
  if (flowShown(doc)) return doc;
  const items = pageItems(doc);
  let index: number;
  if (at !== undefined) index = storedPlace(doc.sections, items, at);
  else {
    const f = formatOf(doc);
    const flowSlot = FORMAT_RULES[f].template.findIndex((slot) => slot.kinds.includes("flow"));
    const slots = slotsOf(
      items.map((it) => it.kind),
      f,
    );
    const after = items.findIndex((_, k) => slots[k]! > flowSlot);
    index = after < 0 ? doc.sections.length : items[after]!.index;
  }
  const next = { ...doc, sections: [...doc.sections.slice(0, index), marker(), ...doc.sections.slice(index)] };
  delete next.flowOff;
  return next;
}

export type BlockKind = PageKind;
/** `name` is the kind's noun in the layout's own words, as the "+" and the tray show it ("Graph", "What happened", "Reference", "Flowchart"). `full` is why it cannot be added ("Up to 2 graphs in a case study"); undefined when there is room. */
export type BlockOption = { kind: BlockKind; name: string; full?: string };

/** The order of the classic editor's "Add a section" menu (menuFor in components/editor/Sections.tsx): research's own, and everyone else's, with the pull quote after the findings. */
const MENU_ORDER: readonly SectionKind[] = ["findings", "pullquote", "graph", "image", "quote", "reflection", "link", "aim", "conclusion"];
const RESEARCH_MENU_ORDER: readonly SectionKind[] = ["aim", "findings", "graph", "image", "conclusion", "quote", "reflection", "link"];

/** What one of a kind is called in a reason ("One quote in a gallery"), and more than one ("Up to 2 graphs in a case study"). */
function nouns(kind: SectionKind, f: Format): [one: string, many: string] {
  switch (kind) {
    case "findings":
      return f === "research" ? ["results section", "results sections"] : ["findings section", "findings sections"];
    case "reflection":
      return f === "research" ? ["limitations section", "limitations sections"] : ["section on what's next", "sections on what's next"];
    case "link": {
      const word = FORMAT_COPY[f].link.toLowerCase();
      return [word, `${word}s`];
    }
    case "aim":
      return ["aim or hypothesis", "aims or hypotheses"];
    case "pullquote":
      return ["pull quote", "pull quotes"];
    default:
      return [kind, `${kind}s`];
  }
}

/** Why a kind can't be added: every one the layout allows is used, or (research) the graphs and images together are at their cap. Undefined when there is room. Every number is formatLimits'. */
function fullReason(kind: SectionKind, f: Format, sections: Section[]): string | undefined {
  if (roomFor(sections, kind, f) > 0) return undefined;
  const L = formatLimits(f);
  const where = FORMAT_COPY[f].inLayout;
  const ofKind = sections.filter((s) => s.kind === kind).length;
  const figures = sections.filter((s) => s.kind === "graph" || s.kind === "image").length;
  if (L.maxFigures !== null && (kind === "graph" || kind === "image") && figures >= L.maxFigures && ofKind < L.sections[kind]) {
    return `Up to ${L.maxFigures} graphs and images together ${where}`;
  }
  const max = L.sections[kind];
  const [one, many] = nouns(kind, f);
  return max === 1 ? `One ${one} ${where}` : `Up to ${max} ${many} ${where}`;
}

/** What the "+" menu and the tray offer: the layout's kinds in its own order and words, then the flowchart when it is off the page. */
export function blockOptions(doc: ExhbtDoc): BlockOption[] {
  const f = formatOf(doc);
  const kinds = FORMAT_RULES[f].kinds;
  const options = (f === "research" ? RESEARCH_MENU_ORDER : MENU_ORDER)
    .filter((kind) => kinds.includes(kind))
    .map((kind): BlockOption => {
      const full = fullReason(kind, f, doc.sections);
      return full ? { kind, name: sectionName(kind, f), full } : { kind, name: sectionName(kind, f) };
    });
  return flowShown(doc) ? options : [...options, { kind: "flow", name: "Flowchart" }];
}

/** The doc (adopted) with `s` at page place `at`. */
function insertAt(a: ExhbtDoc, s: ContentSection, at: number): ExhbtDoc {
  const index = storedPlace(a.sections, pageItems(a), at);
  return { ...a, sections: [...a.sections.slice(0, index), s, ...a.sections.slice(index)] };
}

/**
 * Structural changes. Each adopts the doc first. `at` and `place` count page items (pageItems), not doc.sections.
 * A new section is empty (newSection). Null when the layout has no room for the kind, or doesn't draw it (blockOptions says why).
 * `kind` "flow" puts a removed flowchart back at `at` (restoreFlow(doc, at)) and returns the id "flow"; null when the flowchart is on the page already.
 */
export function insertBlock(doc: ExhbtDoc, kind: Exclude<BlockKind, "image">, at: number): { doc: ExhbtDoc; id: string } | null {
  if (kind === "flow") return flowShown(doc) ? null : { doc: restoreFlow(doc, at), id: FLOW_ID };
  const f = formatOf(doc);
  if (!drawsKind(f, kind) || roomFor(doc.sections, kind, f) === 0) return null;
  const a = pinned(adopt(doc));
  const s = newSection(kind, a.sections);
  return { doc: insertAt(a, s, at), id: s.id };
}

/** An image of an uploaded file at page place `at`, with its size when known. Null when the layout has no room for another. */
export function insertImage(doc: ExhbtDoc, image: { fileId: string; w?: number; h?: number }, at: number): { doc: ExhbtDoc; id: string } | null {
  const f = formatOf(doc);
  if (!drawsKind(f, "image") || roomFor(doc.sections, "image", f) === 0) return null;
  const a = pinned(adopt(doc));
  const s = newImageSection(image.fileId, a.sections, image.w && image.h ? { w: image.w, h: image.h } : undefined);
  return { doc: insertAt(a, s, at), id: s.id };
}

/** `place`: the item's index among the page items with the item itself taken out (0 is first). An id that is not a page item: the doc as it was. */
export function moveItem(doc: ExhbtDoc, id: string, place: number): ExhbtDoc {
  const a = pinned(adopt(doc));
  const items = pageItems(a);
  const from = items.findIndex((it) => it.id === id);
  if (from < 0) return doc;
  const stored = items[from]!.index;
  const moving = a.sections[stored]!;
  const sections = a.sections.filter((_, i) => i !== stored);
  const rest = items.filter((_, k) => k !== from).map((it): PageItem => ({ ...it, index: it.index > stored ? it.index - 1 : it.index }));
  const index = storedPlace(sections, rest, place);
  return { ...a, sections: [...sections.slice(0, index), moving, ...sections.slice(index)] };
}

/**
 * Takes a section out (one the layout draws or one it keeps). For the flowchart: removes the marker and sets flowOff; the boxes stay in doc.flow.
 * Nothing where the layout always draws a flowchart, or for an id the doc does not have: the doc as it was.
 */
export function removeItem(doc: ExhbtDoc, id: string): ExhbtDoc {
  if (id === FLOW_ID) {
    if (!FORMAT_RULES[formatOf(doc)].flowRemovable || !flowShown(doc)) return doc;
    const a = adopt(doc);
    return { ...a, sections: a.sections.filter(isContent), flowOff: true };
  }
  if (!doc.sections.some((s) => s.id === id)) return doc;
  const a = pinned(adopt(doc));
  return { ...a, sections: a.sections.filter((s) => s.id !== id) };
}

/** Changes exactly when the layout of the page could: the layout, flowOff, and each item's id, kind and image stage, in order. */
export function structureKey(doc: ExhbtDoc): string {
  const part = (it: PageItem) => [it.id, it.kind, stageOf(it) ?? ""];
  return JSON.stringify([formatOf(doc), doc.flowOff === true, pageItems(doc).map(part), keptItems(doc).map(part)]);
}
