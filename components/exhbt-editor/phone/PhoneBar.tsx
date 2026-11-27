"use client";

import "../css/phone.css";
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode, type RefObject } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Bold, Highlighter, Italic, Link2, Plus, Star, Trash2, Undo2, Unlink, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { ExhbtDoc } from "@/lib/exhbt/blocks";
import type { DraftBlock } from "@/lib/exhbt/draft-blocks";
import { FORMAT_COPY, formatOf, type Format } from "@/lib/exhbt/formats";
import { pageItems, type PageItem } from "@/lib/exhbt/layouts";
import { useActiveRich, useRuntime, useUiState, type ActiveRich } from "../context";
import { MoreActions } from "../draft-tools";
import { useBoard } from "../drag";
import { jumpTo } from "../jump";
import { labelOf } from "../labels";
import { useStoreInternal } from "../store";
import type { Store } from "../store-core";
import { actionsFor, useRoving } from "../Toolbar";
import { usePhone } from "./usePhone";

/*
 * The bar at the foot of a phone's screen (decision 0026, "On a phone"). Only on a phone (usePhone),
 * and not in "See as a visitor". It follows the part the focus is in, or was last in (or was last
 * tapped: a picture takes no focus), names it, and holds its actions at 44px:
 *  - a section: Move up, Move down, the layout's own action, More actions where the AI drafted it,
 *    Remove (on every section in every layout, the flowchart too: decision 0032), Reorder. They go
 *    through the drag board (`moveBy`, `remove`) and the store, as the section's own toolbar does;
 *  - the title, the context line or the skills: the part's More actions, and Reorder; a tapped skill
 *    is named, with "Remove <skill>" (the pills' own remove buttons are hidden on a phone);
 *  - nothing yet: Add (the "+" at the end of the page) and Reorder;
 *  - while a formatted field has the cursor: its formatting buttons (Highlight on the context line;
 *    Bold and Italic elsewhere; Link where the field takes links, so not in a quote, a pull quote or
 *    a link's description: decision 0032), a finding's own move and remove, and Done. A press on them
 *    never takes the cursor out of the field.
 * After a move, a remove or a drop it offers "Undo: <what>" above the row until the next change, so a
 * wrong thumb is put right where it happened. It sits on the on-screen keyboard (visualViewport) and
 * keeps the line being typed clear of itself; its height is --xe-phonebar-h on the root, which lifts
 * the upload status line above it and leaves room at the foot of the page (css/phone.css).
 */

export function PhoneBar(): ReactNode {
  const phone = usePhone();
  const visitor = useUiState((s) => s.visitor);
  if (!phone || visitor) return null;
  return <Bar />;
}

type ShellBlock = "header" | "gap" | "skills";
/** `skill`: the pill tapped, by its words (a pill takes no focus). */
type Part = { section: string } | { shell: ShellBlock; skill?: string };

const ICON = { "aria-hidden": true, size: 18, strokeWidth: 2.25 } as const;
const FIELD = 'textarea, input:not([type=file]):not([type=hidden]):not([type=checkbox]):not([type=radio]), [contenteditable]:not([contenteditable="false"]), [role=textbox]';
const FINDING = /^sections\.(\d+)\.items\.(\d+)$/;
const HEADER = new Set(["title", "context", "whereWhen", "myRole"]);

function Bar() {
  const store = useStoreInternal();
  const ref = useRef<HTMLDivElement>(null);
  const rich = useActiveRich();
  const where = useWhere();
  const undo = useUndoOffer(store);
  useBarHeight(ref);
  useKeyboard(ref);
  useMenusInView();
  // One Tab stop, the arrows along it (Toolbar.tsx).
  useRoving(ref);

  const section = where.part && "section" in where.part ? where.part.section : null;
  const info = useSectionInfo(section);
  const shell = where.part && "shell" in where.part ? where.part.shell : null;
  // A tapped skill, while it is still one (Remove takes it away, and the bar goes back to the skills).
  const tapped = where.part && "shell" in where.part ? where.part.skill : undefined;
  const skill = useSyncExternalStore(store.subscribe, () => (tapped && store.get().skills.includes(tapped) ? tapped : null), () => null);
  const name = rich ? null : info ? info.label : skill ? skill : shell ? FORMAT_COPY[formatOf(store.shell())][shell] : null;

  return (
    <div
      ref={ref}
      className="xe-phonebar"
      data-edit-only
      role="toolbar"
      aria-label={rich ? "Formatting" : name ? `${name}: tools` : "Section tools"}
      // While a formatted field has the cursor, a press on the bar never takes it out (the keyboard stays up).
      onMouseDown={(e) => {
        if (rich && (e.target as Element).closest("button")) e.preventDefault();
      }}
    >
      {undo && <UndoOffer label={undo} store={store} />}
      <div className="xe-bar-row">
        {rich ? (
          <Formatting rich={rich} path={where.path} />
        ) : section && info ? (
          <SectionTools key={section} id={section} info={info} />
        ) : shell ? (
          <ShellTools block={shell} name={name!} skill={skill} />
        ) : (
          <NothingYet />
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------------------------------
 * What the bar follows
 * ---------------------------------------------------------------------------------------------- */

/** The part a focused or tapped element belongs to; undefined for anything else (the bar, the top bar, a sheet, a "+"), which leaves the bar as it was. */
function partAt(el: Element): Part | undefined {
  if (!el.closest('[data-editor="page"] article[data-exhbt-page]')) return undefined;
  const frame = el.closest("[data-section-id]");
  if (frame) return { section: frame.getAttribute("data-section-id")! };
  const path = el.closest("[data-path]")?.getAttribute("data-path") ?? "";
  if (HEADER.has(path)) return { shell: "header" };
  if (path === "gap") return { shell: "gap" };
  if (path.startsWith("skills.")) {
    // A pill holds its skill's words, then (on a wider screen) its remove button.
    const skill = el.closest('[data-path^="skills."]')?.firstChild?.textContent?.trim();
    return skill ? { shell: "skills", skill } : { shell: "skills" };
  }
  if (path === "skills") return { shell: "skills" };
  return undefined;
}

const keyOf = (p: Part | null) => (!p ? "" : "section" in p ? `s:${p.section}` : `p:${p.shell}${p.skill ? `:${p.skill}` : ""}`);

/** The part the focus is in or was last in (or that was last tapped), and the path of the field the focus was last in. */
function useWhere(): { part: Part | null; path: string | null } {
  const board = useBoard();
  const [where, setWhere] = useState<{ part: Part | null; path: string | null }>(() => {
    const id = board.lastFocus();
    return { part: id ? { section: id } : null, path: null };
  });
  useEffect(() => {
    const note = (target: EventTarget | null, focus: boolean) => {
      if (!(target instanceof Element)) return;
      const part = partAt(target);
      if (!part) return;
      const path = focus && target.matches(FIELD) ? (target.closest("[data-path]")?.getAttribute("data-path") ?? null) : undefined;
      setWhere((w) => {
        const nextPath = path === undefined ? (keyOf(w.part) === keyOf(part) ? w.path : null) : path;
        return keyOf(w.part) === keyOf(part) && w.path === nextPath ? w : { part, path: nextPath };
      });
    };
    const onFocus = (e: FocusEvent) => note(e.target, true);
    // A tap on a picture, which takes no focus.
    const onClick = (e: MouseEvent) => note(e.target, false);
    document.addEventListener("focusin", onFocus);
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("focusin", onFocus);
      document.removeEventListener("click", onClick, true);
    };
  }, []);
  return where;
}

type Info = { label: string; place: number; count: number; kind: PageItem["kind"]; f: Format; stage: "before" | "after" | undefined };

/** A section's name, place and kind, worked out once per structure (the shell doc changes only when they can). */
const infoCache = new WeakMap<ExhbtDoc, Map<string, Info | null>>();
function infoOf(d: ExhbtDoc, id: string): Info | null {
  let byId = infoCache.get(d);
  if (!byId) infoCache.set(d, (byId = new Map()));
  if (byId.has(id)) return byId.get(id)!;
  const items = pageItems(d);
  const place = items.findIndex((it) => it.id === id);
  const s = d.sections.find((x) => x.id === id);
  const info: Info | null = place < 0 ? null : { label: labelOf(d, id), place, count: items.length, kind: items[place]!.kind, f: formatOf(d), stage: s?.kind === "image" ? s.stage : undefined };
  byId.set(id, info);
  return info;
}

/** The section's name, place and kind, or null when it is not on the page. */
function useSectionInfo(id: string | null): Info | null {
  const store = useStoreInternal();
  const get = () => (id ? infoOf(store.shell(), id) : null);
  return useSyncExternalStore(store.subscribe, get, get);
}

/** The newest undo entry while it is a move, a remove or a drop made since the last change, or null. */
function useUndoOffer(store: Store): string | null {
  const [label, setLabel] = useState<string | null>(null);
  useEffect(() => {
    const seen = new WeakSet<object>(store.entries());
    let version = store.version();
    return store.subscribe(() => {
      if (store.version() === version) return;
      version = store.version();
      const list = store.entries();
      const top = list[list.length - 1];
      const fresh = Boolean(top && !seen.has(top));
      if (top) seen.add(top);
      setLabel(fresh && top && /^(move|remove) /.test(top.label) ? top.label : null);
    });
  }, [store]);
  return label;
}

/* ------------------------------------------------------------------------------------------------
 * The rows
 * ---------------------------------------------------------------------------------------------- */

function UndoOffer({ label, store }: { label: string; store: Store }) {
  const { uiApi } = useRuntime();
  return (
    <div className="xe-bar-undo">
      <Button
        size="sm"
        className="xe-bar-btn"
        label={`Undo: ${label}`}
        onClick={() => {
          if (!store.undoLabel()) return;
          // Where the focus goes after it is the editor's rule for every undo (EditorShell.tsx, UndoKeys).
          uiApi.say(store.undo().words);
        }}
      >
        <Undo2 {...ICON} className="shrink-0" />
        <span className="xe-bar-undo-text">Undo: {label}</span>
      </Button>
    </div>
  );
}

function ReorderButton() {
  const { uiApi } = useRuntime();
  return (
    <Button size="sm" className="xe-bar-btn" data-tool="reorder" label="Reorder sections" onClick={() => uiApi.open("reorder")}>
      <ArrowUpDown {...ICON} className="shrink-0" />
      Reorder
    </Button>
  );
}

function SectionTools({ id, info }: { id: string; info: Info }) {
  const store = useStoreInternal();
  const board = useBoard();
  const { label, place, count, kind, f } = info;
  const block: DraftBlock | null = kind === "flow" ? "flow" : kind === "findings" ? "findings" : null;
  return (
    <>
      <span className="xe-bar-name">{label}</span>
      <Button size="sm" className="xe-bar-btn" data-tool="up" label={`Move ${label} up`} disabled={place <= 0} onClick={() => board.moveBy(id, -1)}>
        <ArrowUp {...ICON} />
      </Button>
      <Button size="sm" className="xe-bar-btn" data-tool="down" label={`Move ${label} down`} disabled={place >= count - 1} onClick={() => board.moveBy(id, 1)}>
        <ArrowDown {...ICON} />
      </Button>
      {/* The layout's own actions, as the section's toolbar has them (Toolbar.tsx); the lead's star at the bar's size. */}
      {actionsFor(store.get(), id, kind, f, store).map((a) => (
        <Button key={a.name} size="sm" className="xe-bar-btn" data-tool="action" label={a.name} aria-pressed={a.pressed} onClick={a.run}>
          {a.icon ? <Star {...ICON} /> : a.name}
        </Button>
      ))}
      {block && (
        <span className="xe-bar-more">
          <MoreActions block={block} />
        </span>
      )}
      <Button size="sm" className="xe-bar-btn" data-tool="remove" label={`Remove ${label}`} onClick={() => board.remove(id)}>
        <Trash2 {...ICON} />
      </Button>
      <ReorderButton />
    </>
  );
}

/** A shell part's tools: its More actions, and Reorder; for a tapped skill, its name and "Remove <skill>" first (the pills' own remove buttons are hidden on a phone). */
function ShellTools({ block, name, skill }: { block: ShellBlock; name: string; skill: string | null }) {
  const store = useStoreInternal();
  const { uiApi } = useRuntime();
  return (
    <>
      <span className="xe-bar-name">{name}</span>
      {skill && (
        <Button
          size="sm"
          className="xe-bar-btn"
          data-tool="remove"
          label={`Remove ${skill}`}
          onClick={() => {
            store.patchDoc((d) => ({ ...d, skills: d.skills.filter((x) => x !== skill) }));
            uiApi.say(`${skill} removed.`);
          }}
        >
          <Trash2 {...ICON} />
        </Button>
      )}
      <span className="xe-bar-more">
        <MoreActions block={block} />
      </span>
      <ReorderButton />
    </>
  );
}

/** A "+" menu opened low on the screen is brought into view, clear of the bar (the root's scroll-padding-bottom). */
function menuInView(insert: Element | null | undefined) {
  requestAnimationFrame(() => requestAnimationFrame(() => insert?.querySelector("[data-xe-menu]")?.scrollIntoView({ block: "nearest" })));
}

/** Every "+" the person opens: its menu in view. */
function useMenusInView() {
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const plus = (e.target as Element | null)?.closest?.('[data-editor="page"] .xe-insert .xe-plus');
      if (plus) menuInView(plus.closest(".xe-insert"));
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);
}

function NothingYet() {
  const { uiApi } = useRuntime();
  const add = () => {
    // The "+" at the end of the page, with its menu open (jump.ts lands on it; Insert.tsx opens on the jump), clear of the bar.
    uiApi.jumpTo("sections");
    menuInView(document.querySelector('[data-editor="page"] .xe-insert[data-end]'));
  };
  return (
    <>
      <span className="xe-bar-name xe-bar-hint">Tap a section</span>
      <Button size="sm" className="xe-bar-btn" label="Add a section at the end" onClick={add}>
        <Plus {...ICON} className="shrink-0" />
        Add
      </Button>
      <ReorderButton />
    </>
  );
}

/** While a formatted field has the cursor: its buttons, a finding's own controls, and Done. */
function Formatting({ rich, path }: { rich: ActiveRich; path: string | null }) {
  const store = useStoreInternal();
  const m = path ? FINDING.exec(path) : null;
  const at = m ? Number(m[1]) : -1;
  const k = m ? Number(m[2]) : -1;
  const n = useDocNumber(store, (d) => {
    const s = d.sections[at];
    return s?.kind === "findings" ? s.items.length : 0;
  });
  const finding = m && n > 0 && k < n;

  const done = () => {
    const a = document.activeElement as HTMLElement | null;
    // The section's grip takes the focus (the keyboard goes down; the bar shows the section's actions again), or the field just lets it go.
    const grip = a?.closest("[data-section-id]")?.querySelector<HTMLElement>("[data-grip]");
    if (grip) grip.focus({ preventScroll: true });
    else a?.blur();
  };
  const moveFinding = (to: number) => {
    const s = store.get().sections[at];
    if (s?.kind !== "findings") return;
    store.listMove(s.id, k, to);
    requestAnimationFrame(() => jumpTo(`sections.${at}.items.${to}`));
  };
  const removeFinding = () => {
    const s = store.get().sections[at];
    if (s?.kind !== "findings") return;
    store.listRemove(s.id, k);
    // The cursor goes to the finding that took its place; with none left, to "Add a finding" (the list's own anchor).
    requestAnimationFrame(() => jumpTo(n > 1 ? `sections.${at}.items.${Math.min(k, n - 2)}` : `sections.${at}.items`));
  };

  return (
    <>
      {rich.highlight ? (
        <Button size="sm" className="xe-bar-btn" label="Highlight" aria-pressed={rich.bold} onClick={() => rich.toggleBold()}>
          <Highlighter {...ICON} className="shrink-0" />
          Highlight
        </Button>
      ) : (
        <>
          <Button size="sm" className="xe-bar-btn" label="Bold" aria-pressed={rich.bold} onClick={() => rich.toggleBold()}>
            <Bold {...ICON} />
          </Button>
          <Button size="sm" className="xe-bar-btn" label="Italic" aria-pressed={rich.italic} onClick={() => rich.toggleItalic()}>
            <Italic {...ICON} />
          </Button>
        </>
      )}
      {rich.links && (
        <Button size="sm" className="xe-bar-btn" label={rich.link ? "Remove link" : "Link"} onClick={() => rich.toggleLink()}>
          {rich.link ? <Unlink {...ICON} /> : <Link2 {...ICON} />}
        </Button>
      )}
      {finding && (
        <>
          <Button size="sm" className="xe-bar-btn" label={`Move finding ${k + 1} up`} disabled={k === 0} onClick={() => moveFinding(k - 1)}>
            <ArrowUp {...ICON} />
          </Button>
          <Button size="sm" className="xe-bar-btn" label={`Move finding ${k + 1} down`} disabled={k >= n - 1} onClick={() => moveFinding(k + 1)}>
            <ArrowDown {...ICON} />
          </Button>
          <Button size="sm" className="xe-bar-btn" label={`Remove finding ${k + 1}`} onClick={removeFinding}>
            <X {...ICON} />
          </Button>
        </>
      )}
      <span className="xe-bar-gap" />
      <Button size="sm" className="xe-bar-btn" onClick={done}>
        Done
      </Button>
    </>
  );
}

/** A number from the doc, drawn again only when it changes. */
function useDocNumber(store: Store, select: (d: ExhbtDoc) => number): number {
  const get = () => select(store.get());
  return useSyncExternalStore(store.subscribe, get, get);
}

/* ------------------------------------------------------------------------------------------------
 * The bar's height, and the on-screen keyboard
 * ---------------------------------------------------------------------------------------------- */

/** The bar's height as --xe-phonebar-h on the root: the status line sits above it, the page leaves room for it, and a jump keeps clear of it (css/phone.css). */
function useBarHeight(ref: RefObject<HTMLDivElement | null>) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const root = document.documentElement;
    let last = -1;
    const set = () => {
      const h = Math.ceil(el.offsetHeight);
      if (h === last) return;
      last = h;
      root.style.setProperty("--xe-phonebar-h", `${h}px`);
    };
    set();
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => {
      ro.disconnect();
      root.style.removeProperty("--xe-phonebar-h");
    };
  }, [ref]);
}

/** Where the caret is, for a formatted field: the end of the selection. */
function caretRect(el: HTMLElement): DOMRect | null {
  if (!el.isContentEditable) return null;
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount || !el.contains(sel.focusNode)) return null;
  const range = document.createRange();
  range.setStart(sel.focusNode!, sel.focusOffset);
  range.collapse(true);
  const rects = range.getClientRects();
  const r = rects[rects.length - 1] ?? range.getBoundingClientRect();
  return r.height > 0 ? r : null;
}

/** Scrolls the page so the line being typed (or the field, or the link prompt's input) sits above the bar. */
function keepInView(bar: HTMLElement) {
  const a = document.activeElement as HTMLElement | null;
  if (!a || !a.matches(FIELD) || !a.closest('[data-editor="page"]') || a.closest(".xe-phonebar, dialog")) return;
  const floor = bar.getBoundingClientRect().top - 8;
  const top = (document.querySelector('[data-editor="page"] [data-topbar]')?.getBoundingClientRect().bottom ?? 0) + 8;
  const caret = caretRect(a);
  const r = caret ?? a.getBoundingClientRect();
  if (r.bottom <= floor) return;
  // Never so far that the field's top goes under the top bar (a tall field with the caret in its middle).
  const by = caret ? r.bottom - floor : Math.min(r.bottom - floor, Math.max(0, r.top - top));
  if (by > 0) window.scrollBy({ top: by, behavior: "instant" });
}

/**
 * The on-screen keyboard: the bar follows the foot of the visual viewport, so it sits on the keyboard
 * rather than under it, and the line being typed is kept clear of it. A pinch zoom is not a keyboard.
 */
function useKeyboard(ref: RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const el = ref.current;
    const vv = window.visualViewport;
    if (!el || !vv) return;
    let frame = 0;
    let keep = false;
    let lift = 0;
    const run = () => {
      frame = 0;
      // Where the bar's foot would be with no lift (the foot of the layout viewport), against the foot of what can be seen.
      // A keyboard takes height only: a zoom, or a page wider than the screen, changes the width too, and is not one.
      const foot = el.getBoundingClientRect().bottom + lift;
      const keyboard = Math.abs(vv.scale - 1) < 0.01 && Math.abs(window.innerWidth - vv.width) < 1;
      const next = keyboard ? Math.max(0, Math.round(foot - (vv.offsetTop + vv.height))) : 0;
      if (next !== lift) {
        lift = next;
        el.style.transform = lift ? `translateY(${-lift}px)` : "";
        el.toggleAttribute("data-keyboard", lift > 0);
      }
      if (keep) {
        keep = false;
        keepInView(el);
      }
    };
    const schedule = (k: boolean) => {
      keep ||= k;
      if (!frame) frame = requestAnimationFrame(run);
    };
    // The keyboard opening or closing, and the caret moving or a field taking the focus, keep the line in view; a scroll only moves the bar.
    const onResize = () => schedule(true);
    const onScroll = () => schedule(false);
    const onCaret = () => schedule(true);
    vv.addEventListener("resize", onResize);
    vv.addEventListener("scroll", onScroll);
    document.addEventListener("selectionchange", onCaret);
    document.addEventListener("focusin", onCaret);
    run();
    return () => {
      cancelAnimationFrame(frame);
      vv.removeEventListener("resize", onResize);
      vv.removeEventListener("scroll", onScroll);
      document.removeEventListener("selectionchange", onCaret);
      document.removeEventListener("focusin", onCaret);
      el.style.transform = "";
      el.removeAttribute("data-keyboard");
    };
  }, [ref]);
}
