import { FLOW_ID, isContent, type ContentSection, type ExhbtDoc, type FlowStep, type RichText, type Section } from "../../lib/exhbt/blocks";
import { fileIdsIn } from "../../lib/exhbt/doc-files";
import { mergeUnverified } from "../../lib/exhbt/draft-blocks";
import { normaliseNumber, numbersInDoc } from "../../lib/exhbt/verify";

/*
 * Undo for the edit-on-page editor (decision 0026, "Undo"), with no React in it, so its rules can be
 * checked in-process. It reverses actions; it never restores a snapshot, so typing done since in any
 * other field is kept.
 *
 *  - A structural action (add, remove or move a section, a layout switch, the flowchart off or on)
 *    holds the structure before it: the sections' ids in stored order, the content of any section it
 *    took out, whether the marker was there, flowOff and the layout. Undo restores exactly that, the
 *    marker absent if it was absent; sections still on the page keep their words.
 *  - Any other entry (a rewrite, a confirmed number, the work removed, a named patch) holds the
 *    before and after of exactly the section fields and top-level keys it changed. Undo writes back
 *    only those.
 *  - A flowchart box is found by a key that lasts for the visit; a finding by its place in its
 *    section, found by the section's id. Undo is last in, first out, and typing never changes a place,
 *    so a place is exact. An entry that changes the boxes some other way (a rewrite of the flowchart,
 *    "Back to the AI version") keeps the boxes' keys from before it and puts them back with the boxes,
 *    so the box actions before it still find their boxes (the review's data-safety-5).
 *  - An entry that can no longer be done (its box or finding is not there) is never popped in silence:
 *    Undo skips it, does the next one that can be done, and says so (`undoneWords`).
 *  - The numbers to check are never written back as they were: Undo sets them to the list now joined
 *    with the list before the action, limited to numbers on the page after the undo.
 *  - Each entry lists the stored files it could bring back, for the rule that deletes files.
 */

/** The stack's length (decision 0026). */
export const UNDO_LIMIT = 30;

/** The page's structure, as a structural entry keeps it. */
export type Structure = {
  /** The sections' ids in stored order, "flow" for the marker. */
  ids: string[];
  flowOff: boolean;
  format: ExhbtDoc["format"];
};

export type FlowOp =
  | { op: "add"; key: string }
  | { op: "remove"; key: string; step: FlowStep; at: number }
  | { op: "move"; key: string; from: number };

export type ListOp =
  | { op: "add"; id: string; at: number }
  | { op: "remove"; id: string; at: number; item: RichText }
  | { op: "move"; id: string; from: number; to: number };

export type Entry = {
  /** What it undoes, for "Undo: remove graph 1". */
  label: string;
  /** The section the action was about: where the focus goes after an undo, if it is still on the page. */
  subject?: string;
  /** A structural action's before: the structure, the content of the sections it took out, the ids it added. */
  structure?: { before: Structure; taken: ContentSection[]; added: string[] };
  /** Section fields it changed, by section id. */
  fields?: { id: string; field: string; before: unknown }[];
  /** Top-level keys it changed (never `sections` or `unverified`). */
  keys?: { key: string; before: unknown }[];
  flow?: FlowOp;
  list?: ListOp;
  /** The flowchart's box keys before the action, kept when it changed the boxes other than by a box action (a rewrite): put back with them. */
  boxKeys?: string[];
  /** The numbers to check before the action. */
  unverified: string[];
  /** Stored files the action took off the page, which an undo could bring back. */
  files: string[];
};

/** The state undo works on: the doc and the flowchart's box keys, side by side. */
export type UndoState = { doc: ExhbtDoc; keys: string[] };

const same = (a: unknown, b: unknown) => a === b || JSON.stringify(a) === JSON.stringify(b);
const unverifiedOf = (d: ExhbtDoc): string[] => d.unverified ?? [];

export const structureOf = (d: ExhbtDoc): Structure => ({ ids: d.sections.map((s) => s.id), flowOff: d.flowOff === true, format: d.format });

/** Files `before` points at that `after` does not. */
const filesTaken = (before: ExhbtDoc, after: ExhbtDoc): string[] => {
  const kept = new Set(fileIdsIn(after));
  return fileIdsIn(before).filter((f) => f && !kept.has(f));
};

/** A structural action's entry, from the doc before and after it. */
export function structuralEntry(label: string, before: ExhbtDoc, after: ExhbtDoc, subject?: string): Entry {
  const afterIds = new Set(after.sections.map((s) => s.id));
  const beforeIds = new Set(before.sections.map((s) => s.id));
  return {
    label,
    subject,
    structure: {
      before: structureOf(before),
      taken: before.sections.filter((s): s is ContentSection => isContent(s) && !afterIds.has(s.id)),
      added: after.sections.filter((s) => !beforeIds.has(s.id)).map((s) => s.id),
    },
    unverified: unverifiedOf(before),
    files: filesTaken(before, after),
  };
}

/**
 * Any other change's entry: the before of each section field and top-level key that changed, and
 * nothing else. If the change also added, took out or reordered sections (a rewrite of the findings
 * on an exhbt that had none adds a section), it holds the structure before it too.
 */
export function diffEntry(label: string, before: ExhbtDoc, after: ExhbtDoc, subject?: string): Entry {
  const entry: Entry = { label, subject, unverified: unverifiedOf(before), files: filesTaken(before, after) };
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const k of keys) {
    if (k === "sections" || k === "unverified") continue;
    const b = (before as Record<string, unknown>)[k];
    const a = (after as Record<string, unknown>)[k];
    if (!same(b, a)) (entry.keys ??= []).push({ key: k, before: structuredClone(b) });
  }
  const now = new Map(after.sections.map((s) => [s.id, s]));
  for (const s of before.sections) {
    const a = now.get(s.id);
    if (!a || a === s || !isContent(s) || !isContent(a)) continue;
    const fields = new Set([...Object.keys(s), ...Object.keys(a)]);
    for (const f of fields) {
      const b = (s as Record<string, unknown>)[f];
      if (!same(b, (a as Record<string, unknown>)[f])) (entry.fields ??= []).push({ id: s.id, field: f, before: structuredClone(b) });
    }
  }
  if (!same(before.sections.map((s) => s.id), after.sections.map((s) => s.id))) entry.structure = structuralEntry(label, before, after).structure;
  return entry;
}

/** The doc with its structure put back as `s` holds it. Sections still on the page keep their words. */
function restoreStructure(doc: ExhbtDoc, s: NonNullable<Entry["structure"]>): ExhbtDoc {
  const now = new Map(doc.sections.filter(isContent).map((x) => [x.id, x]));
  const taken = new Map(s.taken.map((x) => [x.id, x]));
  const sections: Section[] = [];
  for (const id of s.before.ids) {
    if (id === FLOW_ID) {
      sections.push({ id: FLOW_ID, kind: "flow" });
      continue;
    }
    const x = now.get(id) ?? taken.get(id);
    now.delete(id);
    if (x) sections.push(x);
  }
  // A section on the page that this action did not add, and that was not there before it (none, in
  // practice: undo is last in, first out), is kept rather than lost, at the end.
  for (const [id, x] of now) if (!s.added.includes(id)) sections.push(x);
  const next: ExhbtDoc = { ...doc, sections };
  if (s.before.flowOff) next.flowOff = true;
  else delete next.flowOff;
  if (s.before.format) next.format = s.before.format;
  else delete next.format;
  return next;
}

/** The list joined with `before`, limited to numbers on the page in `doc`. */
export function numbersAfterUndo(doc: ExhbtDoc, before: string[]): string[] {
  const present = new Set(numbersInDoc(doc).map(normaliseNumber));
  return mergeUnverified(unverifiedOf(doc), before).filter((n) => present.has(normaliseNumber(n)));
}

const move = <T>(list: T[], from: number, to: number): T[] => {
  const next = [...list];
  const [x] = next.splice(from, 1);
  next.splice(Math.max(0, Math.min(next.length, to)), 0, x!);
  return next;
};

/** A section's findings with `fn` applied to them; the doc as it is when there is no such section. */
function withItems(doc: ExhbtDoc, id: string, fn: (items: RichText[]) => RichText[]): ExhbtDoc {
  const i = doc.sections.findIndex((s) => s.id === id);
  const s = doc.sections[i];
  if (!s || s.kind !== "findings") return doc;
  const sections = [...doc.sections];
  sections[i] = { ...s, items: fn(s.items) };
  return { ...doc, sections };
}

/** Whether `e` can still be done in `state`: its box, or its finding, is where the undo needs it. Any other entry always can. */
export function canUndo(state: UndoState, e: Entry): boolean {
  if (e.flow) {
    const there = state.keys.includes(e.flow.key);
    return e.flow.op === "remove" ? !there : there;
  }
  const l = e.list;
  if (l) {
    const s = state.doc.sections.find((x) => x.id === l.id);
    if (!s || s.kind !== "findings") return false;
    return l.op === "add" ? l.at < s.items.length : l.op === "move" ? l.to < s.items.length && l.from < s.items.length : l.at <= s.items.length;
  }
  return true;
}

/** What an Undo did: the entry it undid, those it had to skip first (newest first), and the words to say (undoneWords). */
export type UndoResult = { undone: string | null; skipped: string[]; words: string };

const listed = (xs: string[]) => (xs.length < 2 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);

/** The words said after an Undo: "Undone: remove graph 1.", and any entry it skipped. */
export function undoneWords(r: Pick<UndoResult, "undone" | "skipped">): string {
  const skipped = listed(r.skipped);
  const why = skipped ? `${skipped.charAt(0).toUpperCase()}${skipped.slice(1)} can't be undone any more, so Undo skipped ${r.skipped.length === 1 ? "it" : "them"}.` : "";
  return [r.undone ? `Undone: ${r.undone}.` : "", why].filter(Boolean).join(" ");
}

/** The state with one entry undone. */
export function applyUndo(state: UndoState, e: Entry): UndoState {
  let doc = state.doc;
  let keys = state.keys;
  if (e.structure) doc = restoreStructure(doc, e.structure);
  if (e.fields?.length) {
    const sections = [...doc.sections];
    for (const c of e.fields) {
      const i = sections.findIndex((s) => s.id === c.id);
      if (i < 0) continue;
      const s = { ...sections[i]! } as Record<string, unknown>;
      if (c.before === undefined) delete s[c.field];
      else s[c.field] = structuredClone(c.before);
      sections[i] = s as Section;
    }
    doc = { ...doc, sections };
  }
  if (e.keys?.length) {
    const next = { ...doc } as Record<string, unknown>;
    for (const k of e.keys) {
      if (k.before === undefined) delete next[k.key];
      else next[k.key] = structuredClone(k.before);
    }
    doc = next as ExhbtDoc;
  }
  // The boxes are back as they were before the rewrite: so are their keys.
  if (e.boxKeys && doc.flow.length === e.boxKeys.length) keys = [...e.boxKeys];
  if (e.flow) {
    const f = e.flow;
    const at = keys.indexOf(f.key);
    if (f.op === "add" && at >= 0) {
      doc = { ...doc, flow: doc.flow.filter((_, i) => i !== at) };
      keys = keys.filter((_, i) => i !== at);
    } else if (f.op === "remove" && at < 0) {
      const to = Math.min(f.at, doc.flow.length);
      doc = { ...doc, flow: [...doc.flow.slice(0, to), f.step, ...doc.flow.slice(to)] };
      keys = [...keys.slice(0, to), f.key, ...keys.slice(to)];
    } else if (f.op === "move" && at >= 0) {
      doc = { ...doc, flow: move(doc.flow, at, f.from) };
      keys = move(keys, at, f.from);
    }
  }
  if (e.list) {
    const l = e.list;
    if (l.op === "add") doc = withItems(doc, l.id, (items) => items.filter((_, i) => i !== l.at));
    else if (l.op === "remove") doc = withItems(doc, l.id, (items) => [...items.slice(0, l.at), l.item, ...items.slice(l.at)]);
    else doc = withItems(doc, l.id, (items) => (l.to < items.length ? move(items, l.to, l.from) : items));
  }
  // The numbers to check: the list now joined with the list before, limited to numbers on the page.
  const numbers = numbersAfterUndo(doc, e.unverified);
  if (numbers.length || doc.unverified !== undefined) doc = { ...doc, unverified: numbers };
  return { doc, keys };
}
