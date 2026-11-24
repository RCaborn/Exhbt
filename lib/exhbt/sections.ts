import {
  formatLimits,
  needMet,
  SECTION_KINDS,
  sectionsOf,
  sectionTexts,
  text,
  words,
  type ContentSection,
  type ExhbtDoc,
  type FigureKind,
  type Picked,
  type Section,
  type SectionKind,
  type SectionOf,
} from "./blocks";
import { newChart } from "./charts";
import { FORMAT_COPY, FORMAT_RULES, formatOf, hiddenSections, type Format, type FromWork, type Need } from "./formats";
import { normaliseNumber, numbersInDoc } from "./verify";

/**
 * Adding, naming and moving the sections below the flowchart (decision 0015). Pure, so the
 * editor, the AI draft and the tests share it. The schema and limits are lib/exhbt/blocks.ts;
 * the layouts (case study, gallery, research) are lib/exhbt/formats.ts (decision 0024).
 */

/** What a section is called in the editor in a case study; graphs and images also get a number (sectionLabel). */
export const SECTION_NAMES: Record<SectionKind, string> = {
  findings: "Findings",
  graph: "Graph",
  image: "Image",
  quote: "Quote",
  reflection: "What I'd do next",
  link: "Link",
  aim: "Aim or hypothesis",
  conclusion: "Conclusion",
  pullquote: "Pull quote",
};

/** What a layout calls a kind: findings, what I'd do next and the link read the layout's own words. */
export function sectionName(kind: SectionKind, f: Format = "case-study"): string {
  switch (kind) {
    case "findings":
      return f === "case-study" ? SECTION_NAMES.findings : FORMAT_COPY[f].findings;
    case "reflection":
      return FORMAT_COPY[f].reflection;
    case "link":
      return FORMAT_COPY[f].link;
    default:
      return SECTION_NAMES[kind];
  }
}

/**
 * "Graph 2", "Image 1", "Findings", "Quote": the section's name, numbered when there can be two.
 * In a gallery the first image is the "Lead image", and in research the first graph or image is
 * the "Key figure". A case study reads as it always did.
 */
export function sectionLabel(sections: Section[], i: number, f: Format = "case-study"): string {
  const s = sections[i];
  if (!s) return "";
  if (s.kind === "flow") return "Flowchart";
  if (f === "gallery" && s.kind === "image" && sections.findIndex((x) => x.kind === "image") === i) return "Lead image";
  if (f === "research" && (s.kind === "graph" || s.kind === "image") && firstOfKinds(sections, ["graph", "image"]) === i) return "Key figure";
  if (formatLimits(f).sections[s.kind] <= 1) return sectionName(s.kind, f);
  const n = sections.slice(0, i + 1).filter((x) => x.kind === s.kind).length;
  return `${sectionName(s.kind, f)} ${n}`;
}

/** The index of the first section whose kind is one of `kinds`, or -1. "Make lead image" and "Make key figure" move a section here. */
export const firstOfKinds = (sections: Section[], kinds: SectionKind[]): number => sections.findIndex((s) => s.kind !== "flow" && kinds.includes(s.kind));

/** How many more of a kind there's room for. In research a graph or image also respects the cap on figures together. The flowchart's marker is never counted. */
export function roomFor(sections: Section[], kind: SectionKind, f: Format = "case-study"): number {
  const L = formatLimits(f);
  let room = Math.max(0, L.sections[kind] - sections.filter((s) => s.kind === kind).length);
  if (L.maxFigures !== null && (kind === "graph" || kind === "image")) {
    room = Math.min(room, Math.max(0, L.maxFigures - sections.filter((s) => s.kind === "graph" || s.kind === "image").length));
  }
  return room;
}

/** The first free id for a new section of a kind: "quote-1", "graph-2". */
export function nextSectionId(kind: SectionKind, sections: Section[]): string {
  const taken = new Set(sections.map((s) => s.id));
  for (let n = 1; ; n++) if (!taken.has(`${kind}-${n}`)) return `${kind}-${n}`;
}

/** A new, empty section of a kind (an image needs its uploaded file, so it's made with newImageSection). */
export function newSection(kind: Exclude<SectionKind, "image">, sections: Section[]): ContentSection {
  const id = nextSectionId(kind, sections);
  switch (kind) {
    case "findings":
      return { id, kind, items: [[], []] };
    case "graph":
      return { id, kind, chart: newChart() };
    case "quote":
      return { id, kind, text: "", name: "", role: "" };
    case "reflection":
      return { id, kind, text: [] };
    case "link":
      return { id, kind, href: "", label: "", description: "" };
    case "aim":
      return { id, kind, text: [] };
    case "conclusion":
      return { id, kind, text: [] };
    case "pullquote":
      return { id, kind, text: "" };
  }
}

export const newImageSection = (fileId: string, sections: Section[], size?: { w: number; h: number }): SectionOf<"image"> => ({
  id: nextSectionId("image", sections),
  kind: "image",
  fileId,
  alt: "",
  caption: [],
  ...size,
});

/** The list with the section at `from` moved to `to` (both indexes in the list as it is). */
export function moveSection<T>(sections: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= sections.length || to >= sections.length) return sections;
  const next = [...sections];
  const [s] = next.splice(from, 1);
  next.splice(to, 0, s!);
  return next;
}

/** Words a section puts on the page. */
export const sectionWords = (s: Section): number => sectionTexts(s).reduce((n, t) => n + words(t), 0);

/**
 * The shape of an image, width over height: from its size in pixels, clamped to 1:2 to 2.4:1 so
 * one extreme picture can't take a whole row or column. An image saved before sizes were stored
 * is drawn in a 4:3 frame, uncropped (decision 0024).
 */
export function imageRatio(s: Pick<SectionOf<"image">, "w" | "h">): number {
  if (!s.w || !s.h) return 4 / 3;
  return Math.min(2.4, Math.max(0.5, s.w / s.h));
}

/** The lead image's frame: its shape clamped to 4:3 to 2.2:1, so a portrait poster sits centred on the figure ground rather than running down the page. */
export const leadRatio = (s: Pick<SectionOf<"image">, "w" | "h">): number => Math.min(2.2, Math.max(4 / 3, imageRatio(s)));

/**
 * The hook for a key figure picked from the person's upload (e.g. the best graph in their PDF,
 * decision 0022): the doc with an image section for `fileId` placed where the layout puts its
 * key picture (decision 0024). A case study: straight after "What I found", so the page draws it
 * beside the findings, or first when there are no findings. A gallery: before the first image
 * (it becomes the lead), or last when there is none. Research: before the first graph or image
 * (it becomes the key figure), or last when there is none. A key figure already there for the same
 * file is left alone. Unchanged when the layout has no room for another image. `picked` notes where
 * it came from; publishing then waits for the person's tick (decision 0017).
 */
export function withKeyFigure(
  doc: ExhbtDoc,
  figure: { fileId: string; alt: string; caption?: string; picked?: Picked },
  /** Where it goes when a gallery or research page has no picture or figure to go before. The end, unless said. */
  instead?: number,
): ExhbtDoc {
  const ss = doc.sections;
  const f = formatOf(doc);
  if (ss.some((s) => s.kind === "image" && s.fileId === figure.fileId) || roomFor(ss, "image", f) === 0) return doc;
  const section: SectionOf<"image"> = {
    ...newImageSection(figure.fileId, ss),
    alt: figure.alt,
    caption: text(figure.caption?.trim() ?? ""),
    ...(figure.picked ? { picked: figure.picked } : {}),
  };
  let at: number;
  if (f === "gallery" || f === "research") {
    const first = firstOfKinds(ss, f === "gallery" ? ["image"] : ["graph", "image"]);
    at = first < 0 ? Math.min(Math.max(0, instead ?? ss.length), ss.length) : first;
  } else {
    // Straight after the findings; with none, first, or straight after the flowchart on a doc that has its marker (decision 0027).
    const findings = ss.findIndex((s) => s.kind === "findings");
    at = findings >= 0 ? findings + 1 : ss.findIndex((s) => s.kind === "flow") + 1;
  }
  return { ...doc, sections: [...ss.slice(0, at), section, ...ss.slice(at)] };
}

/** A visual picked from the person's work, ready to go on the exhbt (decisions 0017 and 0025). */
export type WorkVisual = { fileId: string; alt: string; caption?: string; picked?: Picked; kind: FigureKind };

export type WorkVisualResult = {
  /** The doc with the visual on it; the doc as it was when `placed` is false. */
  doc: ExhbtDoc;
  placed: boolean;
  /**
   * Why it wasn't placed: the layout takes nothing from the work, the layout's images are full, or
   * the same picture is already on the exhbt.
   */
  why?: "not-wanted" | "no-room" | "already";
  /** The graph sections the draft made that it took the place of. */
  removed: SectionOf<"graph">[];
};

/** A graph, a chart or a results table from the work is the work's own results figure: it takes the place of a graph the draft drew. */
export const replacesDraftedGraph = (kind: FigureKind): boolean => kind === "graph" || kind === "table";

/**
 * The rule for a visual picked from the person's work (decision 0025): the work's own graph wins.
 *
 *  - The layout says what it takes from the work (`fromWork` in lib/exhbt/formats.ts). One that
 *    takes nothing gets nothing: the doc comes back as it was.
 *  - A graph, a chart or a results table: the graph sections go, then the figure is put where the
 *    layout wants its key figure (withKeyFigure). The exhbt has the real graph and no drawn one.
 *  - Another visual (a photo, a diagram): it is put there too, and the graphs stay while the layout
 *    has room for both. When it hasn't, the picked visual comes first: graphs go, last first,
 *    until it fits. In research a drafted graph that stays is still the key figure, and the picked
 *    visual goes straight after it.
 *  - A person's own pictures are never taken off to make room. A layout whose images are full
 *    leaves the doc, graphs included, as it was.
 *
 * It runs once, straight after the draft and before the editor opens, so every graph on the exhbt
 * is one the draft made. Numbers flagged to check that were only on a graph it removed are no longer
 * on the page, so they leave the list. `opts.wants` is for a layout that isn't in FORMAT_RULES yet.
 * `opts.keepGraphs` places the figure and takes no graph off, for an exhbt the person has edited.
 */
export function withWorkVisual(doc: ExhbtDoc, visual: WorkVisual, opts: { wants?: FromWork; keepGraphs?: boolean } = {}): WorkVisualResult {
  const f = formatOf(doc);
  const wants = opts.wants ?? FORMAT_RULES[f].fromWork;
  const unchanged = (why: NonNullable<WorkVisualResult["why"]>): WorkVisualResult => ({ doc, placed: false, why, removed: [] });
  if (wants === "none") return unchanged("not-wanted");
  if (doc.sections.some((s) => s.kind === "image" && s.fileId === visual.fileId)) return unchanged("already");

  let sections = doc.sections;
  const removed: SectionOf<"graph">[] = [];
  /** Where the first graph taken off was, so the figure can take its place when the layout has nothing else to put it before. */
  let gap: number | undefined;
  const takeOff = (i: number) => {
    removed.unshift(sections[i] as SectionOf<"graph">);
    sections = sections.filter((_, k) => k !== i);
    gap = i;
  };
  const lastGraph = () => sections.reduce((at, s, i) => (s.kind === "graph" ? i : at), -1);
  // keepGraphs: the exhbt has been edited, so any graph on it may be the person's own. Nothing is taken off, and no room is no room.
  if (opts.keepGraphs) {
    // Placed beside what is there, or not at all.
  } else if (replacesDraftedGraph(visual.kind)) {
    for (let i = lastGraph(); i >= 0; i = lastGraph()) takeOff(i);
  } else {
    for (let i = lastGraph(); i >= 0 && roomFor(sections, "image", f) === 0; i = lastGraph()) takeOff(i);
  }
  if (roomFor(sections, "image", f) === 0) return unchanged("no-room");

  const { kind, ...figure } = visual;
  let next = withKeyFigure({ ...doc, sections }, { ...figure, ...(figure.picked ? { picked: { ...figure.picked, kind } } : {}) }, gap);
  // Research reads figure first, and its key figure is the results: a drafted graph stays first and
  // a picked diagram or photo follows it (decided in the build, 19 Nov 2026; open for Rory to confirm). With no graph left, the picked visual leads.
  if (f === "research" && !replacesDraftedGraph(kind)) {
    const image = next.sections.findIndex((s) => s.kind === "image" && s.fileId === visual.fileId);
    const graph = next.sections.findIndex((s) => s.kind === "graph");
    if (image >= 0 && graph > image) next = { ...next, sections: moveSection(next.sections, image, graph) };
  }
  if (!removed.length || !next.unverified) return { doc: next, placed: true, removed };
  // A number can't be normalised only if something else wrote the list; leave what can't be judged.
  const onPage = new Set(numbersInDoc(next).map(normaliseNumber));
  const unverified = next.unverified.filter((n) => normaliseNumber(n) === null || onPage.has(normaliseNumber(n)));
  return { doc: { ...next, unverified }, placed: true, removed };
}

/**
 * What the layout picker tells the person after a switch, and the editor lists under the cards.
 * Pure: every number comes from formatLimits.
 *  - hidden: the kinds the layout keeps but doesn't draw ("Aim or hypothesis").
 *  - over: a drawn kind with more than the layout allows (a publishing error; nothing is hidden).
 *  - missing: what the layout needs that isn't there yet, with the kind to add where one button fixes it.
 */
export function layoutNotes(doc: ExhbtDoc): { hidden: string[]; over: string[]; missing: { text: string; add?: SectionKind }[] } {
  const f = formatOf(doc);
  const L = formatLimits(f);
  const hiddenKinds = new Set(hiddenSections(doc).map(({ s }) => s.kind));
  const hidden = SECTION_KINDS.filter((k) => hiddenKinds.has(k)).map((k) => SECTION_NAMES[k]);
  const over: string[] = [];
  for (const kind of FORMAT_RULES[f].kinds) {
    const n = sectionsOf(doc, kind).length;
    const max = L.sections[kind];
    if (n <= max) continue;
    const name = kind === "image" ? "images" : kind === "graph" ? "graphs" : kind === "link" ? (f === "research" ? "references" : "links") : null;
    over.push(
      name
        ? `This layout shows up to ${max} ${name}; you have ${n}. Remove some before you publish, or switch back.`
        : `This layout has room for ${max} ${sectionName(kind, f).toLowerCase()}; you have ${n}. Remove some before you publish, or switch back.`,
    );
  }
  // Graphs and images together (research): over the cap even when each kind is within its own.
  const figures = sectionsOf(doc, "graph").length + sectionsOf(doc, "image").length;
  if (L.maxFigures !== null && figures > L.maxFigures) {
    over.push(`This layout shows up to ${L.maxFigures} figures, graphs and images together; you have ${figures}. Remove some before you publish, or switch back.`);
  }
  // What the layout needs (its `needs`, in order), then empty findings. A case study lists nothing: the publish check says what it lacks.
  const missing = FORMAT_RULES[f].needs.flatMap((n) => (needMet(doc, n) ? [] : missingOf(n, f)));
  const emptyFindings = sectionsOf(doc, "findings").some((s) => s.items.some((it) => !words(it.map((r) => r.t).join(""))));
  if (f !== "case-study" && emptyFindings) missing.push({ text: "Fill in or remove the empty findings" });
  return { hidden, over, missing };
}

const withArticle = (kind: SectionKind) => (kind === "image" ? "an image" : `a ${SECTION_NAMES[kind].toLowerCase()}`);
const plural = (kind: SectionKind) => (kind === "image" ? "images" : `${SECTION_NAMES[kind].toLowerCase()}s`);

/** One need, as the line the editor lists under "To finish this layout", with the kind to add where one button fixes it. */
function missingOf(n: Need, f: Format): { text: string; add?: SectionKind }[] {
  const plainly = (message: string) => message.replace(/\.$/, "");
  switch (n.need) {
    case "count": {
      const add = n.kinds[0];
      if (n.kinds.length > 1) return [{ text: `Add ${n.kinds.map(withArticle).join(" or ")}`, add }];
      if (n.min > 1) return [{ text: `Add at least ${n.min} ${plural(add!)}`, add }];
      return [{ text: plainly(n.message), add }];
    }
    case "results":
      return f === "case-study" ? [] : [{ text: plainly(n.message) }];
    case "stages":
    case "myRole":
      return [{ text: plainly(n.message) }];
  }
}
