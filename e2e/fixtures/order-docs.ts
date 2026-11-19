import { SCHEMA_VERSION, text, type Chart, type ExhbtDoc, type Section } from "../../lib/exhbt/blocks";
import { fullDoc, GALLERY_IMAGES, galleryDoc, legacyGpDoc, libraryDoc, openBankingDoc, researchDoc } from "../../lib/exhbt/sample";

/**
 * The parity gate's fixtures (decision 0027, "The parity gate", step 2): the samples and docs whose
 * sections sit in orders today's pages pair in a particular way. Plain docs as today's code stores
 * them (no flowchart marker), so they are drawn the same on main's live commit and on the release
 * branch. e2e/layout-parity.spec.ts seeds each through POST /dev/parity and compares its page with
 * a golden copy; e2e/layout-model.spec.ts checks the engine against what is written beside each.
 *
 * This file must import nothing the release adds (it runs on main too), so the order and the rows
 * are written as strings:
 *  - `adopt`: the ids of adopt(doc).sections in order, "flow" for the marker. No skip.
 *  - `rows`: the rows the read-only page draws, with `skip` left out first:
 *      `id` or `id:as`             one item on its own row ("plain" is not written)
 *      `name[a, b]`                a stack on its own row (its items are drawn "stacked")
 *      `of[a, b:as]`               a group
 *      `ratio(left, right)`        a pair in the doc's order; `ratio~(…)` when reversed
 *  - `skip`: the sections the read-only page leaves out (an image with no address, an aim or a
 *    conclusion with no words), as today's page does before it pairs anything.
 * An image with `fileId: ""` gets no picture from /dev/parity, so the page has no address for it.
 */
export type OrderFixture = { name: string; doc: unknown; adopt: string[]; rows: string[]; skip?: string[] };

const bar = (title: string, values: [string, number][]): Chart => ({ kind: "bar", title, unit: "%", rows: values.map(([label, value]) => ({ label, value })) }) as Chart;

const findings = (): Section => ({
  id: "findings",
  kind: "findings",
  items: [text("Waits at the till fell from 11 minutes to 4."), text("Sales at lunch held steady in both weeks.")],
});
const graph = (n: number): Section => ({ id: `graph-${n}`, kind: "graph", chart: bar(`Queue time by week ${n} (%)`, [["Week one", 40 + n], ["Week two", 20 + n]]) });
const image = (n: number, opts: { noAddress?: boolean; w?: number; h?: number } = {}): Section => ({
  id: `image-${n}`,
  kind: "image",
  fileId: opts.noAddress ? "" : "parity",
  alt: `Picture ${n} of the cafe queue.`,
  caption: text(`The queue at lunch, picture ${n}`),
  ...(opts.w && opts.h ? { w: opts.w, h: opts.h } : {}),
});
const quote = (): Section => ({ id: "quote-1", kind: "quote", text: "The second till made lunch calmer for everyone.", name: "Sam Patel", role: "Cafe manager" });
const reflection = (): Section => ({ id: "reflection-1", kind: "reflection", text: text("Next I'd time the evening queue too.") });
const link = (n = 1): Section => ({ id: `link-${n}`, kind: "link", href: `https://example.com/queue-${n}`, label: `Queue data ${n}`, description: "The timings, week by week" });
const aim = (words = true): Section => ({ id: "aim-1", kind: "aim", heading: "aim", text: words ? text("To find out whether a second till cuts the lunch queue.") : [] });
const conclusion = (): Section => ({ id: "conclusion-1", kind: "conclusion", text: text("A second till cut the wait by more than half.") });

function doc(sections: Section[], format?: "gallery" | "research"): ExhbtDoc {
  return {
    schemaVersion: SCHEMA_VERSION,
    ...(format ? { format } : {}),
    title: "Would a second till cut the lunch queue?",
    context: "Year 2 operations module",
    whereWhen: "Campus cafe, May 2026",
    skills: ["Excel", "Timing studies"],
    gap: [{ t: "Queues ran long at lunch. " }, { t: "Would a second till help?", b: true }],
    flow: [{ step: "Timed the queue" }, { step: "Added a second till" }, { step: "Timed it again" }],
    sections,
  };
}

export const ORDER_FIXTURES: OrderFixture[] = [
  {
    name: "order-figure-before-findings",
    doc: doc([graph(1), findings()]),
    adopt: ["flow", "findings", "graph-1"],
    rows: ["flow", "found(findings, graph-1)"],
  },
  {
    name: "order-two-graphs-before-findings",
    doc: doc([graph(1), graph(2), findings()]),
    adopt: ["flow", "graph-1", "graph-2", "findings"],
    rows: ["flow", "graphs[graph-1, graph-2]", "findings"],
  },
  {
    name: "order-image-graph-findings",
    doc: doc([image(1), graph(1), findings()]),
    adopt: ["flow", "image-1", "findings", "graph-1"],
    rows: ["flow", "images[image-1]", "found(findings, graph-1)"],
  },
  {
    name: "order-graph-image-findings",
    doc: doc([graph(1), image(1), findings()]),
    adopt: ["flow", "graph-1", "findings", "image-1"],
    rows: ["flow", "graphs[graph-1]", "found(findings, image-1)"],
  },
  {
    // Today's page drops the image before it pairs, so the graph pairs with the findings.
    name: "order-graph-no-address-findings",
    doc: doc([graph(1), image(1, { noAddress: true }), findings()]),
    skip: ["image-1"],
    adopt: ["flow", "graph-1", "findings", "image-1"],
    rows: ["flow", "found(findings, graph-1)"],
  },
  {
    // A figure on each side of the findings: today the one before pairs, and the one after stands alone.
    name: "order-graph-findings-image",
    doc: doc([graph(1), findings(), image(1)]),
    adopt: ["flow", "findings", "graph-1", "image-1"],
    rows: ["flow", "found(findings, graph-1)", "images[image-1]"],
  },
  {
    name: "order-case-mixed",
    doc: doc([quote(), image(1, { w: 1600, h: 1200 }), image(2), findings(), graph(1), reflection(), link()]),
    adopt: ["flow", "quote-1", "image-1", "image-2", "findings", "graph-1", "reflection-1", "link-1"],
    rows: ["flow", "quote-1", "images[image-1, image-2]", "found(findings, graph-1)", "reflection-1", "link-1"],
  },
  {
    name: "order-gallery-no-findings",
    doc: doc([image(1, { w: 1200, h: 1600 }), image(2, { w: 1600, h: 1200 }), image(3, { w: 1080, h: 1080 }), reflection(), link()], "gallery"),
    adopt: ["image-1", "flow", "image-2", "image-3", "reflection-1", "link-1"],
    rows: ["image-1:lead", "flow", "grid[image-2:tile, image-3:tile]", "reflection-1", "links[link-1]"],
  },
  {
    name: "order-gallery-out-of-order",
    doc: doc([link(), reflection(), image(1, { w: 2400, h: 800 }), findings(), image(2, { w: 1080, h: 1920 }), graph(1), quote(), image(3)], "gallery"),
    adopt: ["image-1", "flow", "findings", "graph-1", "image-2", "image-3", "quote-1", "reflection-1", "link-1"],
    rows: ["image-1:lead", "even(flow:stacked, happened[findings, graph-1])", "grid[image-2:tile, image-3:tile]", "quote-1", "reflection-1", "links[link-1]"],
  },
  {
    name: "order-gallery-graph-only",
    doc: doc([graph(1), image(1, { w: 1600, h: 1200 }), image(2, { w: 1200, h: 1600 })], "gallery"),
    adopt: ["image-1", "flow", "graph-1", "image-2"],
    rows: ["image-1:lead", "even(flow:stacked, happened[graph-1])", "grid[image-2:tile]"],
  },
  {
    name: "order-research-no-figure",
    doc: doc([findings(), aim(), link(), conclusion()], "research"),
    adopt: ["aim-1", "flow", "findings", "conclusion-1", "link-1"],
    rows: ["method[aim-1, flow]", "even(findings:kicker, closing[conclusion-1])", "refs[link-1:listed]"],
  },
  {
    // An image is the key figure; the aim has no words, so the page leaves it out.
    name: "order-research-image-key",
    doc: doc([reflection(), image(1, { w: 1600, h: 1100 }), aim(false), graph(1), quote()], "research"),
    skip: ["aim-1"],
    adopt: ["aim-1", "flow", "image-1", "graph-1", "reflection-1", "quote-1"],
    rows: ["key(method[flow], image-1:key)", "figures[graph-1]", "closing[reflection-1]", "quote-1"],
  },
];

/** The flowchart steps app/dev/portfolio gives its five- and six-box case studies. */
const SIX = ["Define bank and fintech strategies", "Set payoff matrix with openness parameter", "Derive replicator equations and rest points", "Classify stability of each equilibrium", "Select outcome via risk dominance", "Compare with the mandate's aims"];
const OPEN_BANKING_ROWS = ["flow", "found(findings, graph-1)", "reflection-1"];

/** Every sample the seeds use (lib/exhbt/sample.ts), as /dev/portfolio stores them, with what the engine should make of each. */
export const SAMPLE_FIXTURES: OrderFixture[] = [
  // The GP exhbt stays in the layout from before sections, in both copies, as the seed stores it.
  { name: "sample-gp-old", doc: legacyGpDoc, adopt: ["flow", "findings", "graph-1"], rows: ["flow", "found(findings, graph-1)"] },
  { name: "sample-library", doc: libraryDoc, adopt: ["flow", "findings"], rows: ["flow", "findings"] },
  { name: "sample-open-banking", doc: openBankingDoc, adopt: ["flow", "findings", "graph-1", "reflection-1"], rows: OPEN_BANKING_ROWS },
  {
    name: "sample-full",
    doc: fullDoc,
    adopt: ["flow", "findings", "graph-1", "graph-2", "quote-1", "reflection-1", "link-1"],
    rows: ["flow", "found(findings, graph-1)", "graphs[graph-2]", "quote-1", "reflection-1", "link-1"],
  },
  ...([6, 5] as const).map((n) => ({
    name: n === 6 ? "sample-flow-six" : "sample-flow-five",
    doc: { ...openBankingDoc, title: `Flowchart with ${n} boxes`, flow: (n === 6 ? SIX : SIX.slice(1)).map((step) => ({ step })) },
    adopt: ["flow", "findings", "graph-1", "reflection-1"],
    rows: OPEN_BANKING_ROWS,
  })),
  {
    name: "sample-gallery",
    doc: galleryDoc(GALLERY_IMAGES.map(() => "parity")),
    adopt: ["image-1", "flow", "findings", ...GALLERY_IMAGES.slice(1).map((_, i) => `image-${i + 2}`), "link-1", "link-2"],
    rows: [
      "image-1:lead",
      "even(flow:stacked, happened[findings])",
      `grid[${GALLERY_IMAGES.slice(1).map((_, i) => `image-${i + 2}:tile`).join(", ")}]`,
      "links[link-1, link-2]",
    ],
  },
  {
    name: "sample-research",
    doc: researchDoc("parity"),
    adopt: ["aim-1", "flow", "graph-1", "image-1", "findings", "conclusion-1", "reflection-1", "link-1"],
    rows: ["key(method[aim-1, flow], graph-1:key)", "figures[image-1]", "even(findings:kicker, closing[conclusion-1, reflection-1])", "refs[link-1:listed]"],
  },
];

/* ---------------- Today's pages, frozen ---------------- */

/*
 * What today's pages draw below the context line, as row strings, given the sections each page
 * draws (the layout's kinds, with an image with no address and an aim or a conclusion with no
 * words already left out). Copied from the base commit of release 2: runsOf in
 * components/portfolio/ProjectView.tsx, and GalleryMain and ResearchMain in
 * components/portfolio/formats/. Those go in release 2 (decision 0027); these copies stay, so the
 * model test can check the engine against every order, not only the fixtures above.
 */

const isFigure = (s: Section | undefined) => s?.kind === "graph" || s?.kind === "image";
const present = (list: (Section | undefined)[]): Section[] => list.filter((s): s is Section => s !== undefined);

/** A case study: the flowchart, then runsOf's runs. A findings-and-figure run is drawn findings first. */
export function todayCaseRows(shown: Section[]): string[] {
  type Run = { kind: "found"; findings: string; figure: string } | { kind: "graphs" | "images"; items: string[] } | { kind: "one"; id: string };
  const out: Run[] = [];
  for (let i = 0; i < shown.length; i++) {
    const s = shown[i]!;
    const next = shown[i + 1];
    const last = out[out.length - 1];
    if (s.kind === "findings" && isFigure(next)) {
      out.push({ kind: "found", findings: s.id, figure: next!.id });
      i++;
    } else if (isFigure(s) && next?.kind === "findings" && !(last?.kind === "graphs" && s.kind === "graph") && !(last?.kind === "images" && s.kind === "image")) {
      out.push({ kind: "found", findings: next.id, figure: s.id });
      i++;
    } else if (s.kind === "graph") {
      if (last?.kind === "graphs") last.items.push(s.id);
      else out.push({ kind: "graphs", items: [s.id] });
    } else if (s.kind === "image") {
      if (last?.kind === "images") last.items.push(s.id);
      else out.push({ kind: "images", items: [s.id] });
    } else out.push({ kind: "one", id: s.id });
  }
  return [
    "flow",
    ...out.map((r) => (r.kind === "found" ? `found(${r.findings}, ${r.figure})` : r.kind === "one" ? r.id : `${r.kind}[${r.items.join(", ")}]`)),
  ];
}

/** A gallery: the lead image, "What I did" beside "What happened", the other pictures, the quote, what I'd do next, the links. */
export function todayGalleryRows(shown: Section[]): string[] {
  const images = shown.filter((s) => s.kind === "image");
  const findings = shown.find((s) => s.kind === "findings");
  const graph = shown.find((s) => s.kind === "graph");
  const quote = shown.find((s) => s.kind === "quote");
  const reflection = shown.find((s) => s.kind === "reflection");
  const links = shown.filter((s) => s.kind === "link");
  const happened = present([findings, graph]);
  return [
    ...(images[0] ? [`${images[0].id}:lead`] : []),
    happened.length ? `even(flow:stacked, happened[${happened.map((s) => s.id).join(", ")}])` : "flow",
    ...(images.length > 1 ? [`grid[${images.slice(1).map((s) => `${s.id}:tile`).join(", ")}]`] : []),
    ...(quote ? [quote.id] : []),
    ...(reflection ? [reflection.id] : []),
    ...(links.length ? [`links[${links.map((s) => s.id).join(", ")}]`] : []),
  ];
}

/** Research: the aim and the method beside the key figure, the other figures, the results beside the conclusion and limitations, the quote, the references. */
export function todayResearchRows(shown: Section[]): string[] {
  const figures = shown.filter((s) => isFigure(s));
  const [key, ...more] = figures;
  const aim = shown.find((s) => s.kind === "aim");
  const findings = shown.find((s) => s.kind === "findings");
  const closing = present([shown.find((s) => s.kind === "conclusion"), shown.find((s) => s.kind === "reflection")]);
  const quote = shown.find((s) => s.kind === "quote");
  const refs = shown.filter((s) => s.kind === "link");
  const method = `method[${[...(aim ? [aim.id] : []), "flow"].join(", ")}]`;
  const stack = `closing[${closing.map((s) => s.id).join(", ")}]`;
  return [
    key ? `key(${method}, ${key.id}:key)` : method,
    ...(more.length ? [`figures[${more.map((s) => s.id).join(", ")}]`] : []),
    ...(findings && closing.length ? [`even(${findings.id}:kicker, ${stack})`] : findings ? [`${findings.id}:kicker`] : closing.length ? [stack] : []),
    ...(quote ? [quote.id] : []),
    ...(refs.length ? [`refs[${refs.map((s) => `${s.id}:listed`).join(", ")}]`] : []),
  ];
}
