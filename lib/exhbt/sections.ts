import { LIMITS, sectionTexts, text, words, type ExhbtDoc, type Section, type SectionKind, type SectionOf } from "./blocks";
import { newChart } from "./charts";

/**
 * Adding, naming and moving the sections below the flowchart (decision 0015). Pure, so the
 * editor, the AI draft and the tests share it. The schema and limits are lib/exhbt/blocks.ts.
 */

/** What a section is called in the editor; graphs and images also get a number (sectionLabel). */
export const SECTION_NAMES: Record<SectionKind, string> = {
  findings: "Findings",
  graph: "Graph",
  image: "Image",
  quote: "Quote",
  reflection: "What I'd do next",
  link: "Link",
};

/** "Graph 2", "Image 1", "Findings", "Quote": the section's name, numbered when there can be two. */
export function sectionLabel(sections: Section[], i: number): string {
  const s = sections[i];
  if (!s) return "";
  if (LIMITS.sections[s.kind] === 1) return SECTION_NAMES[s.kind];
  const n = sections.slice(0, i + 1).filter((x) => x.kind === s.kind).length;
  return `${SECTION_NAMES[s.kind]} ${n}`;
}

/** How many more of a kind there's room for. */
export const roomFor = (sections: Section[], kind: SectionKind): number => Math.max(0, LIMITS.sections[kind] - sections.filter((s) => s.kind === kind).length);

/** The first free id for a new section of a kind: "quote-1", "graph-2". */
export function nextSectionId(kind: SectionKind, sections: Section[]): string {
  const taken = new Set(sections.map((s) => s.id));
  for (let n = 1; ; n++) if (!taken.has(`${kind}-${n}`)) return `${kind}-${n}`;
}

/** A new, empty section of a kind (an image needs its uploaded file, so it's made with newImageSection). */
export function newSection(kind: Exclude<SectionKind, "image">, sections: Section[]): Section {
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
  }
}

export const newImageSection = (fileId: string, sections: Section[]): SectionOf<"image"> => ({ id: nextSectionId("image", sections), kind: "image", fileId, alt: "", caption: [] });

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
 * The hook for a key figure picked from the person's upload (e.g. the best graph in their PDF,
 * decision 0022): the doc with an image section for `fileId` placed straight after "What I
 * found", so the page draws it beside the findings, or first when there are no findings. A key
 * figure already there for the same file is left alone. Unchanged when both image slots are used.
 */
export function withKeyFigure(doc: ExhbtDoc, figure: { fileId: string; alt: string; caption?: string }): ExhbtDoc {
  const ss = doc.sections;
  if (ss.some((s) => s.kind === "image" && s.fileId === figure.fileId) || roomFor(ss, "image") === 0) return doc;
  const section: SectionOf<"image"> = { ...newImageSection(figure.fileId, ss), alt: figure.alt, caption: text(figure.caption?.trim() ?? "") };
  const at = ss.findIndex((s) => s.kind === "findings") + 1;
  return { ...doc, sections: [...ss.slice(0, at), section, ...ss.slice(at)] };
}
