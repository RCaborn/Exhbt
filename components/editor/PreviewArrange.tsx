"use client";

import { useId, useRef, useState } from "react";
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, TouchSensor, useSensor, useSensors, type Announcements, type DragEndEvent, type UniqueIdentifier } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowDown, ArrowUp, GripVertical } from "lucide-react";
import { SectionBlock } from "@/components/portfolio/ProjectView";
import { Button } from "@/components/ui/Button";
import { useReducedMotion } from "@/components/ui/useReducedMotion";
import type { ExhbtDoc, Section } from "@/lib/exhbt/blocks";
import { hasData } from "@/lib/exhbt/charts";
import { shownSections } from "@/lib/exhbt/formats";
import { moveSection, sectionLabel } from "@/lib/exhbt/sections";

type SetDoc = React.Dispatch<React.SetStateAction<ExhbtDoc>>;

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

const DRAG_INSTRUCTIONS =
  "To move this section, press Space or Enter, use the up and down arrow keys, then press Space or Enter again to drop it, or Escape to cancel. The move up and move down buttons do the same.";

/**
 * The sections below the flowchart in the editor's preview, while "Arrange sections" is on
 * (decision 0022): each drawn as the page draws it, one under another, with a grip to drag it
 * (pointer, finger, or Space and the arrow keys) and move up and down buttons. The same order as
 * the cards on the left (decision 0015), so either place can change it. Pairs such as "What I
 * found" beside a graph are drawn apart here, so each can be picked up, and join again when
 * arranging is done.
 */
export function PreviewArrange({ doc, setDoc, imageUrls }: { doc: ExhbtDoc; setDoc: SetDoc; imageUrls: Record<string, string | null> }) {
  // Only the sections the layout draws are listed (decision 0024): a kept aim in a case study has nothing to arrange.
  // Positions below are in this list; a move is turned into a move in the whole list.
  const sections = shownSections(doc).map((x) => x.s);
  const dndId = useId();
  const reduced = useReducedMotion();
  const [status, setStatus] = useState("");
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const indexOf = (id: UniqueIdentifier) => sections.findIndex((s) => s.id === id);
  const nameOf = (id: UniqueIdentifier) => (indexOf(id) >= 0 ? sectionLabel(sections, indexOf(id)) : "The section");
  const leftStart = useRef(false);
  const announcements: Announcements = {
    onDragStart: ({ active }) => {
      leftStart.current = false;
      return `Picked up ${lowerFirst(nameOf(active.id))}, place ${indexOf(active.id) + 1} of ${sections.length}.`;
    },
    onDragOver: ({ active, over }) => {
      if (over && over.id === active.id && !leftStart.current) return undefined;
      leftStart.current = true;
      return over ? `${nameOf(active.id)} would go to place ${indexOf(over.id) + 1} of ${sections.length}.` : `${nameOf(active.id)} isn't over a place.`;
    },
    onDragEnd: ({ active, over }) => (over ? `${nameOf(active.id)} dropped in place ${indexOf(over.id) + 1} of ${sections.length}.` : `${nameOf(active.id)} dropped where it was.`),
    onDragCancel: ({ active }) => `Moving ${lowerFirst(nameOf(active.id))} cancelled. It's back where it was.`,
  };

  function move(i: number, to: number, by: "keys" | "drag") {
    if (to < 0 || to >= sections.length || to === i) return;
    const s = sections[i]!;
    setDoc((d) => {
      const at = shownSections(d).map((x) => x.i);
      return at[i] === undefined || at[to] === undefined ? d : { ...d, sections: moveSection(d.sections, at[i]!, at[to]!) };
    });
    setStatus(by === "keys" ? `${sectionLabel(sections, i)} moved ${to < i ? "up" : "down"}: now ${to + 1} of ${sections.length}.` : "");
    if (by === "keys") {
      const dir = to < i ? "up" : "down";
      requestAnimationFrame(() => {
        const item = document.querySelector(`[data-arrange-id="${s.id}"]`);
        const pressed = item?.querySelector<HTMLButtonElement>(`[data-move="${dir}"] button`);
        const other = item?.querySelector<HTMLButtonElement>(`[data-move="${dir === "up" ? "down" : "up"}"] button`);
        const usable = (b: HTMLButtonElement | null | undefined) => b && !b.disabled && b.getAttribute("aria-disabled") !== "true";
        (usable(pressed) ? pressed : other)?.focus();
      });
    }
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    move(indexOf(active.id), indexOf(over.id), "drag");
  }

  if (sections.length === 0) return <p className="xp-section xp-muted text-sm">No sections yet. Add one from the list on the left.</p>;

  return (
    <div className="xp-section" data-arrange>
      <DndContext id={dndId} sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd} accessibility={{ announcements, screenReaderInstructions: { draggable: DRAG_INSTRUCTIONS } }}>
        <SortableContext items={sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          <ol aria-label="Sections in the preview, in page order" className="space-y-3">
            {sections.map((s, i) => (
              <ArrangeItem key={s.id} s={s} label={lowerFirst(sectionLabel(sections, i))} reduced={reduced} first={i === 0} last={i === sections.length - 1} onMove={(d) => move(i, i + d, "keys")}>
                {s.kind === "graph" && !hasData(s.chart) ? (
                  // The page leaves out a graph with no figures yet; here it still needs a place to pick up.
                  <p className="xp-muted rounded-[12px] border border-dashed border-line px-4 py-6 text-center text-sm">No figures in this graph yet. Fill it in on the left.</p>
                ) : (
                  <SectionBlock s={s} Sub="h3" imageUrls={imageUrls} />
                )}
              </ArrangeItem>
            ))}
          </ol>
        </SortableContext>
      </DndContext>
      <p role="status" className="mt-2 text-sm">
        {status}
      </p>
    </div>
  );
}

function ArrangeItem({
  s,
  label,
  reduced,
  first,
  last,
  onMove,
  children,
}: {
  s: Section;
  label: string;
  reduced: boolean;
  first: boolean;
  last: boolean;
  onMove: (d: -1 | 1) => void;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: s.id, transition: reduced ? null : undefined });
  return (
    <li
      ref={setNodeRef}
      data-arrange-id={s.id}
      data-kind={s.kind}
      data-dragging={isDragging || undefined}
      style={{ transform: CSS.Translate.toString(transform), transition: reduced ? undefined : transition }}
      className={`relative rounded-[16px] border border-dashed border-field bg-surface p-3 ${isDragging ? "z-10 border-solid border-jade shadow-pack" : ""}`}
    >
      <div className="mb-1 flex items-center justify-between gap-2">
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          aria-label={`Drag ${label} to move it`}
          data-grip
          className="inline-flex h-9 shrink-0 cursor-grab touch-none items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-sm font-semibold text-ink hover:border-ink active:cursor-grabbing"
        >
          <GripVertical aria-hidden size={16} strokeWidth={2.25} />
          <span aria-hidden>{label.charAt(0).toUpperCase() + label.slice(1)}</span>
        </button>
        <span className="flex items-center gap-1">
          <span data-move="up">
            <Button size="sm" label={`Move ${label} up`} disabled={first} onClick={() => onMove(-1)}>
              <ArrowUp aria-hidden size={14} strokeWidth={2.25} />
            </Button>
          </span>
          <span data-move="down">
            <Button size="sm" label={`Move ${label} down`} disabled={last} onClick={() => onMove(1)}>
              <ArrowDown aria-hidden size={14} strokeWidth={2.25} />
            </Button>
          </span>
        </span>
      </div>
      {/* The section as the page draws it, not to be tabbed into while arranging. */}
      <div inert className="[&_.xp-section]:mt-0">
        {children}
      </div>
    </li>
  );
}
