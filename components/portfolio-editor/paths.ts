import type { BuilderState } from "@/app/(app)/portfolio/steps";
import type { HomePath } from "@/components/portfolio/home-ctx";

/*
 * Reading and writing the editor's state by a field's path (decision 0031, "Fields, and the path each
 * one has"): "profile.name", "arrangement.tiles.about.text", "arrangement.tiles.education.lines.1".
 * Pure, with no React in it. A write shares everything it did not touch with the state before it, so a
 * part of the page that reads one slice sees the same object while its slice has not changed.
 */

/** The value at `path`, or undefined where the state has nothing there (a tile nobody has typed in yet). */
export function getAt(state: BuilderState, path: HomePath): unknown {
  let v: unknown = state;
  for (const k of path.split(".")) {
    if (v === null || typeof v !== "object") return undefined;
    v = (v as Record<string, unknown>)[k];
  }
  return v;
}

/**
 * What a part of the state starts as when a write goes through it before it exists. A section can be on
 * the page before its tile has any words, and the server's schema wants a tile whole (a quote has its
 * three strings), so the first key typed in one makes the rest of it, empty. A list of lines starts with
 * none: the line being written is the first.
 */
function blankAt(path: string): unknown {
  switch (path) {
    case "arrangement.tiles.about":
      return { text: "" };
    case "arrangement.tiles.education":
    case "arrangement.tiles.experience":
      return { lines: [] };
    case "arrangement.tiles.quote":
      return { text: "", name: "", role: "" };
    default:
      return path.endsWith(".lines") ? [] : {};
  }
}

function write(node: unknown, keys: string[], i: number, value: unknown): unknown {
  if (i === keys.length) return value;
  const k = keys[i]!;
  if (Array.isArray(node)) {
    const n = Number(k);
    const next = write(node[n], keys, i + 1, value);
    if (Object.is(next, node[n]) && n < node.length) return node;
    const copy = [...node];
    // A line written past the end of its list: the lines between are empty ones.
    while (copy.length < n) copy.push("");
    copy[n] = next;
    return copy;
  }
  const obj = (node ?? {}) as Record<string, unknown>;
  const child = obj[k] ?? (i + 1 < keys.length ? blankAt(keys.slice(0, i + 1).join(".")) : undefined);
  const next = write(child, keys, i + 1, value);
  if (Object.is(next, obj[k]) && k in obj) return node;
  return { ...obj, [k]: next };
}

/** The state with `value` at `path`. The same state when nothing changes. */
export function setAtPath(state: BuilderState, path: HomePath, value: unknown): BuilderState {
  return write(state, path.split("."), 0, value) as BuilderState;
}

/** The profile's links and the LinkedIn switch: fields of the "Your links" popover (`tools("contact")`), not of the page. */
export const LINK_PATHS: readonly HomePath[] = ["profile.linkedin", "profile.github", "profile.website", "profile.contactEmail", "arrangement.header.linkedin"];
