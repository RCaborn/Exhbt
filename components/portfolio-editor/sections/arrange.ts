import type { BuilderState } from "@/app/(app)/portfolio/steps";
import { emptyTile, type SectionKey, type TileKind } from "@/lib/portfolio-layout";

/*
 * The arranging changes, pure and with no React in them: the step builder's own rules
 * (app/(app)/portfolio/StepProjects.tsx and Preview.tsx) moved onto the page. Each returns the same
 * state when nothing changes, so a press that does nothing leaves no Undo step.
 */

type A = BuilderState["arrangement"];
const withA = (s: BuilderState, a: A): BuilderState => (a === s.arrangement ? s : { ...s, arrangement: a });

const moved = <T>(list: readonly T[], from: number, to: number): T[] => {
  const next = [...list];
  const [x] = next.splice(from, 1);
  next.splice(to, 0, x as T);
  return next;
};

/** The tiles a section's words live in: what adding it starts empty. */
const WRITTEN: Partial<Record<SectionKey, TileKind[]>> = { about: ["about", "education"], experience: ["experience"], quote: ["quote"] };

export function moveSection(s: BuilderState, key: SectionKey, to: number): BuilderState {
  const list = s.arrangement.sections;
  const from = list.indexOf(key);
  if (from < 0 || to < 0 || to >= list.length || to === from) return s;
  return withA(s, { ...s.arrangement, sections: moved(list, from, to) });
}

/**
 * Takes a section off the page. Its words stay in the state, so Undo (or adding it again) brings them
 * back; a save drops them (layoutFromSections). The last section is never taken off: a stored layout with
 * no sections reads as the defaults (sectionsOf), so the page keeps at least one.
 */
export function removeSection(s: BuilderState, key: SectionKey): BuilderState {
  if (!s.arrangement.sections.includes(key) || s.arrangement.sections.length <= 1) return s;
  return withA(s, { ...s.arrangement, sections: s.arrangement.sections.filter((k) => k !== key) });
}

/** Puts a section at the end, with empty words for whatever it holds that has none yet. */
export function addSection(s: BuilderState, key: SectionKey): BuilderState {
  if (s.arrangement.sections.includes(key)) return s;
  const tiles = { ...s.arrangement.tiles };
  for (const kind of WRITTEN[key] ?? []) if (!tiles[kind]) (tiles as Record<string, unknown>)[kind] = emptyTile(kind);
  return withA(s, { ...s.arrangement, sections: [...s.arrangement.sections, key], tiles });
}

/**
 * The order with every exhbt the page draws in it: the stored order, then any the page draws after it
 * (made since the page opened: home-props.ts, `shownProjects`), so a move never loses one.
 */
export function fullOrder(order: readonly string[], known: readonly string[]): string[] {
  const has = new Set(known);
  return [...order.filter((id) => has.has(id)), ...known.filter((id) => !order.includes(id))];
}

/**
 * Moves an exhbt among the ones the work lists (`listed`, in the order drawn), as StepProjects does:
 * only the listed keys change places; a hidden or starred one keeps its slot in the order.
 */
export function moveTile(s: BuilderState, listed: readonly string[], known: readonly string[], id: string, to: number): BuilderState {
  const from = listed.indexOf(id);
  if (from < 0 || to < 0 || to >= listed.length || from === to) return s;
  const next = moved(listed, from, to);
  const inList = new Set(listed);
  let i = 0;
  const order = fullOrder(s.arrangement.order, known).map((k) => (inList.has(k) ? next[i++]! : k));
  return withA(s, { ...s.arrangement, order });
}

/** The star: in the band, or out of it. */
export function setStar(s: BuilderState, id: string, on: boolean): BuilderState {
  const featured = on ? id : s.arrangement.featured === id ? null : s.arrangement.featured;
  if (featured === s.arrangement.featured) return s;
  return withA(s, { ...s.arrangement, featured });
}

/** Hides an exhbt from the page; hiding the band's exhbt takes its star off, as the step builder does. */
export function hideTile(s: BuilderState, id: string): BuilderState {
  const a = s.arrangement;
  if (a.hidden.includes(id)) return s;
  return withA(s, { ...a, hidden: [...a.hidden, id], featured: a.featured === id ? null : a.featured });
}

export function showTile(s: BuilderState, id: string): BuilderState {
  const a = s.arrangement;
  if (!a.hidden.includes(id)) return s;
  return withA(s, { ...a, hidden: a.hidden.filter((h) => h !== id) });
}

/* ---------- Lines of education and experience ---------- */

type LineKind = "education" | "experience";

const linesOf = (s: BuilderState, kind: LineKind): string[] => s.arrangement.tiles[kind]?.lines ?? [];

function withLines(s: BuilderState, kind: LineKind, lines: string[]): BuilderState {
  const tiles = s.arrangement.tiles;
  const tile = { ...(tiles[kind] ?? emptyTile(kind)), lines };
  return withA(s, { ...s.arrangement, tiles: { ...tiles, [kind]: tile } });
}

export function addLine(s: BuilderState, kind: LineKind, max: number): BuilderState {
  const lines = linesOf(s, kind);
  if (lines.length >= max) return s;
  return withLines(s, kind, [...lines, ""]);
}

export function moveLine(s: BuilderState, kind: LineKind, from: number, to: number): BuilderState {
  const lines = linesOf(s, kind);
  if (from < 0 || from >= lines.length || to < 0 || to >= lines.length || from === to) return s;
  return withLines(s, kind, moved(lines, from, to));
}

export function removeLine(s: BuilderState, kind: LineKind, at: number): BuilderState {
  const lines = linesOf(s, kind);
  if (at < 0 || at >= lines.length) return s;
  return withLines(s, kind, lines.filter((_, i) => i !== at));
}
