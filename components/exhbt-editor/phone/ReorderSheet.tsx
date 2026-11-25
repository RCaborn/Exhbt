"use client";

import "../css/phone.css";
import { useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { closestCenter, DndContext, KeyboardSensor, MouseSensor, TouchSensor, useSensor, useSensors, type Announcements, type DragEndEvent, type UniqueIdentifier } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowDown, ArrowUp, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { pageItems } from "@/lib/exhbt/layouts";
import { useRuntime } from "../context";
import { EASE, MOVE_MS } from "../drag/engine";
import { labelOf } from "../labels";
import { useDoc, useStoreInternal } from "../store";
import { Said } from "../ui/Said";
import { Sheet } from "../ui/Sheet";

/*
 * "Reorder sections" (decision 0026, "On a phone"): a sheet of short rows, one per page item in order
 * (the flowchart included), each with its name, a grip and Move up and Move down, for a touch screen,
 * where a long drag down the page is hard. The rows are one height, so dnd-kit's sortable list does
 * the dragging: a 150ms press on a grip picks a row up and the others slide; the keyboard works from
 * the grip; every step is read out. Every drop and every button is one `store.move`, one undo entry.
 * "Done" closes the sheet and takes the page to the section last moved.
 *
 * The sheet is a modal dialog, so the page behind it (and its live region) is inert: the words are
 * said in the sheet's own live region, and dnd-kit's are drawn in the sheet too.
 */

export function ReorderSheet(): ReactNode {
  return (
    <Sheet name="reorder" title="Reorder sections">
      <ReorderList />
    </Sheet>
  );
}

const HOW = "To move a section, press Space or Enter on its grip, use the arrow keys, then press Space or Enter again to drop it, or Escape to cancel. The move up and move down buttons do the same.";
const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

const subscribeReduced = (fn: () => void) => {
  const m = window.matchMedia("(prefers-reduced-motion: reduce)");
  m.addEventListener("change", fn);
  return () => m.removeEventListener("change", fn);
};
function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReduced,
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => true,
  );
}

type Row = { id: string; label: string };

function ReorderList() {
  const store = useStoreInternal();
  const { uiApi } = useRuntime();
  const reduced = useReducedMotion();
  // One string, so the list draws again only when the order or a name changes.
  const key = useDoc((d) =>
    pageItems(d)
      .map((it) => `${it.id}\u0000${labelOf(d, it.id)}`)
      .join("\u0001"),
  );
  const rows: Row[] = key ? key.split("\u0001").map((r) => ({ id: r.split("\u0000")[0]!, label: r.split("\u0000")[1]! })) : [];
  const ids = rows.map((r) => r.id);
  const n = rows.length;
  const nameOf = (id: UniqueIdentifier) => rows.find((r) => r.id === String(id))?.label ?? "Section";
  const placeOf = (id: UniqueIdentifier) => ids.indexOf(String(id)) + 1;

  const [said, setSaid] = useState({ text: "", n: 0 });
  const say = (text: string) => setSaid((s) => ({ text, n: s.n + 1 }));
  const [region, setRegion] = useState<HTMLElement | null>(null);
  const list = useRef<HTMLUListElement>(null);
  /** The section last moved, for "Done". */
  const moved = useRef<string | null>(null);
  /** After a move by button: the row's button to give the focus back to (the row may have been moved in the page's DOM). */
  const refocus = useRef<{ id: string; by: -1 | 1 } | null>(null);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  /** Just picked up: the row is over its own place, which needn't be said over "Picked up". */
  const justPicked = useRef(false);
  const announcements: Announcements = {
    onDragStart: ({ active }) => {
      justPicked.current = true;
      return `Picked up ${lowerFirst(nameOf(active.id))}, place ${placeOf(active.id)} of ${n}.`;
    },
    onDragOver: ({ active, over }) => {
      const first = justPicked.current;
      justPicked.current = false;
      if (!over) return `${nameOf(active.id)} isn't over the list.`;
      if (over.id === active.id) return first ? undefined : `${nameOf(active.id)} is back where it was, place ${placeOf(over.id)} of ${n}.`;
      return `${nameOf(active.id)} would go to place ${placeOf(over.id)} of ${n}.`;
    },
    onDragEnd: ({ active, over }) =>
      !over ? `${nameOf(active.id)} is back where it was.` : over.id === active.id ? `${nameOf(active.id)} dropped where it was.` : `${nameOf(active.id)} dropped in place ${placeOf(over.id)} of ${n}.`,
    onDragCancel: ({ active }) => `Moving ${lowerFirst(nameOf(active.id))} cancelled. It's back where it was.`,
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const to = ids.indexOf(String(over.id));
    if (to < 0) return;
    store.move(String(active.id), to);
    moved.current = String(active.id);
  };

  const step = (id: string, by: -1 | 1) => {
    const from = ids.indexOf(id);
    const to = from + by;
    if (from < 0 || to < 0 || to >= n) return;
    const label = nameOf(id);
    store.move(id, to);
    moved.current = id;
    refocus.current = { id, by };
    say(`${label} moved ${by < 0 ? "up" : "down"}, to place ${to + 1} of ${n}.`);
  };

  // The focus stays on the button pressed, or goes to the other one at an end.
  useLayoutEffect(() => {
    const r = refocus.current;
    if (!r) return;
    refocus.current = null;
    const row = list.current?.querySelector(`[data-row="${CSS_ESCAPE(r.id)}"]`);
    const pressed = row?.querySelector<HTMLButtonElement>(`[data-move="${r.by < 0 ? "up" : "down"}"] button`);
    const other = row?.querySelector<HTMLButtonElement>(`[data-move="${r.by < 0 ? "down" : "up"}"] button`);
    (pressed && !pressed.disabled ? pressed : other)?.focus();
  });

  const done = () => {
    const id = moved.current;
    const dialog = document.querySelector<HTMLDialogElement>('dialog[data-sheet="reorder"]');
    // After the dialog has closed (its own focus return comes first): the page at the section last moved, its grip focused.
    if (id && dialog) {
      dialog.addEventListener(
        "close",
        () =>
          requestAnimationFrame(() => {
            const frame = document.querySelector<HTMLElement>(`[data-editor="page"] [data-section-id="${CSS_ESCAPE(id)}"]`);
            if (!frame) return;
            frame.scrollIntoView({ block: "center" });
            frame.querySelector<HTMLElement>("[data-grip]")?.focus({ preventScroll: true });
          }),
        { once: true },
      );
    }
    uiApi.close();
  };

  return (
    <div className="xe-reorder">
      <p className="text-sm text-graphite">Hold a grip to drag a section, or use the arrows. Each move can be undone.</p>
      <div ref={setRegion}>
        <Said text={said.text} n={said.n} data-said={said.n} />
      </div>
      <DndContext
        id="xe-reorder"
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
        accessibility={{ announcements, container: region ?? undefined, screenReaderInstructions: { draggable: HOW } }}
      >
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <ul ref={list} className="xe-reorder-list mt-4" aria-label="Sections, in page order">
            {rows.map((r, i) => (
              <SortableRow key={r.id} row={r} first={i === 0} last={i === n - 1} reduced={reduced} onStep={step} />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
      <div className="xe-reorder-foot">
        <Button variant="primary" size="md" className="xe-bar-btn" onClick={done}>
          Done
        </Button>
      </div>
    </div>
  );
}

const CSS_ESCAPE = (s: string) => (typeof window !== "undefined" && window.CSS?.escape ? window.CSS.escape(s) : s);

function SortableRow({ row, first, last, reduced, onStep }: { row: Row; first: boolean; last: boolean; reduced: boolean; onStep(id: string, by: -1 | 1): void }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: row.id,
    transition: reduced ? null : { duration: MOVE_MS, easing: EASE },
    attributes: { roleDescription: "sortable section" },
  });
  return (
    <li
      ref={setNodeRef}
      data-row={row.id}
      data-dragging={isDragging || undefined}
      className="xe-reorder-row"
      // Up and down only: the row never drifts sideways under the finger.
      style={{ transform: CSS.Translate.toString(transform && { ...transform, x: 0 }), transition: transition ?? undefined }}
    >
      <button type="button" ref={setActivatorNodeRef} className="xe-reorder-grip" {...attributes} {...listeners} aria-label={`Drag ${row.label} to move it`}>
        <GripVertical aria-hidden size={18} strokeWidth={2.25} />
      </button>
      <span className="xe-reorder-name">{row.label}</span>
      <span data-move="up">
        <Button size="sm" className="xe-bar-btn" label={`Move ${row.label} up`} disabled={first} onClick={() => onStep(row.id, -1)}>
          <ArrowUp aria-hidden size={18} strokeWidth={2.25} />
        </Button>
      </span>
      <span data-move="down">
        <Button size="sm" className="xe-bar-btn" label={`Move ${row.label} down`} disabled={last} onClick={() => onStep(row.id, 1)}>
          <ArrowDown aria-hidden size={18} strokeWidth={2.25} />
        </Button>
      </span>
    </li>
  );
}
