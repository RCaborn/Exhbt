import { ChartBar, Flag, ImageIcon, Lightbulb, Link2, ListChecks, Quote, Target, Workflow, type LucideIcon } from "lucide-react";
import { formatLimits, text, type Section, type SectionKind } from "@/lib/exhbt/blocks";
import { FORMAT_RULES, type Format } from "@/lib/exhbt/formats";
import { nextSectionId, roomFor, sectionName } from "@/lib/exhbt/sections";
import { FLOW_ID, placeholderPicture, type LabDoc } from "./samples";

/**
 * The blocks that can be added to the lab's page: every kind of section a real exhbt can hold, and
 * the flowchart when it has been taken off the page. The "+" between sections and the tray both
 * read this, so they always offer the same things.
 *
 * What is allowed, and how many, are the product's own rules: the kinds a layout draws
 * (FORMAT_RULES in lib/exhbt/formats.ts) and the room left for each (roomFor in
 * lib/exhbt/sections.ts, which reads formatLimits). Nothing is counted here by hand.
 */

export type BlockKind = SectionKind | "flow";

const ICONS: Record<BlockKind, LucideIcon> = {
  findings: ListChecks,
  graph: ChartBar,
  image: ImageIcon,
  quote: Quote,
  reflection: Lightbulb,
  link: Link2,
  aim: Target,
  conclusion: Flag,
  flow: Workflow,
};

export const blockIcon = (kind: BlockKind): LucideIcon => ICONS[kind];

/** The order the editor's own Add menu uses (menuFor in components/editor/Sections.tsx): research reads aim first and the conclusion after the figures. */
const ORDER: Record<Format, SectionKind[]> = {
  "case-study": ["findings", "graph", "image", "quote", "reflection", "link"],
  gallery: ["findings", "graph", "image", "quote", "reflection", "link"],
  research: ["aim", "findings", "graph", "image", "conclusion", "quote", "reflection", "link"],
};

const IN: Record<Format, string> = { "case-study": "in a case study", gallery: "in a gallery", research: "in research" };

/** What a kind is called when saying how many there can be: "Up to 2 images", "One quote". */
function noun(kind: SectionKind, f: Format): [one: string, many: string] {
  switch (kind) {
    case "findings":
      return f === "research" ? ["set of results", "sets of results"] : ["set of findings", "sets of findings"];
    case "graph":
      return ["graph", "graphs"];
    case "image":
      return ["image", "images"];
    case "quote":
      return ["quote", "quotes"];
    case "reflection":
      return f === "research" ? ["note on limitations and next steps", "notes on limitations and next steps"] : ["note on what you'd do next", "notes on what you'd do next"];
    case "link":
      return f === "research" ? ["reference", "references"] : ["link", "links"];
    case "aim":
      return ["aim or hypothesis", "aims"];
    case "conclusion":
      return ["conclusion", "conclusions"];
  }
}

/** The sections on the page, in order (the flowchart is not one of them). */
export const onPage = (doc: LabDoc): Section[] => doc.order.filter((id) => id !== FLOW_ID && doc.sections[id]).map((id) => doc.sections[id]!);

/** Why a kind can't be added, in plain words ("Up to 2 images in a case study"), or undefined when there is room. */
export function whyFull(doc: LabDoc, kind: BlockKind): string | undefined {
  if (kind === "flow") return doc.order.includes(FLOW_ID) ? "The flowchart is already on the page" : undefined;
  const f = doc.format;
  const sections = onPage(doc);
  if (roomFor(sections, kind, f) > 0) return undefined;
  const L = formatLimits(f);
  const max = L.sections[kind];
  const have = sections.filter((s) => s.kind === kind).length;
  // Research caps graphs and images together; say that when it is the cap that was hit.
  if (L.maxFigures !== null && (kind === "graph" || kind === "image") && have < max) return `Up to ${L.maxFigures} graphs and images together ${IN[f]}`;
  const [one, many] = noun(kind, f);
  return max === 1 ? `One ${one} ${IN[f]}` : `Up to ${max} ${many} ${IN[f]}`;
}

export type BlockOption = { kind: BlockKind; name: string; icon: LucideIcon; /** Why it can't be added; undefined when it can. */ full?: string };

/** What the "+" menu and the tray offer for this page: the layout's kinds, each with room or the reason there is none; then the flowchart if it is off the page. */
export function blockOptions(doc: LabDoc): BlockOption[] {
  const f = doc.format;
  const kinds = ORDER[f].filter((k) => FORMAT_RULES[f].kinds.includes(k));
  const out: BlockOption[] = kinds.map((kind) => ({ kind, name: sectionName(kind, f), icon: ICONS[kind], full: whyFull(doc, kind) }));
  if (!doc.order.includes(FLOW_ID)) out.push({ kind: "flow", name: "Flowchart", icon: ICONS.flow });
  return out;
}

export const blockName = (doc: LabDoc, kind: BlockKind): string => (kind === "flow" ? "Flowchart" : sectionName(kind, doc.format));

/** A block ready to go on the page: the flowchart, or a new section with believable words in it (and its picture, for an image). */
export type Draft = { id: string; kind: BlockKind; section?: Section; picture?: { fileId: string; url: string } };

/**
 * A new block of a kind, filled in so the page still reads as an exhbt: a small sample graph, a
 * placeholder picture with a caption, a line of words where words go. Null when there is no room.
 */
export function draftBlock(doc: LabDoc, kind: BlockKind): Draft | null {
  if (whyFull(doc, kind)) return null;
  if (kind === "flow") return { id: FLOW_ID, kind };
  const id = nextSectionId(kind, Object.values(doc.sections));
  switch (kind) {
    case "findings":
      return { id, kind, section: { id, kind, items: [text("The first thing you found, in one plain line."), text("The second, with a figure if you have one.")] } };
    case "graph":
      return {
        id,
        kind,
        section: {
          id,
          kind,
          chart: {
            kind: "bar",
            title: "A sample graph (%)",
            unit: "%",
            highlight: 0,
            rows: [
              { label: "First", value: 48 },
              { label: "Second", value: 36 },
              { label: "Third", value: 22 },
            ],
          },
        },
      };
    case "image": {
      const fileId = `lab-${id}`;
      const n = Object.values(doc.sections).filter((s) => s.kind === "image").length;
      return {
        id,
        kind,
        section: { id, kind, fileId, alt: "A placeholder picture: grey shapes and a green circle.", caption: text("What the picture shows"), w: 1600, h: 1200 },
        picture: { fileId, url: placeholderPicture(1600, 1200, "Placeholder", n) },
      };
    }
    case "quote":
      return { id, kind, section: { id, kind, text: "What they said about the work, in their own words.", name: "Their name", role: "their role" } };
    case "reflection":
      return { id, kind, section: { id, kind, text: text("What you would do next, or do differently, in a line or two.") } };
    case "link":
      return { id, kind, section: { id, kind, href: "https://example.com/your-work", label: "A link to the work", description: "What it is, in a few words" } };
    case "aim":
      return { id, kind, section: { id, kind, heading: "aim", text: text("What the study set out to test, in one line.") } };
    case "conclusion":
      return { id, kind, section: { id, kind, text: text("What the work concludes, in one line.") } };
  }
}
