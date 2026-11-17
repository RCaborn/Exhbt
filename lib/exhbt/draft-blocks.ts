import { emptyDoc, findingsOf, plain, type ExhbtDoc, type FlowStep, type RichText } from "./blocks";
import { normaliseNumber, numbersIn, numbersInDoc, unverifiedNumbers } from "./verify";

/**
 * The parts of an exhbt the AI drafts, and so the parts it can rewrite or be undone to
 * (docs/phase-2.md section 6). Pure, so the editor, the server actions and the tests share it.
 * Graphs, images, the other sections and the evidence link are not here: the person adds those.
 * "findings" is the findings section (decision 0015), wherever it sits.
 */

export const DRAFT_BLOCKS = ["header", "gap", "flow", "findings", "skills"] as const;
export type DraftBlock = (typeof DRAFT_BLOCKS)[number];
export const isDraftBlock = (v: unknown): v is DraftBlock => typeof v === "string" && (DRAFT_BLOCKS as readonly string[]).includes(v);

/** What a person calls each part: "Rewrite the process", "Back to the AI version of the findings". */
export const BLOCK_NAMES: Record<DraftBlock, string> = {
  header: "title",
  gap: "context",
  flow: "process",
  findings: "findings",
  skills: "skills",
};

export type BlockValues = {
  /** whereWhen and summary are missing from AI versions kept before decision 0022; applyBlock then leaves the doc's own. */
  header: { title: string; context: string; whereWhen?: string; summary?: string; headline?: { value: string; label: string } };
  gap: RichText;
  flow: FlowStep[];
  findings: RichText[];
  skills: string[];
};
export type BlockValue<K extends DraftBlock = DraftBlock> = BlockValues[K];

/** The latest AI version of each block, and the numbers in it that weren't in the source. */
export type AiVersion = {
  blocks: { [K in DraftBlock]?: BlockValues[K] };
  unverified: { [K in DraftBlock]?: string[] };
};

export const emptyAiVersion = (): AiVersion => ({ blocks: {}, unverified: {} });

export function blockValue<K extends DraftBlock>(doc: ExhbtDoc, key: K): BlockValues[K];
export function blockValue(doc: ExhbtDoc, key: DraftBlock): BlockValue {
  switch (key) {
    case "header":
      return {
        title: doc.title,
        context: doc.context,
        ...(doc.whereWhen !== undefined ? { whereWhen: doc.whereWhen } : {}),
        ...(doc.summary !== undefined ? { summary: doc.summary } : {}),
        ...(doc.headline ? { headline: doc.headline } : {}),
      };
    case "gap":
      return doc.gap;
    case "flow":
      return doc.flow;
    case "findings":
      return findingsOf(doc);
    case "skills":
      return doc.skills;
  }
}

/** The doc with the findings section's bullets replaced; one is added straight after the flowchart if there's none. */
function withFindings(doc: ExhbtDoc, items: RichText[]): ExhbtDoc {
  if (doc.sections.some((s) => s.kind === "findings")) {
    return { ...doc, sections: doc.sections.map((s) => (s.kind === "findings" ? { ...s, items } : s)) };
  }
  const id = doc.sections.some((s) => s.id === "findings") ? `findings-${doc.sections.length + 1}` : "findings";
  return { ...doc, sections: [{ id, kind: "findings", items }, ...doc.sections] };
}

export function applyBlock<K extends DraftBlock>(doc: ExhbtDoc, key: K, value: BlockValues[K]): ExhbtDoc;
export function applyBlock(doc: ExhbtDoc, key: DraftBlock, value: BlockValue): ExhbtDoc {
  switch (key) {
    case "header": {
      const v = value as BlockValues["header"];
      // Rewrites no longer write a headline number (decision 0022), so one the doc has is kept unless the value brings its own.
      const { headline: _old, ...rest } = doc;
      void _old;
      const headline = v.headline ?? doc.headline;
      return {
        ...rest,
        title: v.title,
        context: v.context,
        ...(v.whereWhen !== undefined ? { whereWhen: v.whereWhen } : {}),
        ...(v.summary !== undefined ? { summary: v.summary } : {}),
        ...(headline ? { headline } : {}),
      };
    }
    case "gap":
      return { ...doc, gap: value as RichText };
    case "flow":
      return { ...doc, flow: value as FlowStep[] };
    case "findings":
      return withFindings(doc, value as RichText[]);
    case "skills":
      return { ...doc, skills: value as string[] };
  }
}

/** Same words, same order, same formatting. */
export const sameBlock = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

/** Every block's AI version from a freshly drafted doc. */
export function aiVersionOf(doc: ExhbtDoc, source: string, extraUnverified: string[] = []): AiVersion {
  const out = emptyAiVersion();
  for (const key of DRAFT_BLOCKS) {
    (out.blocks as Record<string, unknown>)[key] = structuredClone(blockValue(doc, key));
    out.unverified[key] = flagsForBlock(doc, key, source, extraUnverified);
  }
  return out;
}

/**
 * Numbers in one block that aren't in the source text, as written. `extra` are numbers already
 * known to be unsupported (the draft route's quote check): they count when this block has them.
 */
export function flagsForBlock(doc: ExhbtDoc, key: DraftBlock, source: string, extra: string[] = []): string[] {
  const only = applyBlock({ ...emptyDoc(), flow: [], sections: [] }, key, blockValue(doc, key) as never);
  const found = unverifiedNumbers(only, source);
  const here = new Set(blockTexts(doc, key).flatMap(numbersIn).map(normaliseNumber));
  const seen = new Set(found.map((n) => normaliseNumber(n) ?? n));
  for (const n of extra) {
    const k = normaliseNumber(n) ?? n;
    if (here.has(k) && !seen.has(k)) {
      seen.add(k);
      found.push(n);
    }
  }
  return found;
}

function blockTexts(doc: ExhbtDoc, key: DraftBlock): string[] {
  switch (key) {
    case "header":
      return [doc.title, doc.context, doc.whereWhen ?? "", doc.summary ?? "", doc.headline?.value ?? "", doc.headline?.label ?? ""];
    case "gap":
      return [plain(doc.gap)];
    case "flow":
      return doc.flow.flatMap((s) => [s.step, s.detail ?? ""]);
    case "findings":
      return findingsOf(doc).map(plain);
    case "skills":
      return doc.skills;
  }
}

/** Adds flagged numbers to the doc's list, once each (by value). */
export function mergeUnverified(existing: string[], add: string[]): string[] {
  const seen = new Set(existing.map((n) => normaliseNumber(n) ?? n));
  const out = [...existing];
  for (const n of add) {
    const k = normaliseNumber(n) ?? n;
    if (!seen.has(k)) {
      seen.add(k);
      out.push(n);
    }
  }
  return out;
}

/**
 * The doc with one block replaced (by a rewrite, or by going back to the AI version) and its
 * list of numbers to check brought up to date: flags for numbers that are no longer anywhere
 * in the exhbt are dropped, and the new block's own flags are added.
 */
export function replaceBlock<K extends DraftBlock>(doc: ExhbtDoc, key: K, value: BlockValues[K], flags: string[]): ExhbtDoc {
  const next = applyBlock(doc, key, value);
  const present = new Set(numbersInDoc(next).map(normaliseNumber));
  const kept = (next.unverified ?? []).filter((n) => present.has(normaliseNumber(n)));
  return { ...next, unverified: mergeUnverified(kept, flags) };
}
