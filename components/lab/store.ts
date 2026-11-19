"use client";

import { createContext, useContext, useEffect, useSyncExternalStore } from "react";
import { text, type Section, type SectionOf } from "@/lib/exhbt/blocks";
import type { Draft } from "./blocks";
import { FLOW_ID, sampleDoc, type LabDoc, type LabStep, type SampleId } from "./samples";

/**
 * The lab's doc, held in memory outside React (nothing is saved). Each part of the page reads its
 * own slice with useLab, so typing in one section re-renders that section and nothing else: the
 * slice of every other section is the same object as before. The order is its own slice, so the
 * page is laid out again only when a section moves, is added, or the sample changes.
 */

export class LabStore {
  private doc: LabDoc;
  private listeners = new Set<() => void>();

  constructor(sample: SampleId) {
    this.doc = sampleDoc(sample);
  }

  get = () => this.doc;

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };

  private set(next: LabDoc) {
    if (next === this.doc) return;
    this.doc = next;
    for (const fn of this.listeners) fn();
  }

  reset(sample: SampleId) {
    this.set(sampleDoc(sample));
  }

  setTitle(title: string) {
    this.set({ ...this.doc, title });
  }

  setGap(gap: LabDoc["gap"]) {
    this.set({ ...this.doc, gap });
  }

  private patch<K extends Section["kind"]>(id: string, fn: (s: SectionOf<K>) => SectionOf<K>) {
    const s = this.doc.sections[id];
    if (!s) return;
    this.set({ ...this.doc, sections: { ...this.doc.sections, [id]: fn(s as SectionOf<K>) as Section } });
  }

  setFinding(id: string, i: number, value: string) {
    this.patch<"findings">(id, (s) => ({ ...s, items: s.items.map((it, j) => (j === i ? text(value) : it)) }));
  }

  setCaption(id: string, value: string) {
    this.patch<"image">(id, (s) => ({ ...s, caption: text(value) }));
  }

  setStep(stepId: string, value: string) {
    this.set({ ...this.doc, flow: this.doc.flow.map((s) => (s.id === stepId ? { ...s, step: value } : s)) });
  }

  /** Moves a flow box to another place in the flowchart. */
  moveStep(from: number, to: number) {
    const flow = this.doc.flow;
    if (from === to || from < 0 || to < 0 || from >= flow.length || to >= flow.length) return;
    const next = [...flow];
    const [s] = next.splice(from, 1);
    next.splice(to, 0, s!);
    this.set({ ...this.doc, flow: next });
  }

  /** Adds an empty flow box at `at`. Returns its id, or null when the flowchart is full. */
  addStep(at: number, max: number): string | null {
    const flow = this.doc.flow;
    if (flow.length >= max) return null;
    const taken = new Set(flow.map((s) => s.id));
    let n = flow.length + 1;
    while (taken.has(`step-${n}`)) n++;
    const step: LabStep = { id: `step-${n}`, step: "" };
    this.set({ ...this.doc, flow: [...flow.slice(0, at), step, ...flow.slice(at)] });
    return step.id;
  }

  /**
   * Moves a section (or the flowchart) to `place`: its index in the order with the section itself
   * taken out, so place 0 is first and the number of other sections is last.
   */
  move(id: string, place: number) {
    const order = this.doc.order;
    const from = order.indexOf(id);
    if (from < 0) return;
    const rest = order.filter((x) => x !== id);
    const to = Math.max(0, Math.min(rest.length, place));
    if (to === from) return;
    this.set({ ...this.doc, order: [...rest.slice(0, to), id, ...rest.slice(to)] });
  }

  /** Puts a block (components/lab/blocks.ts) on the page before the item at `at` in the order. */
  insertDraft(at: number, draft: Draft) {
    const order = this.doc.order;
    if (order.includes(draft.id)) return;
    const i = Math.max(0, Math.min(order.length, at));
    this.set({
      ...this.doc,
      imageUrls: draft.picture ? { ...this.doc.imageUrls, [draft.picture.fileId]: draft.picture.url } : this.doc.imageUrls,
      sections: draft.section ? { ...this.doc.sections, [draft.id]: draft.section } : this.doc.sections,
      order: [...order.slice(0, i), draft.id, ...order.slice(i)],
    });
  }

  /** Takes a section off the page. The flowchart's boxes are kept, so it comes back as it was. */
  remove(id: string) {
    const order = this.doc.order;
    if (!order.includes(id)) return;
    const sections = { ...this.doc.sections };
    delete sections[id];
    this.set({ ...this.doc, sections, order: order.filter((x) => x !== id) });
  }
}

export const LabContext = createContext<LabStore | null>(null);

export function useLabStore(): LabStore {
  const store = useContext(LabContext);
  if (!store) throw new Error("useLabStore needs a LabContext.");
  return store;
}

/** One slice of the doc. `select` must return the same object while its slice hasn't changed. */
export function useLab<T>(select: (doc: LabDoc) => T): T {
  const store = useLabStore();
  return useSyncExternalStore(
    store.subscribe,
    () => select(store.get()),
    () => select(store.get()),
  );
}

/** What an item in the order is: a section's kind, or "flow" for the flowchart. */
export type ItemKind = Section["kind"] | "flow";
export const kindOf = (doc: LabDoc, id: string): ItemKind => (id === FLOW_ID ? "flow" : (doc.sections[id]?.kind ?? "quote"));

declare global {
  interface Window {
    /** How many times each part of the lab page has rendered, by key ("title", "context", a section id). For e2e/lab-editor.spec.ts. */
    __labRenders?: Record<string, number>;
  }
}

/**
 * Counts a part's renders on window.__labRenders, for the test that typing re-renders only the
 * section being typed in. Counted after each commit, so React's double render in development
 * doesn't count twice.
 */
export function useRenderCount(key: string) {
  useEffect(() => {
    const counts = (window.__labRenders ??= {});
    counts[key] = (counts[key] ?? 0) + 1;
  });
}
