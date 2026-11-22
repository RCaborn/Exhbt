"use client";

import { useEffect, useId, useLayoutEffect, useRef } from "react";
import { ArrowDown, ArrowUp, GripVertical, Star, Trash2 } from "lucide-react";
import { FORMAT_RULES, formatOf, type Format } from "@/lib/exhbt/formats";
import { pageItems } from "@/lib/exhbt/layouts";
import type { ExhbtDoc } from "@/lib/exhbt/blocks";
import type { ItemAs } from "@/lib/exhbt/layouts";
import { useRuntime } from "./context";
import { useBoard } from "./drag";
import { mainColumn } from "./drag/engine";
import { MoreActions } from "./draft-tools";
import { useFrame } from "./Frame";
import { labelOf } from "./labels";
import { useDoc, useStoreInternal } from "./store";
import type { Store } from "./store-core";

/*
 * A section's toolbar (decision 0026, "The chrome"): at its top corner, out of the flow, so it takes no
 * room. The grip (the only thing that drags), move up, move down, the layout's own action where there
 * is one, "More actions" where the AI drafted the part, and Remove (none on the flowchart where the
 * layout always has one). With a mouse it shows on hover and on focus within; on a touch screen wider
 * than 48rem it is always shown, at 44px; on a phone only the grip shows (css/phone.css, L's). Each
 * button has a tooltip. The buttons carry data-grip or data-tool, so other parts' CSS and tests can
 * find them.
 *
 * Where it sits (css/core.css): above the section's top right corner, in the gap over it, where the
 * gap holds it; half over the section's top edge where the gap holds half of it; inside that corner
 * where even that would cover the words above it. A picture's and a graph's
 * toolbar is always inside its corner, as in the prototype Rory tried, so in the gallery's grid it
 * never lies over the caption of the picture above. For the rest the gap is measured (`placeTools`).
 */

type Box = { x: number; y: number; w: number; h: number };

/** Where `el` is drawn on the page (placeTools never runs while anything moves by transform). */
function pageBox(el: Element): Box {
  const r = el.getBoundingClientRect();
  return { x: r.left + window.scrollX, y: r.top + window.scrollY, w: r.width, h: r.height };
}

/** Where the words in `el` are drawn, on the page; null when it has none. */
function wordsBox(el: HTMLElement): Box | null {
  const range = document.createRange();
  range.selectNodeContents(el);
  const rects = [...range.getClientRects()].filter((r) => r.width > 0 && r.height > 0);
  if (!rects.length) return null;
  const x = Math.min(...rects.map((r) => r.left));
  const y = Math.min(...rects.map((r) => r.top));
  return { x: x + window.scrollX, y: y + window.scrollY, w: Math.max(...rects.map((r) => r.right)) - x, h: Math.max(...rects.map((r) => r.bottom)) - y };
}

const overlap = (a: Box, b: Box) => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 0.5 && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 0.5;

const OUT_OF_PAGE = ".xe-insert, .xe-measure, .xe-drag-overlay, [data-edit-only]";
/** Edit-only chips and labels that may reach out of their section. */
const CHIPS = ".xe-fig-chip, .xe-fig-picked, .xe-chip, .xe-above";
/** Kinds whose toolbar is always inside the corner (css/core.css): they have a card of their own. */
const INSIDE_KINDS = new Set(["image", "graph"]);
/** Toolbars on the page, for `placeTools`. */
const toolbars = new Set<HTMLElement>();
const watched = new WeakSet<Element>();
let sizes: ResizeObserver | null = null;
let queued = 0;

/**
 * For every toolbar not inside by its kind: would it, above its section's corner, lie over any other
 * section or the words above the first row (the skills, the title, the context line)? Then it goes
 * half over the section's top edge (data-place="edge"), or where that would too, inside the corner
 * (data-place="inside"). Written straight to the toolbar, so nothing draws again; it changes only when
 * the page's rows or width do.
 */
function placeTools() {
  queued = 0;
  const main = mainColumn();
  if (!main) return;
  if (!watched.has(main)) {
    watched.add(main);
    sizes ??= new ResizeObserver(() => queuePlace());
    sizes.observe(main);
  }
  // While something is carried, or a drop or a move settles, the page is drawn by transforms: wait for it (a drop draws the toolbars again).
  if (main.hasAttribute("data-xe-drag")) return;
  const moving = main.getAnimations({ subtree: true }).filter((a) => a.id === "xe-settle" && a.playState === "running");
  if (moving.length) {
    void Promise.allSettled(moving.map((a) => a.finished)).then(queuePlace);
    return;
  }
  // What a toolbar above a section must not lie over: every other section; whatever the page draws
  // between them that is no section's (the skills, the title and the context line over the first row,
  // research's "References" over its lines); and the chips that reach out of a section ("Edit figures"
  // on a graph's foot, "Web address" on the rule between reference lines, a picked figure's label).
  const boxes = new Map<HTMLElement, Box>();
  const collect = (el: Element) => {
    for (const c of el.children) {
      if (!(c instanceof HTMLElement) || c.matches(OUT_OF_PAGE)) continue;
      if (c.matches("[data-section-id]")) for (const o of [c, ...c.querySelectorAll<HTMLElement>(CHIPS)]) boxes.set(o, pageBox(o));
      else if (c.querySelector("[data-section-id]")) collect(c);
      else {
        // The person's own words (a field) count by their whole box, however short the line; a label the layout draws ("References") by its words alone.
        const b = c.matches("[data-path]") || c.querySelector("[data-path]") ? pageBox(c) : wordsBox(c);
        if (b) boxes.set(c, b);
      }
    }
  };
  collect(main);
  // The gap a toolbar above needs: its buttons, and on a mouse the strip under them that keeps the pointer on the section.
  const bridge = window.matchMedia("(pointer: coarse)").matches ? 0 : 6;
  for (const tools of toolbars) {
    const frame = tools.parentElement;
    if (!frame || !tools.isConnected || !main.contains(tools)) continue;
    if (INSIDE_KINDS.has(frame.dataset.kind ?? "")) {
      tools.removeAttribute("data-place");
      continue;
    }
    const shown = [...tools.children].filter((c): c is HTMLElement => c instanceof HTMLElement && c.getClientRects().length > 0);
    const width = shown.reduce((w, c) => w + c.offsetWidth, 0) + 4 * Math.max(0, shown.length - 1);
    // A row of buttons is the grip's height ("More actions" wraps its button in parts that may be taller, and never shows them there).
    const height = (tools.querySelector<HTMLElement>("[data-grip]")?.offsetHeight ?? 0) + bridge;
    const f = boxes.get(frame) ?? pageBox(frame);
    const clear = (b: Box) => ![...boxes].some(([el, o]) => el !== frame && o.w > 0 && o.h > 0 && overlap(b, o));
    tools.style.removeProperty("--xe-tools-right");
    if (clear({ x: f.x + f.w - width, y: f.y - height, w: width, h: height })) {
      tools.removeAttribute("data-place");
      continue;
    }
    // A flowchart's toolbar keeps clear of its boxes' own grips and Removes on their right edges (flow.css).
    const right = frame.dataset.kind === "flow" ? 32 : 0;
    const buttons = height - bridge;
    // Half over the section's top edge, where the gap holds that half (a stack's second part, the first row under the context
    // line): it covers no more of the section's own top than its first line's right end.
    if (clear({ x: f.x + f.w - right - width, y: f.y - buttons / 2, w: width, h: buttons })) {
      tools.setAttribute("data-place", "edge");
      continue;
    }
    tools.setAttribute("data-place", "inside");
    // Inside the corner, it keeps clear of the chips there (a reference line's "Web address" sits on the rule under it, and the one above's on the rule over it).
    const inside = { x: f.x + f.w - Math.max(right, 8) - width, y: f.y + 8, w: width, h: buttons };
    const chips = [...boxes].filter(([el, b]) => el.matches(CHIPS) && b.w > 0 && overlap(inside, b)).map(([, b]) => b);
    if (chips.length) tools.style.setProperty("--xe-tools-right", `${Math.ceil(f.x + f.w - Math.min(...chips.map((b) => b.x)) + 4)}px`);
    else tools.style.removeProperty("--xe-tools-right");
  }
}

/** Places the toolbars before the next paint. */
function queuePlace() {
  if (!queued) queued = requestAnimationFrame(placeTools);
}

/** Registers the toolbar for `placeTools`, and places them all again whenever one draws (a section moved, came or went). */
function usePlace(ref: React.RefObject<HTMLDivElement | null>) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    toolbars.add(el);
    return () => {
      toolbars.delete(el);
      queuePlace();
    };
  }, [ref]);
  useLayoutEffect(queuePlace);
}

/** One of the layout's own actions for a page item, as the toolbar draws it and the phone's bar (L's PhoneBar.tsx) does. */
export type LayoutAction = { name: string; tool: "action"; pressed?: boolean; run(): void; icon?: React.ReactNode };

/**
 * The layout's own actions for page item `id` (of `kind`) in layout `f`: "Make lead image" or "Make
 * key figure" while it is not the one, or Before and After on a before-and-after picture; none for
 * anything else. `as`, how the page draws the item, says whether it is the lead or key figure already
 * (the toolbar has it from its frame); without it the page's order says, worked out from `d`.
 */
export function actionsFor(d: ExhbtDoc, id: string, kind: string, f: Format, store: Store, as?: ItemAs): LayoutAction[] {
  const first = FORMAT_RULES[f].first;
  const leads = (it: { kind: string }) => (first?.kinds as readonly string[] | undefined)?.includes(it.kind) ?? false;
  if (first && leads({ kind })) {
    const already = as !== undefined ? as === first.as : pageItems(d).find(leads)?.id === id;
    if (already) return [];
    // The lead's place is read when the button is pressed: working out the page's items for every toolbar each time it draws (every frame's, at a drop) costs more than the press.
    const lead = () => pageItems(store.get()).findIndex(leads);
    return [{ name: first.as === "lead" ? "Make lead image" : "Make key figure", tool: "action", icon: <Star aria-hidden size={15} strokeWidth={2.25} />, run: () => store.move(id, Math.max(0, lead())) }];
  }
  if (f === "before-after" && kind === "image") {
    const s = d.sections.find((x) => x.id === id);
    const stage = s?.kind === "image" ? s.stage : undefined;
    const label = labelOf(d, id).toLowerCase();
    return (["before", "after"] as const).map((v) => ({
      name: v === "before" ? "Before" : "After",
      tool: "action",
      pressed: stage === v,
      run: () => store.patch(id, (x) => (x.kind === "image" ? (x.stage === v ? (({ stage: _s, ...rest }) => (void _s, rest))(x) : { ...x, stage: v }) : x), `${v} on ${label}`),
    }));
  }
  return [];
}

function Tool({ name, tool, onClick, disabled, pressed, children }: { name: string; tool: string; onClick(): void; disabled?: boolean; pressed?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" className="xe-tool" data-tool={tool} aria-label={name} data-tip={name} aria-pressed={pressed} disabled={disabled} onClick={onClick}>
      {children}
    </button>
  );
}

const MOVES = new Set(["ArrowLeft", "ArrowRight", "Home", "End"]);

/**
 * Roving focus for a toolbar (the WAI-ARIA toolbar pattern; the review's accessibility-6), here and on
 * the phone's bar: the toolbar is one Tab stop, the left and right arrows move along its buttons in
 * the order they are drawn (a toolbar inside a picture's corner runs leftwards from its grip), and
 * Home and End go to its ends. The stop is the button last in focus while the focus is in the toolbar,
 * and its first button (a section's grip) once the focus leaves, so a hidden or disabled button never
 * holds it. A menu the toolbar opens ("More actions") keeps its own buttons. While anything is carried
 * the keys are the drag's: the grip's arrows move a section only while it is carried, and move along
 * the toolbar only while nothing is. Written straight to the buttons' tabindex: nothing draws again.
 */
export function useRoving(ref: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const bar = ref.current;
    if (!bar) return;
    let current: HTMLElement | null = null;
    const all = () => {
      const menus = [...bar.querySelectorAll("[aria-controls]")].map((t) => document.getElementById(t.getAttribute("aria-controls") ?? ""));
      return [...bar.querySelectorAll<HTMLElement>("button")].filter((b) => !b.closest("form") && !menus.some((m) => m?.contains(b)));
    };
    const usable = (b: HTMLElement) => b.getClientRects().length > 0 && !(b as HTMLButtonElement).disabled;
    /** The buttons that can take the focus, in the order they are drawn: row by row, left to right. */
    const drawn = () =>
      all()
        .filter(usable)
        .map((b) => ({ b, r: b.getBoundingClientRect() }))
        .sort((p, q) => (Math.abs(p.r.top - q.r.top) > 4 ? p.r.top - q.r.top : p.r.left - q.r.left))
        .map(({ b }) => b);
    const sync = () => {
      const list = all();
      const stop = current && list.includes(current) && usable(current) ? current : (list.find(usable) ?? null);
      for (const b of list) {
        const want = b === stop ? 0 : -1;
        if (b.tabIndex !== want) b.tabIndex = want;
      }
    };
    const onFocusIn = (e: FocusEvent) => {
      if (!all().includes(e.target as HTMLElement)) return;
      current = e.target as HTMLElement;
      sync();
    };
    const onFocusOut = (e: FocusEvent) => {
      if (bar.contains(e.relatedTarget as Node | null)) return;
      current = null;
      sync();
    };
    const onKey = (e: KeyboardEvent) => {
      if (!MOVES.has(e.key) || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || document.querySelector("[data-xe-drag]")) return;
      const list = drawn();
      const at = list.indexOf(e.target as HTMLElement);
      if (at < 0) return;
      e.preventDefault();
      const to = e.key === "ArrowRight" ? list[at + 1] : e.key === "ArrowLeft" ? list[at - 1] : e.key === "Home" ? list[0] : list[list.length - 1];
      to?.focus();
    };
    // Buttons come and go (an action, More actions, the phone's bar following another part), and Move up or down turns off at an end.
    const changes = new MutationObserver(sync);
    changes.observe(bar, { subtree: true, childList: true, attributes: true, attributeFilter: ["disabled", "hidden"] });
    bar.addEventListener("focusin", onFocusIn);
    bar.addEventListener("focusout", onFocusOut);
    bar.addEventListener("keydown", onKey);
    sync();
    return () => {
      changes.disconnect();
      bar.removeEventListener("focusin", onFocusIn);
      bar.removeEventListener("focusout", onFocusOut);
      bar.removeEventListener("keydown", onKey);
    };
  }, [ref]);
}

/** Why the flowchart can't be removed in layout `f` (decision 0026; the review's vision-3), or null where it can. */
export function whyFlowStays(f: Format): string | null {
  if (FORMAT_RULES[f].flowRemovable) return null;
  return f === "case-study" ? "A case study always has a flowchart. Choose another layout to take it off." : `${FORMAT_RULES[f].name} always has a flowchart. Choose another layout to take it off.`;
}

export function Toolbar() {
  const frame = useFrame();
  const store = useStoreInternal();
  const board = useBoard();
  const { uiApi } = useRuntime();
  const id = frame?.id ?? "";
  const label = useDoc((d) => labelOf(d, id));
  const f = useDoc((d) => formatOf(d));
  // The layout's action depends on the page's order; read when the frame draws (it draws on every structural change).
  const actions = frame ? actionsFor(store.get(), id, frame.kind, f, store, frame.as) : [];
  const ref = useRef<HTMLDivElement>(null);
  const why = useId();
  usePlace(ref);
  useRoving(ref);
  if (!frame) return null;
  const { place, count, kind } = frame;
  const stays = kind === "flow" ? whyFlowStays(f) : null;
  const block = kind === "flow" ? "flow" : kind === "findings" ? "findings" : null;
  return (
    <div ref={ref} className="xe-tools" data-edit-only role="toolbar" aria-label={`${label}: tools`}>
      <button type="button" className="xe-tool xe-grip" data-grip aria-label={`Drag ${label} to move it`} data-tip={`Drag ${label} to move it`} {...board.grip(id)}>
        <GripVertical aria-hidden size={16} strokeWidth={2.25} />
      </button>
      <Tool name={`Move ${label} up`} tool="up" disabled={place <= 0} onClick={() => board.moveBy(id, -1)}>
        <ArrowUp aria-hidden size={15} strokeWidth={2.25} />
      </Tool>
      <Tool name={`Move ${label} down`} tool="down" disabled={place >= count - 1} onClick={() => board.moveBy(id, 1)}>
        <ArrowDown aria-hidden size={15} strokeWidth={2.25} />
      </Tool>
      {actions.map((a) => (
        <Tool key={a.name} name={a.name} tool={a.tool} pressed={a.pressed} onClick={a.run}>
          {a.icon ?? <span className="xe-tool-word">{a.name}</span>}
        </Tool>
      ))}
      {block && (
        <span className="xe-more" data-tool="more">
          <MoreActions block={block} />
        </span>
      )}
      {stays ? (
        // Where the layout always has a flowchart, Remove is there but off, as a box's is at three boxes: focused, its reason is its
        // description and its tooltip; pressed, the reason is said, and shown (a touch screen has no tooltips) until the focus moves on.
        <>
          <button
            type="button"
            className="xe-tool"
            data-tool="remove"
            aria-label={`Remove ${label}`}
            aria-disabled="true"
            aria-describedby={why}
            data-tip={stays}
            onClick={(e) => {
              uiApi.say(stays);
              e.currentTarget.setAttribute("data-explain", "");
            }}
            onBlur={(e) => e.currentTarget.removeAttribute("data-explain")}
          >
            <Trash2 aria-hidden size={15} strokeWidth={2.25} />
          </button>
          <span id={why} hidden>
            {stays}
          </span>
        </>
      ) : (
        <Tool name={`Remove ${label}`} tool="remove" onClick={() => board.remove(id)}>
          <Trash2 aria-hidden size={15} strokeWidth={2.25} />
        </Tool>
      )}
    </div>
  );
}
