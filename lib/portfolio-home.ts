import { chartsOf, findingsOf, imagesOf, plain, type Chart, type ExhbtDoc } from "./exhbt/blocks";
import { flowShown, formatOf } from "./exhbt/formats";

/**
 * What the portfolio home (Rory's layout spec, 16 Nov 2026; decision 0016) shows of each exhbt:
 * its title, one sentence of what was found, and one key figure. Pure and safe in the browser, so
 * the public page and the builder's live preview pick the same things.
 */

/** The one picture a card or the featured band shows: a graph, else an image, else the process. */
export type KeyFigure =
  | { kind: "chart"; chart: Chart }
  | { kind: "image"; fileId: string; alt: string }
  | { kind: "flow"; steps: string[] };

/** One exhbt as the home page shows it. `imageUrl` is the key figure's signed address when it is an image. */
export type HomeProject = {
  id: string;
  title: string;
  summary: string;
  href: string | null;
  figure: KeyFigure;
  imageUrl?: string | null;
  /** The work (a file or a link) is attached, so the badge can say so. */
  sourceAttached: boolean;
  /** Its skills, for the looks whose top shows them (Notebook's rows, Mono's tags; decision 0018). */
  skills?: string[];
};

/** The person's skills across the exhbts shown, most used first, then in order (for a look's hero). */
export function topSkills(projects: Pick<HomeProject, "skills">[], n: number): string[] {
  const count = new Map<string, number>();
  for (const p of projects) for (const s of p.skills ?? []) if (s.trim()) count.set(s.trim(), (count.get(s.trim()) ?? 0) + 1);
  return [...count.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([s]) => s);
}

/**
 * One sentence for a card: the exhbt's own summary once it has one (the exhbt page's work adds
 * `summary` to the doc), else its first finding.
 */
export function summaryOf(doc: ExhbtDoc): string {
  const own = (doc as ExhbtDoc & { summary?: unknown }).summary;
  if (typeof own === "string" && own.trim()) return own.trim();
  const first = findingsOf(doc)[0];
  return first ? plain(first).trim() : doc.context.trim();
}

export function keyFigureOf(doc: ExhbtDoc): KeyFigure {
  const format = formatOf(doc);
  const image = imagesOf(doc)[0];
  const chart = chartsOf(doc)[0];
  const ofImage = (i: NonNullable<typeof image>): KeyFigure => ({ kind: "image", fileId: i.fileId, alt: i.alt });
  if (format === "gallery") {
    // The lead image, else the graph, else the flow (decision 0024).
    if (image) return ofImage(image);
  } else if (format === "build" || format === "event" || format === "before-after") {
    // The first image (the screenshot, the poster, the first picture), else the graph (decision 0028).
    if (image) return ofImage(image);
    if (chart) return { kind: "chart", chart };
  } else if (format === "research" || format === "essay") {
    // The key figure is the first graph or image in list order.
    const first = doc.sections.find((s) => s.kind === "graph" || s.kind === "image");
    if (first?.kind === "graph") return { kind: "chart", chart: first.chart };
    if (first?.kind === "image") return ofImage(first);
  }
  if (chart) return { kind: "chart", chart };
  if (image) return ofImage(image);
  // The flowchart is the fallback only while it is on the page (decision 0027).
  return { kind: "flow", steps: flowShown(doc) ? doc.flow.map((s) => s.step).filter((s) => s.trim()) : [] };
}

export function homeProject(id: string, doc: ExhbtDoc, href: string | null, imageUrl?: string | null): HomeProject {
  const figure = keyFigureOf(doc);
  return {
    id,
    title: doc.title.trim() || "Untitled exhbt",
    summary: summaryOf(doc),
    href,
    figure,
    imageUrl: figure.kind === "image" ? (imageUrl ?? null) : undefined,
    sourceAttached: Boolean(doc.evidence),
    skills: doc.skills,
  };
}
