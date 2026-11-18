"use client";

import { useContext, useEffect, useId, useRef, useState } from "react";
import { createPortal, flushSync } from "react-dom";
import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import { horizontalListSortingStrategy, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy, type SortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowDown, ArrowRight, GripVertical, Plus } from "lucide-react";
import { useReducedMotion } from "@/components/ui/useReducedMotion";
import { LIMITS } from "@/lib/exhbt/blocks";
import { AutoText } from "./fields";
import { boxStyle } from "./options";
import { FLOW_ID, type LabStep } from "./samples";
import { useLab, useLabStore, useRenderCount } from "./store";
import { VersionContext } from "./version-context";

export const MOVE_MS = 180;
export const EASE = "cubic-bezier(0.2, 0, 0, 1)";

const BOX_INSTRUCTIONS = "To move this box, press Space or Enter, use the arrow keys, then press Space or Enter again to drop it, or Escape to cancel.";

/** Line style: no box moves while one is dragged. */
const still: SortingStrategy = () => null;

/**
 * The page's flowchart (MethodFlow variant="page" in components/exhbt/MethodFlow.tsx), edited in
 * place: the same list, boxes, arrows and classes, with each box's words a field, a grip on each
 * box to drag it along the flowchart (a row from 36rem of column width, a column below that), and
 * a "+" on each arrow that adds a box there. The last box is still the result, drawn in ink,
 * whichever box that is after a move.
 *
 * Boxes drag in one of two ways, by the version (boxStyle in options.ts):
 *  - slide (version A): dnd-kit's own sortable list. The other boxes slide aside in 180ms.
 *  - line (version B and Mix): the flowchart stays still, a line in the gap shows where the box
 *    will go, a lifted copy follows the pointer, and on the drop the boxes move to their places.
 * Either way nothing animates for people who ask for less motion.
 */
export function LabFlow() {
  const store = useLabStore();
  const steps = useLab((d) => d.flow);
  useRenderCount(FLOW_ID);
  const line = boxStyle(useContext(VersionContext)) === "line";
  const reduced = useReducedMotion();
  const dndId = useId();
  const list = useRef<HTMLOListElement>(null);
  const live = useRef<HTMLParagraphElement>(null);
  const [row, setRow] = useState(true);
  const [look, setLook] = useState<Element | null>(null);
  const [drag, setDrag] = useState<{ active: string; over: string | null } | null>(null);
  const { max } = LIMITS.flow;

  // The list is a row or a column by its container's width; the sorting follows whichever it is.
  useEffect(() => {
    const el = list.current;
    if (!el) return;
    const read = () => setRow(getComputedStyle(el).flexDirection === "row");
    read();
    setLook(el.closest("[data-look]"));
    const watch = new ResizeObserver(read);
    watch.observe(el);
    return () => watch.disconnect();
  }, []);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const at = (id: UniqueIdentifier | null | undefined) => steps.findIndex((s) => s.id === id);
  const leftStart = useRef(false);
  const announcements: Announcements = {
    onDragStart: ({ active }) => {
      leftStart.current = false;
      return `Picked up box ${at(active.id) + 1} of ${steps.length}.`;
    },
    onDragOver: ({ active, over }) => {
      if (over && over.id === active.id && !leftStart.current) return undefined;
      leftStart.current = true;
      return over ? `The box would go to place ${at(over.id) + 1} of ${steps.length}.` : "The box isn't over a place.";
    },
    onDragEnd: ({ active, over }) => (over && over.id !== active.id ? `Box dropped in place ${at(over.id) + 1} of ${steps.length}.` : "Box dropped where it was."),
    onDragCancel: () => "Moving the box cancelled. It's back where it was.",
  };

  function onDragEnd({ active, over }: DragEndEvent) {
    setDrag(null);
    if (!over || active.id === over.id) return;
    if (!line || reduced) {
      store.moveStep(at(active.id), at(over.id));
      return;
    }
    // Line style: the boxes haven't moved yet, so they go from where they were to where they are now (180ms, transforms only).
    const boxes = () => Array.from(list.current?.querySelectorAll<HTMLElement>("[data-flow-step]") ?? []);
    const first = new Map(boxes().map((el) => [el.dataset.flowStep!, el.getBoundingClientRect()]));
    flushSync(() => store.moveStep(at(active.id), at(over.id)));
    for (const el of boxes()) {
      // The lifted copy carries the dropped box to its place itself.
      if (el.dataset.flowStep === active.id) continue;
      const a = first.get(el.dataset.flowStep!);
      const b = el.getBoundingClientRect();
      if (!a || (Math.abs(a.left - b.left) < 0.5 && Math.abs(a.top - b.top) < 0.5)) continue;
      el.animate([{ transform: `translate(${a.left - b.left}px, ${a.top - b.top}px)` }, { transform: "translate(0px, 0px)" }], { duration: MOVE_MS, easing: EASE });
    }
  }

  function add(index: number) {
    const id = store.addStep(index, max);
    if (!id) return;
    if (live.current) live.current.textContent = `Box added in place ${index + 1} of ${steps.length + 1}.`;
    requestAnimationFrame(() => list.current?.querySelector<HTMLTextAreaElement>(`[data-flow-step="${id}"] textarea`)?.focus({ preventScroll: true }));
  }

  const from = at(drag?.active);
  const over = at(drag?.over);
  const lifted = line && drag ? steps[from] : undefined;

  return (
    <section aria-label="Process" data-part="process" data-flow-style={line ? "line" : "slide"} className="break-inside-avoid">
      <DndContext
        id={dndId}
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={(e) => setDrag({ active: String(e.active.id), over: null })}
        onDragOver={(e) => setDrag((d) => d && { ...d, over: e.over ? String(e.over.id) : null })}
        onDragEnd={onDragEnd}
        onDragCancel={() => setDrag(null)}
        accessibility={{ announcements, screenReaderInstructions: { draggable: BOX_INSTRUCTIONS } }}
      >
        <SortableContext items={steps.map((s) => s.id)} strategy={line ? still : row ? horizontalListSortingStrategy : verticalListSortingStrategy}>
          <ol ref={list} className="xp-flow flex flex-col @xl:flex-row @xl:items-stretch" aria-label="Methodology">
            {steps.map((s, i) => (
              <FlowBox
                key={s.id}
                step={s}
                index={i}
                count={steps.length}
                reduced={reduced}
                line={line}
                // The line sits in the gap the box would go into: after the box it is over when moving along, before it when moving back.
                mark={line && drag && over === i && over !== from ? (over > from ? "after" : "before") : undefined}
                canAdd={steps.length < max}
                onAdd={add}
              />
            ))}
          </ol>
        </SortableContext>
        {/* The lifted copy, in line style. Drawn straight inside the look's wrapper, so it takes the look's colours and is placed against the screen. */}
        {line &&
          look &&
          createPortal(
            <DragOverlay zIndex={40} dropAnimation={reduced ? null : { duration: MOVE_MS, easing: EASE }}>
              {lifted ? (
                <div aria-hidden data-flow-copy className={`xp flex h-full cursor-grabbing bg-transparent ${row ? "flex-row" : "flex-col"}`}>
                  <div data-last={from === steps.length - 1 || undefined} className="xp-flow-box lab-flow-lifted min-w-0 flex-1 px-3 py-3">
                    <span className="block text-[0.8125rem] leading-snug font-semibold break-words">{lifted.step}</span>
                    {lifted.detail && <span className="xp-flow-detail mt-1 block text-[0.8125rem] leading-snug">{lifted.detail}</span>}
                  </div>
                  {/* The room the arrow takes in the list, so the copy's box is the size of the box it came from. */}
                  {from < steps.length - 1 && <span className={`shrink-0 ${row ? "w-[27px]" : "h-[27px]"}`} />}
                </div>
              ) : null}
            </DragOverlay>,
            look,
          )}
      </DndContext>
      <p ref={live} role="status" className="sr-only" />
    </section>
  );
}

function FlowBox({
  step,
  index,
  count,
  reduced,
  line,
  mark,
  canAdd,
  onAdd,
}: {
  step: LabStep;
  index: number;
  count: number;
  reduced: boolean;
  /** Line style: the box stays where it is while it, or another, is dragged. */
  line: boolean;
  /** Where the line is drawn against this box, when a dragged box would land beside it. */
  mark?: "before" | "after";
  canAdd: boolean;
  onAdd: (index: number) => void;
}) {
  const store = useLabStore();
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: step.id,
    transition: reduced || line ? null : { duration: MOVE_MS, easing: EASE },
    attributes: { roleDescription: "draggable box" },
  });
  const last = index === count - 1;
  const n = index + 1;
  return (
    <li
      ref={setNodeRef}
      data-flow-step={step.id}
      data-dragging={isDragging || undefined}
      data-line={mark}
      style={line ? undefined : { transform: CSS.Translate.toString(transform), transition: transition ?? undefined }}
      className="lab-flow-item relative flex flex-col items-stretch @xl:min-w-0 @xl:flex-1 @xl:flex-row @xl:items-center"
    >
      <div data-last={last || undefined} className="xp-flow-box relative min-w-0 px-3 py-3 @xl:h-full @xl:flex-1">
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          aria-label={`Drag box ${n} to move it`}
          title={`Drag box ${n}`}
          data-flow-grip
          className="xp-outline-button lab-tool lab-grip lab-flow-tool top-1/2 right-1 -translate-y-1/2 @xl:-top-5 @xl:right-auto @xl:left-2 @xl:translate-y-0"
        >
          <GripVertical aria-hidden size={18} strokeWidth={2.25} />
        </button>
        <span className="block text-[0.8125rem] leading-snug font-semibold break-words">
          <AutoText label={`Box ${n}`} value={step.step} placeholder="Type a step" onChange={(v) => store.setStep(step.id, v)} />
        </span>
        {step.detail && <span className="xp-flow-detail mt-1 block text-[0.8125rem] leading-snug">{step.detail}</span>}
      </div>
      {!last && (
        <span className="xp-flow-arrow relative flex justify-center py-1.5 @xl:px-1.5 @xl:py-0">
          <ArrowDown aria-hidden size={15} strokeWidth={2} className="@xl:hidden" />
          <ArrowRight aria-hidden size={15} strokeWidth={2} className="hidden @xl:block" />
          {canAdd && (
            <button
              type="button"
              aria-label={`Add a box after box ${n}`}
              title="Add a box here"
              data-flow-add={n}
              onClick={() => onAdd(n)}
              className="lab-flow-tool top-1/2 left-1/2 inline-flex size-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center"
            >
              <span className="xp-outline-button lab-flow-chip">
                <Plus aria-hidden size={14} strokeWidth={2.5} />
              </span>
            </button>
          )}
        </span>
      )}
    </li>
  );
}
