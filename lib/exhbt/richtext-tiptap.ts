import { safeHref, type RichText, type Run } from "./blocks";

/**
 * Converts between our stored text runs (lib/exhbt/blocks.ts) and the JSON the Tiptap editor
 * works with. One paragraph per field; bold, italic and https links only (decision 0007).
 * Pure, with no Tiptap import, so the server and the tests can use it too.
 */

type Mark = { type: string; attrs?: Record<string, unknown> };
export type TiptapNode = { type: string; text?: string; marks?: Mark[]; content?: TiptapNode[]; attrs?: Record<string, unknown> };

export function runsToDoc(runs: RichText): TiptapNode {
  const content: TiptapNode[] = runs
    .filter((r) => r.t.length > 0)
    .map((r) => {
      const marks: Mark[] = [];
      if (r.b) marks.push({ type: "bold" });
      if (r.i) marks.push({ type: "italic" });
      const href = safeHref(r.href);
      if (href) marks.push({ type: "link", attrs: { href } });
      return marks.length ? { type: "text", text: r.t, marks } : { type: "text", text: r.t };
    });
  return { type: "doc", content: [content.length ? { type: "paragraph", content } : { type: "paragraph" }] };
}

/** Back to runs. Paragraphs (from a paste) join with a space; links that aren't https are dropped. */
export function docToRuns(doc: TiptapNode | null | undefined): RichText {
  const out: Run[] = [];
  const paragraphs = (doc?.content ?? []).filter((n) => n.type === "paragraph");
  paragraphs.forEach((p, pi) => {
    if (pi > 0) push(out, { t: " " });
    for (const n of p.content ?? []) {
      if (n.type === "hardBreak") push(out, { t: " " });
      if (n.type !== "text" || !n.text) continue;
      const run: Run = { t: n.text };
      for (const m of n.marks ?? []) {
        if (m.type === "bold") run.b = true;
        if (m.type === "italic") run.i = true;
        if (m.type === "link") {
          const href = safeHref(typeof m.attrs?.href === "string" ? m.attrs.href : undefined);
          if (href) run.href = href;
        }
      }
      push(out, run);
    }
  });
  // A field that's only spaces is empty.
  return out.every((r) => !r.t.trim()) ? [] : out;
}

/** Adds a run, merging it into the last one when the formatting is the same. */
function push(out: Run[], run: Run) {
  const last = out[out.length - 1];
  if (last && Boolean(last.b) === Boolean(run.b) && Boolean(last.i) === Boolean(run.i) && last.href === run.href) {
    last.t += run.t;
    return;
  }
  out.push(run);
}

/** Same text and formatting, ignoring how it's split into runs. */
export function sameRuns(a: RichText, b: RichText): boolean {
  return JSON.stringify(docToRuns(runsToDoc(a))) === JSON.stringify(docToRuns(runsToDoc(b)));
}
