import { FLOW_ID, formatLimits, isContent, type ContentSection, type ExhbtDoc, type RichText } from "../../lib/exhbt/blocks";
import { formatOf, FORMAT_RULES, type Format } from "../../lib/exhbt/formats";
import { applyTemplate, insertBlock, insertImage, moveItem, pageItems, removeItem, type BlockKind } from "../../lib/exhbt/layouts";
import { sectionLabel } from "../../lib/exhbt/sections";
import { applyUndo, diffEntry, structuralEntry, UNDO_LIMIT, type Entry } from "./undo";

/*
 * The editor's doc, held outside React (decision 0026, "What re-renders"), with no React in this
 * file so its rules can be checked in-process; store.ts puts the hooks on it. One doc; each part of
 * the page reads its own slice, so typing in one section re-renders that section's frame and nothing
 * else.
 *
 * In every change, before any subscriber is told, the store hands the new doc to `onChange` (the
 * editor writes the browser copy and notes the newest doc for flushPending there): React can drop the
 * render that follows a change if it throws, so anything written in an effect could be lost.
 */

/** A field path as validateForPublish reports it ("title", "flow.2.step", "sections.3.items.1"). */
type FieldPath = string;

/** The store's public face (components/exhbt-editor/store.ts re-exports this type word for word). */
export type EditorStore = {
  get(): ExhbtDoc;
  subscribe(fn: () => void): () => void;

  /** Typing: sets the value at a field path. Never an undo entry. */
  setAt(path: FieldPath, value: string | RichText): void;
  /** A change inside one section that is not typing (a graph's numbers, a tick, before or after). With `undo`, it is one undo entry with that name, holding the before and after of the fields `fn` changed and nothing else. */
  patch(id: string, fn: (s: ContentSection) => ContentSection, undo?: string): void;
  /** A change outside the sections (the work, the card's summary, a skill, a confirmed number, an AI rewrite). With `undo`, one entry holding the before and after of the sections' fields and the top-level keys `fn` changed, and nothing else. */
  patchDoc(fn: (d: ExhbtDoc) => ExhbtDoc, undo?: string): void;

  /** Structural changes: each adopts the doc first and is one undo entry. `at` and `place` count page items (pageItems in lib/exhbt/layouts.ts). */
  move(id: string, place: number): void;
  /** Returns the new section's id ("flow" for the flowchart, put back at `at`), or null when the layout has no room (blockOptions says why) or the flowchart is on the page already. */
  insert(kind: Exclude<BlockKind, "image">, at: number): string | null;
  insertImage(image: { fileId: string; w?: number; h?: number }, at: number): string | null;
  /** Never prunes the numbers to check: Undo may bring the section back. */
  remove(id: string): void;
  setLayout(f: Format): void;

  /** The flowchart's boxes. A box has no stored id, so each gets a key that lasts for the visit. */
  flowKeys(): readonly string[];
  flowAdd(at: number): string | null;
  flowRemove(key: string): void;
  flowMove(key: string, to: number): void;

  /** Writes back only what the last entry changed, so typing done since in other fields is kept. The numbers to check come back as the list now joined with the list before, limited to numbers on the page after the undo. */
  undo(): void;
  /** "remove graph 1", or null when there is nothing to undo. */
  undoLabel(): string | null;
};

/** What the editor's own parts use beyond the public face. */
export type StoreInternals = {
  /** The doc as the shell (title, context line, facts, skills, the work, the rows) last changed: a new object only when one of those changes. */
  shell(): ExhbtDoc;
  /** Counts every change. */
  version(): number;
  /** The section with this id, from a map kept per change. */
  section(id: string): ContentSection | undefined;
  /** A finding added, removed or moved: one undo entry each (decision 0026's list). */
  listAdd(id: string, at: number): void;
  listRemove(id: string, at: number): void;
  listMove(id: string, from: number, to: number): void;
  /** The undo entries, oldest first, for the rule that deletes files (milestone 2). */
  entries(): readonly Entry[];
  /** Called with each entry that falls off the end of the list. */
  onDropped(fn: (e: Entry) => void): () => void;
  /**
   * Called after each undo with the section it was about, if that section is on the page ("flow" for
   * the flowchart and each of its box actions), and, for a box action, the box's lasting key (the box
   * may be gone: the undo of an add takes it out).
   */
  onUndone(fn: (subject: string | null, box: string | null) => void): () => void;
  /** Replaces the doc outright (the backup offer). Not an undo entry; the undo list is cleared. */
  replace(doc: ExhbtDoc): void;
};

export type Store = EditorStore & StoreInternals;

/** The fields the shell draws, besides the structure. */
const SHELL_KEYS = ["title", "gap", "context", "whereWhen", "myRole", "skills", "evidence", "format"] as const;

/**
 * Changes whenever structureKey(doc) could (the layout, flowOff, each section's id and kind, an
 * image's stage), and when a picture's size changes, since a grid tile's shape is drawn by the row.
 */
function layoutSig(d: ExhbtDoc): string {
  return JSON.stringify([d.format ?? "", d.flowOff === true, d.sections.map((s) => (s.kind === "image" ? [s.id, s.kind, s.stage ?? "", s.w ?? 0, s.h ?? 0] : [s.id, s.kind]))]);
}

/** `obj` with `value` at `keys`, every object on the way copied and nothing else. The same object when the value is already there. */
function setIn(obj: unknown, keys: string[], value: unknown): unknown {
  if (keys.length === 0) return value;
  const [k, ...rest] = keys as [string, ...string[]];
  if (Array.isArray(obj)) {
    const i = Number(k);
    const cur = obj[i];
    const next = setIn(cur, rest, value);
    if (next === cur) return obj;
    const copy = [...obj];
    copy[i] = next;
    return copy;
  }
  const o = (obj && typeof obj === "object" ? obj : {}) as Record<string, unknown>;
  const cur = o[k];
  const next = setIn(cur, rest, value);
  if (next === cur && obj) return obj;
  return { ...o, [k]: next };
}

const sameValue = (a: unknown, b: unknown) => a === b || (typeof a === "object" && typeof b === "object" && JSON.stringify(a) === JSON.stringify(b));

let keySeq = 0;
const newKey = () => `box-${++keySeq}`;

/** A store for one visit to one exhbt. */
export function createStore(initial: ExhbtDoc, opts: { onChange?: (doc: ExhbtDoc) => void } = {}): Store {
  let doc = initial;
  let shellDoc = initial;
  let sig = layoutSig(initial);
  let ver = 0;
  let keys: string[] = initial.flow.map(() => newKey());
  let stack: Entry[] = [];
  let byId = new Map<string, ContentSection>();
  let mapFor: ExhbtDoc["sections"] | null = null;
  const listeners = new Set<() => void>();
  const dropped = new Set<(e: Entry) => void>();
  const undone = new Set<(subject: string | null, box: string | null) => void>();

  /** The flowchart's keys after a change that was not a flowchart action: kept while the count is the same. */
  const syncKeys = () => {
    if (keys.length === doc.flow.length) return;
    keys = doc.flow.map((_, i) => keys[i] ?? newKey());
  };

  function commit(next: ExhbtDoc, entry?: Entry, redrawShell = false) {
    if (next === doc) return;
    const prev = doc;
    doc = next;
    ver++;
    syncKeys();
    // The shell changes only when one of its fields or the page's structure does.
    const nextSig = prev.sections === next.sections && prev.format === next.format && prev.flowOff === next.flowOff ? sig : layoutSig(next);
    if (redrawShell || nextSig !== sig || SHELL_KEYS.some((k) => prev[k] !== next[k])) shellDoc = next;
    sig = nextSig;
    if (entry) push(entry);
    opts.onChange?.(next);
    for (const fn of [...listeners]) fn();
  }

  function push(entry: Entry) {
    stack = [...stack, entry];
    while (stack.length > UNDO_LIMIT) {
      const [gone, ...rest] = stack;
      stack = rest;
      for (const fn of dropped) fn(gone!);
    }
  }

  const labelOf = (d: ExhbtDoc, id: string): string => {
    const i = d.sections.findIndex((s) => s.id === id);
    if (i >= 0) return sectionLabel(d.sections, i, formatOf(d)).toLowerCase();
    return id === "flow" ? "flowchart" : "section";
  };

  /** A structural change, as one undo entry. */
  function structural(next: ExhbtDoc, label: string, subject?: string) {
    if (next === doc) return;
    commit(next, structuralEntry(label, doc, next, subject));
  }

  const store: Store = {
    get: () => doc,
    subscribe(fn) {
      listeners.add(fn);
      return () => void listeners.delete(fn);
    },

    setAt(path, value) {
      const keysOf = path.split(".");
      const cur = keysOf.reduce<unknown>((v, k) => (v && typeof v === "object" ? (v as Record<string, unknown>)[k] : undefined), doc);
      if (sameValue(cur, value)) return;
      commit(setIn(doc, keysOf, value) as ExhbtDoc);
    },

    patch(id, fn, undo) {
      const i = doc.sections.findIndex((s) => s.id === id);
      const s = doc.sections[i];
      if (!s || !isContent(s)) return;
      const ns = fn(s);
      if (ns === s) return;
      const sections = [...doc.sections];
      sections[i] = ns;
      const next = { ...doc, sections };
      commit(next, undo ? diffEntry(undo, doc, next, id) : undefined);
    },

    patchDoc(fn, undo) {
      const next = fn(doc);
      if (next === doc) return;
      commit(next, undo ? diffEntry(undo, doc, next) : undefined);
    },

    move(id, place) {
      structural(moveItem(doc, id, place), `move ${labelOf(doc, id)}`, id);
    },

    insert(kind, at) {
      const r = insertBlock(doc, kind, at);
      if (!r) return null;
      structural(r.doc, `add ${labelOf(r.doc, r.id)}`, r.id);
      return r.id;
    },

    insertImage(image, at) {
      const r = insertImage(doc, image, at);
      if (!r) return null;
      structural(r.doc, `add ${labelOf(r.doc, r.id)}`, r.id);
      return r.id;
    },

    remove(id) {
      structural(removeItem(doc, id), `remove ${labelOf(doc, id)}`, id);
    },

    setLayout(f) {
      const next = applyTemplate(doc, f);
      // A switch to the layout it is already in, already in its usual order, changes nothing.
      if (formatOf(doc) === f && JSON.stringify(next.sections) === JSON.stringify(doc.sections) && next.flowOff === doc.flowOff) return;
      structural(next, `the switch to ${FORMAT_RULES[f].name.toLowerCase()}`);
    },

    flowKeys: () => keys,

    flowAdd(at) {
      if (doc.flow.length >= formatLimits(formatOf(doc)).flow.max) return null;
      const to = Math.max(0, Math.min(doc.flow.length, Math.trunc(at)));
      const key = newKey();
      const before = doc;
      keys = [...keys.slice(0, to), key, ...keys.slice(to)];
      commit({ ...doc, flow: [...doc.flow.slice(0, to), { step: "" }, ...doc.flow.slice(to)] }, { label: `add box ${to + 1}`, subject: FLOW_ID, flow: { op: "add", key }, unverified: before.unverified ?? [], files: [] });
      return key;
    },

    flowRemove(key) {
      const at = keys.indexOf(key);
      if (at < 0) return;
      const step = doc.flow[at]!;
      const before = doc;
      keys = keys.filter((_, i) => i !== at);
      commit({ ...doc, flow: doc.flow.filter((_, i) => i !== at) }, { label: `remove box ${at + 1}`, subject: FLOW_ID, flow: { op: "remove", key, step, at }, unverified: before.unverified ?? [], files: [] });
    },

    flowMove(key, to) {
      const from = keys.indexOf(key);
      const t = Math.max(0, Math.min(doc.flow.length - 1, Math.trunc(to)));
      if (from < 0 || from === t) return;
      const flow = [...doc.flow];
      const [step] = flow.splice(from, 1);
      flow.splice(t, 0, step!);
      const k = [...keys];
      k.splice(from, 1);
      k.splice(t, 0, key);
      keys = k;
      commit({ ...doc, flow }, { label: `move box ${from + 1}`, subject: FLOW_ID, flow: { op: "move", key, from }, unverified: doc.unverified ?? [], files: [] });
    },

    undo() {
      const e = stack[stack.length - 1];
      if (!e) return;
      stack = stack.slice(0, -1);
      const r = applyUndo({ doc, keys }, e);
      keys = r.keys;
      // The entry is gone already, so the listeners see the shorter list.
      const forced = r.doc === doc ? { ...doc } : r.doc;
      commit(forced);
      const subject = e.subject && (e.subject === FLOW_ID ? pageItems(doc).some((it) => it.id === FLOW_ID) : doc.sections.some((s) => s.id === e.subject)) ? e.subject : null;
      // A box action's box, by its lasting key: there again after the undo of a remove or a move, gone after the undo of an add.
      const box = subject === FLOW_ID && e.flow ? e.flow.key : null;
      for (const fn of undone) fn(subject, box);
    },

    undoLabel: () => stack[stack.length - 1]?.label ?? null,

    shell: () => shellDoc,
    version: () => ver,
    section(id) {
      if (mapFor !== doc.sections) {
        byId = new Map(doc.sections.filter(isContent).map((s) => [s.id, s]));
        mapFor = doc.sections;
      }
      return byId.get(id);
    },

    listAdd(id, at) {
      const i = doc.sections.findIndex((s) => s.id === id);
      const s = doc.sections[i];
      if (!s || s.kind !== "findings" || s.items.length >= formatLimits(formatOf(doc)).findings.max) return;
      const to = Math.max(0, Math.min(s.items.length, at));
      const sections = [...doc.sections];
      sections[i] = { ...s, items: [...s.items.slice(0, to), [], ...s.items.slice(to)] };
      commit({ ...doc, sections }, { label: `add finding ${to + 1}`, subject: id, list: { op: "add", id, at: to }, unverified: doc.unverified ?? [], files: [] });
    },

    listRemove(id, at) {
      const i = doc.sections.findIndex((s) => s.id === id);
      const s = doc.sections[i];
      if (!s || s.kind !== "findings" || !s.items[at]) return;
      const sections = [...doc.sections];
      sections[i] = { ...s, items: s.items.filter((_, k) => k !== at) };
      commit({ ...doc, sections }, { label: `remove finding ${at + 1}`, subject: id, list: { op: "remove", id, at, item: s.items[at]! }, unverified: doc.unverified ?? [], files: [] });
    },

    listMove(id, from, to) {
      const i = doc.sections.findIndex((s) => s.id === id);
      const s = doc.sections[i];
      if (!s || s.kind !== "findings" || from === to || from < 0 || to < 0 || from >= s.items.length || to >= s.items.length) return;
      const items = [...s.items];
      const [x] = items.splice(from, 1);
      items.splice(to, 0, x!);
      const sections = [...doc.sections];
      sections[i] = { ...s, items };
      commit({ ...doc, sections }, { label: `move finding ${from + 1}`, subject: id, list: { op: "move", id, from, to }, unverified: doc.unverified ?? [], files: [] });
    },

    entries: () => stack,
    onDropped(fn) {
      dropped.add(fn);
      return () => void dropped.delete(fn);
    },
    onUndone(fn) {
      undone.add(fn);
      return () => void undone.delete(fn);
    },
    replace(next) {
      stack = [];
      keys = next.flow.map(() => newKey());
      // A replaced doc redraws everything.
      commit(next, undefined, true);
    },
  };
  return store;
}
