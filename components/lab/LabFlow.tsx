"use client";

import { useEffect, useId, useRef, useState } from "react";
import { closestCenter, DndContext, KeyboardSensor, MouseSensor, TouchSensor, useSensor, useSensors, type Announcements, type DragEndEvent, type UniqueIdentifier } from "@dnd-kit/core";
import { horizontalListSortingStrategy, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowDown, ArrowRight, GripVertical, Plus } from "lucide-react";
import { useReducedMotion } from "@/components/ui/useReducedMotion";
import { LIMITS } from "@/lib/exhbt/blocks";
import { AutoText } from "./fields";
import { FLOW_ID, type LabStep } from "./samples";
import { useLab, useLabStore, useRenderCount } from "./store";

export const MOVE_MS = 180;
export const EASE = "cubic-bezier(0.2, 0, 0, 1)";

const BOX_INSTRUCTIONS = "To move this box, press Space or Enter, use the arrow keys, then press Space or Enter again to drop it, or Escape to cancel.";

/**
 * The page's flowchart (MethodFlow variant="page" in components/exhbt/MethodFlow.tsx), edited in
 * place: the same list, boxes, arrows and classes, with each box's words a field, a grip on each
 * box to drag it along the flowchart (a row from 36rem of column width, a column below that), and
 * a "+" on each arrow that adds a box there. The last box is still the result, drawn in ink,
 * whichever box that is after a move.
 *
 * Boxes are all one kind in one line, so this is dnd-kit's own sortable list: the other boxes
 * slide aside in 180ms, and not at all for people who ask for less motion.
 */
export function LabFlow() {
  const store = useLabStore();
  const steps = useLab((d) => d.flow);
  useRenderCount(FLOW_ID);
  const reduced = useReducedMotion();
  const dndId = useId();
  const list = useRef<HTMLOListElement>(null);
  const live = useRef<HTMLParagraphElement>(null);
  const [row, setRow] = useState(true);
  const { max } = LIMITS.flow;

  // The list is a row or a column by its container's width; the sorting follows whichever it is.
  useEffect(() => {
    const el = list.current;
    if (!el) return;
    const read = () => setRow(getComputedStyle(el).flexDirection === "row");
    read();
    const watch = new ResizeObserver(read);
    watch.observe(el);
    return () => watch.disconnect();
  }, []);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const at = (id: UniqueIdentifier) => steps.findIndex((s) => s.id === id);
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
    if (!over || active.id === over.id) return;
    store.moveStep(at(active.id), at(over.id));
  }

  function add(index: number) {
    const id = store.addStep(index, max);
    if (!id) return;
    if (live.current) live.current.textContent = `Box added in place ${index + 1} of ${steps.length + 1}.`;
    requestAnimationFrame(() => list.current?.querySelector<HTMLTextAreaElement>(`[data-flow-step="${id}"] textarea`)?.focus({ preventScroll: true }));
  }

  return (
    <section aria-label="Process" data-part="process" className="break-inside-avoid">
      <DndContext id={dndId} sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd} accessibility={{ announcements, screenReaderInstructions: { draggable: BOX_INSTRUCTIONS } }}>
        <SortableContext items={steps.map((s) => s.id)} strategy={row ? horizontalListSortingStrategy : verticalListSortingStrategy}>
          <ol ref={list} className="xp-flow flex flex-col @xl:flex-row @xl:items-stretch" aria-label="Methodology">
            {steps.map((s, i) => (
              <FlowBox key={s.id} step={s} index={i} count={steps.length} reduced={reduced} canAdd={steps.length < max} onAdd={add} />
            ))}
          </ol>
        </SortableContext>
      </DndContext>
      <p ref={live} role="status" className="sr-only" />
    </section>
  );
}

function FlowBox({ step, index, count, reduced, canAdd, onAdd }: { step: LabStep; index: number; count: number; reduced: boolean; canAdd: boolean; onAdd: (index: number) => void }) {
  const store = useLabStore();
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: step.id,
    transition: reduced ? null : { duration: MOVE_MS, easing: EASE },
    attributes: { roleDescription: "draggable box" },
  });
  const last = index === count - 1;
  const n = index + 1;
  return (
    <li
      ref={setNodeRef}
      data-flow-step={step.id}
      data-dragging={isDragging || undefined}
      style={{ transform: CSS.Translate.toString(transform), transition: transition ?? undefined }}
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
