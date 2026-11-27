import type { BuilderState } from "@/app/(app)/portfolio/steps";
import { getAt, setAtPath } from "./paths";

/*
 * Undo for the portfolio editor (decision 0031, "Undo"), with no React in it, so its rules can be
 * checked in-process. It reverses a change; it never restores a snapshot, so typing done since in any
 * other field is kept (the exhbt editor's rule, components/exhbt-editor/undo.ts).
 *
 *  - An entry holds, for each key its change touched and for no other, how to take that key back: the
 *    value it had before, or, for a list that changed by one add, remove or move (the sections, the
 *    exhbts' order, a tile's lines), that one step, taken back by place. Undo is last in, first out, and
 *    typing never changes a place, so a place is exact; and a line typed in since keeps its words.
 *  - Keys are found by walking the two states side by side: an object is walked into, a list or a word
 *    is a key. So "removed Experience" holds the sections' step and nothing of the profile, and typing
 *    in the headline since is still there after it is undone.
 *  - Up to UNDO_LIMIT entries, the oldest dropped first. Typing is never an entry.
 */

/** The stack's length (decision 0031). */
export const UNDO_LIMIT = 30;

type ListOp = { op: "add"; at: number } | { op: "remove"; at: number; item: unknown } | { op: "move"; from: number; to: number };

/** One key a change touched, and how to take it back. */
type Step = { path: string; before: unknown } | { path: string; list: ListOp };

export type UndoEntry = {
  /** What it undoes, as the change named it: "removed Experience". */
  label: string;
  steps: Step[];
};

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const same = (a: unknown, b: unknown) => Object.is(a, b) || JSON.stringify(a) === JSON.stringify(b);
const sameList = (a: readonly unknown[], b: readonly unknown[]) => a.length === b.length && a.every((x, i) => same(x, b[i]));
const without = <T>(list: readonly T[], i: number): T[] => [...list.slice(0, i), ...list.slice(i + 1)];
const moved = <T>(list: readonly T[], from: number, to: number): T[] => {
  const next = [...list];
  const [x] = next.splice(from, 1);
  next.splice(to, 0, x as T);
  return next;
};

/** The one add, remove or move that turns `before` into `after`, or null when it is not one. */
function listOp(before: readonly unknown[], after: readonly unknown[]): ListOp | null {
  if (after.length === before.length + 1) {
    for (let i = 0; i < after.length; i++) if (sameList(without(after, i), before)) return { op: "add", at: i };
  } else if (after.length === before.length - 1) {
    for (let i = 0; i < before.length; i++) if (sameList(without(before, i), after)) return { op: "remove", at: i, item: before[i] };
  } else if (after.length === before.length) {
    for (let from = 0; from < before.length; from++) for (let to = 0; to < before.length; to++) if (from !== to && sameList(moved(before, from, to), after)) return { op: "move", from, to };
  }
  return null;
}

function walk(path: string, before: unknown, after: unknown, out: Step[]): void {
  if (same(before, after)) return;
  if (isObject(before) && isObject(after)) {
    for (const k of new Set([...Object.keys(before), ...Object.keys(after)])) walk(path ? `${path}.${k}` : k, before[k], after[k], out);
    return;
  }
  if (Array.isArray(before) && Array.isArray(after)) {
    const op = listOp(before, after);
    out.push(op ? { path, list: op } : { path, before });
    return;
  }
  out.push({ path, before });
}

/** The entry for a change, from the state before and after it; null when the change changed nothing. */
export function entryFor(label: string, before: BuilderState, after: BuilderState): UndoEntry | null {
  const steps: Step[] = [];
  walk("", before, after, steps);
  return steps.length ? { label, steps } : null;
}

/** The state with one entry undone: each key it touched taken back, newest first, and nothing else changed. */
export function applyUndo(state: BuilderState, entry: UndoEntry): BuilderState {
  let next = state;
  for (const step of [...entry.steps].reverse()) {
    if (!("list" in step)) {
      next = setAtPath(next, step.path, step.before === undefined ? undefined : structuredClone(step.before));
      continue;
    }
    const now = getAt(next, step.path);
    const list = Array.isArray(now) ? now : [];
    const op = step.list;
    const back =
      op.op === "add"
        ? op.at < list.length
          ? without(list, op.at)
          : list
        : op.op === "remove"
          ? [...list.slice(0, Math.min(op.at, list.length)), structuredClone(op.item), ...list.slice(Math.min(op.at, list.length))]
          : op.to < list.length && op.from < list.length
            ? moved(list, op.to, op.from)
            : list;
    next = setAtPath(next, step.path, back);
  }
  return next;
}

/**
 * The section an entry's undo brings back or moves, if it is one: where the focus goes after it. A
 * removed section is back at its place; a moved one is the one that was carried.
 */
export function subjectOf(entry: UndoEntry, before: BuilderState, after: BuilderState): string | null {
  const step = entry.steps.find((s) => s.path === "arrangement.sections");
  if (!step || !("list" in step)) return null;
  const op = step.list;
  if (op.op === "remove") return typeof op.item === "string" ? op.item : null;
  if (op.op === "move") return before.arrangement.sections[op.to] ?? null;
  // An added section is taken off again: there is nothing of it to go to.
  void after;
  return null;
}
