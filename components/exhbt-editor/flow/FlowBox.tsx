"use client";

import { createContext, useContext, useMemo, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS as DndCSS } from "@dnd-kit/utilities";
import { GripVertical, Plus, X } from "lucide-react";
import { useReducedMotion } from "@/components/ui/useReducedMotion";
import { LIMITS } from "@/lib/exhbt/blocks";
import { useRuntime } from "../context";
import { holdFocus, notePointer } from "../drag/grip";
import { FLOW_BOX_STYLE } from "../drag/options";
import { useStoreInternal } from "../store";

/*
 * A flowchart box on the editing page (decision 0026): the <li> MethodFlow describes, which is the
 * thing dragged, its grip and Remove, and the "+" in each arrow. Every control is positioned over the
 * flowchart and takes no room (css/flow.css), so the boxes and arrows sit where the visitor's page
 * draws them. They carry data-flow-*, never data-grip or data-tool, which are a section's toolbar's.
 */

/** 180ms, transforms only (DESIGN.md). */
export const MOVE_MS = 180;
export const EASE = "cubic-bezier(0.2, 0, 0, 1)";

/** Why Remove is off at the fewest boxes: the count issue's own words (lib/exhbt/blocks.ts). */
export const MIN_WORDS = `The flowchart needs at least ${LIMITS.flow.min} boxes.`;
/** The id of the hidden line that says so, for Remove's aria-describedby (drawn once, by the list). */
export const MIN_ID = "xe-flow-min";

/** What a box gives the tools inside it: its lasting key and its grip's drag props. */
type BoxCtx = { boxKey: string; setGrip(el: HTMLElement | null): void; grip: Record<string, unknown> };
const BoxContext = createContext<BoxCtx | null>(null);

const later = (fn: () => void) => requestAnimationFrame(() => requestAnimationFrame(fn));

/** Puts the cursor in a box's words, found by its lasting key. */
export function focusBox(key: string | undefined) {
  if (!key) return;
  document.querySelector<HTMLElement>(`[data-editor="page"] [data-flow-step="${CSS.escape(key)}"] [data-path$=".step"]`)?.focus();
}

export function FlowBox({ boxKey, className, children }: { boxKey: string; className: string; children: ReactNode }) {
  const slide = FLOW_BOX_STYLE === "slide";
  const reduced = useReducedMotion();
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: boxKey,
    // Slide style: the others move aside, 180ms, transforms only. Line: the box stays where it is while it, or another, is carried.
    transition: slide && !reduced ? { duration: MOVE_MS, easing: EASE } : null,
    // The drop's own motion is the list's (FlowList.tsx, settle), from where each box was drawn; not dnd-kit's.
    animateLayoutChanges: () => false,
    attributes: { roleDescription: "draggable box" },
  });
  // dnd-kit's own listeners, and a mouse's press leaves the focus on the grip, in Safari too (drag/grip.ts).
  const grip = useMemo(
    () => ({
      ...attributes,
      ...listeners,
      onPointerDown: notePointer,
      onMouseDown: (e: ReactMouseEvent<HTMLElement>) => {
        listeners?.onMouseDown?.(e);
        holdFocus(e);
      },
    }),
    [attributes, listeners],
  );
  const ctx = useMemo<BoxCtx>(() => ({ boxKey, setGrip: setActivatorNodeRef, grip }), [boxKey, setActivatorNodeRef, grip]);
  return (
    <BoxContext value={ctx}>
      <li
        ref={setNodeRef}
        data-flow-step={boxKey}
        data-dragging={isDragging || undefined}
        className={className}
        style={slide ? { transform: DndCSS.Translate.toString(transform), transition: transition ?? undefined } : undefined}
      >
        {children}
      </li>
    </BoxContext>
  );
}

/** A box's grip and Remove, over its edge (css/flow.css). Remove is off at the fewest boxes, and says why. */
export function BoxTools({ index, count }: { index: number; count: number }) {
  const box = useContext(BoxContext);
  const store = useStoreInternal();
  const { uiApi } = useRuntime();
  if (!box) return null;
  const n = index + 1;
  const off = count <= LIMITS.flow.min;
  const remove = () => {
    if (off) return uiApi.say(MIN_WORDS);
    const at = store.flowKeys().indexOf(box.boxKey);
    if (at < 0) return;
    store.flowRemove(box.boxKey);
    uiApi.say(`Box ${at + 1} removed.`);
    // The focus goes to the box that took its place, or the new last one.
    later(() => {
      const keys = store.flowKeys();
      focusBox(keys[Math.min(at, keys.length - 1)]);
    });
  };
  return (
    <span className="xe-flow-tools" data-edit-only role="group" aria-label={`Box ${n} tools`}>
      <button type="button" ref={box.setGrip} className="xe-flow-chip xe-flow-grip" data-flow-grip={n} aria-label={`Drag box ${n} to move it`} data-tip={`Drag box ${n} to move it`} {...box.grip}>
        <GripVertical aria-hidden size={15} strokeWidth={2.25} />
      </button>
      <button
        type="button"
        className="xe-flow-chip"
        data-flow-remove={n}
        aria-label={`Remove box ${n}`}
        aria-disabled={off || undefined}
        aria-describedby={off ? MIN_ID : undefined}
        data-tip={off ? MIN_WORDS : `Remove box ${n}`}
        onClick={remove}
      >
        <X aria-hidden size={14} strokeWidth={2.5} />
      </button>
    </span>
  );
}

/**
 * The "+" in the arrow after box `after` ("Add a box after box 2"), and after the last ("Add a box at
 * the end"): over the arrow, taking no room. None at the most boxes. With no boxes at all, the one
 * button there is, in the flow: the empty flowchart's placeholder.
 */
export function AddBox({ after, count }: { after: number; count: number }) {
  const store = useStoreInternal();
  const { uiApi } = useRuntime();
  if (count >= LIMITS.flow.max) return null;
  const at = after + 1;
  const end = after === count - 1;
  const name = count === 0 ? "Add a box" : end ? "Add a box at the end" : `Add a box after box ${after + 1}`;
  const add = () => {
    const key = store.flowAdd(at);
    if (!key) return uiApi.say(`Up to ${LIMITS.flow.max} boxes in the flowchart.`);
    uiApi.say(`Box added in place ${at + 1} of ${count + 1}.`);
    later(() => focusBox(key));
  };
  if (count === 0)
    return (
      <button type="button" className="xe-flow-first" data-edit-only data-flow-add={at} onClick={add}>
        <Plus aria-hidden size={14} strokeWidth={2.5} /> {name}
      </button>
    );
  return (
    <button type="button" className="xe-flow-chip xe-flow-add" data-edit-only data-flow-add={at} data-end={end || undefined} aria-label={name} data-tip={name} onClick={add}>
      <Plus aria-hidden size={14} strokeWidth={2.5} />
    </button>
  );
}
