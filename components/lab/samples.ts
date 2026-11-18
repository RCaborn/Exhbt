import type { ImageUrls } from "@/components/portfolio/exhbt-parts";
import { text, type RichText, type Section, type SectionOf } from "@/lib/exhbt/blocks";
import type { Format } from "@/lib/exhbt/formats";
import { fullDoc, GALLERY_IMAGES, galleryDoc, openBankingDoc, RESEARCH_IMAGE, researchDoc } from "@/lib/exhbt/sample";

/**
 * The sample exhbts the editor lab works on (/lab/editor). Fictional, from lib/exhbt/sample.ts,
 * held in memory and never saved. Each is put in an order that shows one thing the drag prototype
 * has to cope with: a findings-and-graph pair with a second graph after it, a lead image with six
 * more in a grid, and a figure that comes before the findings it pairs with.
 *
 * A lab doc differs from a stored exhbt in one way: the flowchart is an item in the order like any
 * other section, so it can be dragged. Stored exhbts keep it fixed above the sections.
 */

export const SAMPLE_IDS = ["case-study", "gallery", "research"] as const;
export type SampleId = (typeof SAMPLE_IDS)[number];
export const SAMPLE_NAMES: Record<SampleId, string> = { "case-study": "Case study", gallery: "Gallery", research: "Research" };

/** The flowchart's place in the order. */
export const FLOW_ID = "flow";

export type LabStep = { id: string; step: string; detail?: string };

export type LabDoc = {
  sample: SampleId;
  /** Only for the words a layout uses ("What I found", "Results"); the lab draws every sample the same way. */
  format: Format;
  title: string;
  gap: RichText;
  skills: string[];
  /** "What it is" and "Where and when", in the sidebar. Not editable here. */
  context: string;
  whereWhen: string;
  workLabel: string;
  flow: LabStep[];
  /** Page order: section ids, with FLOW_ID where the flowchart sits. */
  order: string[];
  sections: Record<string, Section>;
  imageUrls: ImageUrls;
};

/**
 * A stand-in picture as a data address: the same flat drawing app/dev/portfolio stores for the
 * seeded gallery (greys, one jade circle, a label), so the lab needs no stored files.
 */
export function placeholderPicture(w: number, h: number, label: string, n: number): string {
  const greys = ["#d9dbe0", "#c3c6cd", "#aeb2ba"];
  const m = Math.min(w, h);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">` +
    `<rect width="${w}" height="${h}" fill="${greys[n % 3]}"/>` +
    `<rect x="${w * 0.1}" y="${h * 0.12}" width="${w * 0.8}" height="${h * 0.5}" fill="#f4f5f7"/>` +
    `<circle cx="${w * 0.7}" cy="${h * 0.37}" r="${m * 0.16}" fill="#00755d"/>` +
    `<rect x="${w * 0.14}" y="${h * 0.7}" width="${w * 0.5}" height="${m * 0.04}" fill="#5b616b"/>` +
    `<rect x="${w * 0.14}" y="${h * 0.78}" width="${w * 0.35}" height="${m * 0.03}" fill="#8a909a"/>` +
    `<text x="${w * 0.14}" y="${h * 0.9}" font-family="sans-serif" font-size="${m * 0.05}" fill="#2b2f36">${label}</text>` +
    `</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

const steps = (flow: { step: string; detail?: string }[]): LabStep[] => flow.map((s, i) => ({ id: `step-${i + 1}`, ...s }));
const byId = (sections: Section[]): Record<string, Section> => Object.fromEntries(sections.map((s) => [s.id, s]));

/** A case study: the flowchart, findings beside a bar graph, a line graph on its own, then a quote, what I'd do next and a link. */
function caseStudy(): LabDoc {
  const d = fullDoc;
  const findings = d.sections.find((s): s is SectionOf<"findings"> => s.kind === "findings")!;
  // Three findings, as the page Rory drew has: the fourth belongs to the print test this doc was written for.
  const sections = d.sections.map((s) => (s.id === findings.id ? { ...findings, items: findings.items.slice(0, 3) } : s));
  return {
    sample: "case-study",
    format: "case-study",
    title: d.title,
    gap: d.gap,
    skills: d.skills,
    context: d.context,
    whereWhen: d.whereWhen ?? "",
    workLabel: d.evidence?.label ?? "",
    // The five boxes of the page Rory drew (fullDoc adds a sixth for the print test).
    flow: steps(openBankingDoc.flow),
    order: [FLOW_ID, "findings", "graph-1", "graph-2", "quote-1", "reflection-1", "link-1"],
    sections: byId(sections),
    imageUrls: {},
  };
}

/**
 * Gallery-like: a lead image, the flowchart, what happened, a link, then six images in a grid and a
 * second link. The flowchart and the first link keep the findings away from the pictures, so the
 * lead stands alone and the six make one run. The lead is the landscape photo, so it isn't a page tall.
 */
function gallery(): LabDoc {
  const pick = [3, 0, 1, 2, 4, 5, 6];
  const ids = pick.map((_, i) => `lab-picture-${i + 1}`);
  const d = galleryDoc(ids);
  const stored = d.sections.filter((s): s is SectionOf<"image"> => s.kind === "image");
  const images: SectionOf<"image">[] = pick.map((from, i) => {
    const im = GALLERY_IMAGES[from]!;
    return { ...stored[i]!, id: `image-${i + 1}`, fileId: ids[i]!, alt: im.alt, caption: text(im.caption), w: im.w, h: im.h };
  });
  const rest = d.sections.filter((s) => s.kind !== "image");
  return {
    sample: "gallery",
    format: "gallery",
    title: d.title,
    gap: d.gap,
    skills: d.skills,
    context: d.context,
    whereWhen: d.whereWhen ?? "",
    workLabel: d.evidence?.label ?? "",
    flow: steps(d.flow),
    order: ["image-1", FLOW_ID, "findings", "link-1", "image-2", "image-3", "image-4", "image-5", "image-6", "image-7", "link-2"],
    sections: byId([...rest, ...images]),
    imageUrls: Object.fromEntries(images.map((im, i) => [im.fileId, placeholderPicture(im.w ?? 1600, im.h ?? 1200, `Picture ${i + 1}`, i)])),
  };
}

/** Research-like: the aim, the flowchart, the key figure beside the results (figure first), the conclusion, a picture, limitations, a reference. */
function research(): LabDoc {
  const fileId = "lab-walking-route";
  const d = researchDoc(fileId);
  return {
    sample: "research",
    format: "research",
    title: d.title,
    gap: d.gap,
    skills: d.skills,
    context: d.context,
    whereWhen: d.whereWhen ?? "",
    workLabel: d.evidence?.label ?? "",
    flow: steps(d.flow),
    order: ["aim-1", FLOW_ID, "graph-1", "findings", "conclusion-1", "image-1", "reflection-1", "link-1"],
    sections: byId(d.sections),
    imageUrls: { [fileId]: placeholderPicture(RESEARCH_IMAGE.w, RESEARCH_IMAGE.h, "Walking route", 1) },
  };
}

export function sampleDoc(id: SampleId): LabDoc {
  return id === "gallery" ? gallery() : id === "research" ? research() : caseStudy();
}

export const isSampleId = (v: unknown): v is SampleId => typeof v === "string" && (SAMPLE_IDS as readonly string[]).includes(v);
