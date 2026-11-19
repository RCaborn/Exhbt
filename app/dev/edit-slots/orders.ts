import { text, type Chart, type ExhbtDoc, type Section } from "../../../lib/exhbt/blocks";
import { GALLERY_IMAGES, galleryDoc, openBankingDoc, researchDoc } from "../../../lib/exhbt/sample";

/*
 * Pages that are not in their layout's usual order: what the edit-on-page editor will write from
 * release 3 (decision 0027), drawn here so the slot harness and its spec cover them in release 2.
 * Each is the sample of its layout rearranged, with the flowchart's marker where the person put it
 * (an arranged doc), or a doc the layout has more of a kind than it allows. Development only.
 */

const FLOW: Section = { id: "flow", kind: "flow" };
const byId = (doc: ExhbtDoc, ids: string[]): Section[] => ids.map((id) => (id === "flow" ? FLOW : doc.sections.find((s) => s.id === id)!));

const gallery = galleryDoc(GALLERY_IMAGES.map((_, i) => `gallery-${i + 1}`));
const research = researchDoc("research-1");

/** A case study with a figure before the findings (a pair drawn in the doc's order, its widths mirrored) and the flowchart below them. */
export const arrangedCase: ExhbtDoc = { ...openBankingDoc, sections: byId(openBankingDoc, ["graph-1", "findings", "flow", "reflection-1"]) };

/** A gallery with the flowchart after "What happened": the pair reversed, the stack first. */
export const arrangedGallery: ExhbtDoc = {
  ...gallery,
  sections: [
    ...byId(gallery, ["image-1", "findings"]),
    { id: "graph-1", kind: "graph", chart: { kind: "bar", title: "Sign-ups by year", rows: [{ label: "Last year", value: 64 }, { label: "This year", value: 112 }] } as Chart },
    FLOW,
    ...byId(gallery, ["image-2", "image-3", "image-4", "link-1"]),
  ],
};

/** A gallery whose flowchart was taken off the page (flowOff, no marker): "What happened" on its own. */
export const galleryFlowOff: ExhbtDoc = { ...gallery, flowOff: true, sections: byId(gallery, ["image-1", "findings", "image-2", "image-3", "link-1", "link-2"]) };

/** A gallery with two graphs where it allows one: nothing is hidden, so the second is a plain row of its own (decision 0024). */
export const galleryOverCap: ExhbtDoc = {
  ...gallery,
  sections: [
    ...byId(gallery, ["findings"]),
    { id: "graph-1", kind: "graph", chart: { kind: "bar", title: "Sign-ups by year", rows: [{ label: "Last year", value: 64 }, { label: "This year", value: 112 }] } as Chart },
    { id: "graph-2", kind: "graph", chart: { kind: "bar", title: "Sign-ups by course", rows: [{ label: "Law", value: 71 }, { label: "Other", value: 41 }] } as Chart },
    ...byId(gallery, ["image-1", "image-2", "image-3"]),
  ],
};

/** Research with the key figure before the method, the hypothesis after the flowchart, and the limitations before the conclusion. */
export const arrangedResearch: ExhbtDoc = { ...research, sections: byId(research, ["graph-1", "flow", "aim-1", "image-1", "findings", "reflection-1", "conclusion-1", "link-1"]) };

/** Research as stored by today's editor, its aim not written yet: the visitor's page leaves the aim out, the editing page shows its placeholder. */
export const researchNoAim: ExhbtDoc = { ...research, sections: research.sections.map((s) => (s.kind === "aim" ? { ...s, text: [] } : s)) };

/**
 * Agent B's edge case: an arranged case study (graph, findings, image) whose image has no file. The
 * visitor's page leaves the image out before it pairs anything, so the graph and the findings are a
 * pair in the doc's order, the graph first; the editing page draws the image's place, so there the
 * graph is alone and the findings pair with the image. Drawn in the harness to look at; not in the
 * box tests, where the two pages rightly differ.
 */
export const caseMissingImage: ExhbtDoc = {
  ...openBankingDoc,
  sections: [
    FLOW,
    ...byId(openBankingDoc, ["graph-1", "findings"]),
    { id: "image-1", kind: "image", fileId: "", alt: "A chart from the dissertation.", caption: text("The model's phase diagram"), w: 1600, h: 1000 },
    ...byId(openBankingDoc, ["reflection-1"]),
  ],
};
