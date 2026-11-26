"use client";

import { createContext, useContext, useSyncExternalStore, type RefObject } from "react";
import { KeyboardSensor, MouseSensor, TouchSensor, useSensor, useSensors, type Announcements } from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { W } from "./words";

/*
 * The drag's set-up, the step builder's as it is (StepProjects.tsx, Preview.tsx; DESIGN.md, Dragging):
 * the mouse picks up after 6px, a finger after a 160ms press with 8px of give, the keyboard with Space,
 * the arrows and Space, and Escape cancels. The others move aside by transform, 180ms, and nothing moves
 * under reduced motion. Shared by the sections' board and the tiles' board.
 */

export const MOVE_MS = 180;
export const EASE = "cubic-bezier(0.2, 0, 0, 1)";

export function useDragSensors() {
  return useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 160, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
}

const REDUCED = "(prefers-reduced-motion: reduce)";
const subscribe = (fn: () => void) => {
  const m = window.matchMedia(REDUCED);
  m.addEventListener("change", fn);
  return () => m.removeEventListener("change", fn);
};

export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(REDUCED).matches,
    () => false,
  );
}

/**
 * The plain-English announcements, read out as a drag goes. `ids` is the list as it was at pick-up, and
 * `name` says what each id is called.
 */
export function announcementsFor(ids: () => readonly string[], name: (id: string) => string): Announcements {
  let justPicked = false;
  const at = (id: string | number) => ids().indexOf(String(id)) + 1;
  return {
    onDragStart: ({ active }) => {
      justPicked = true;
      return W.pickedUp(name(String(active.id)), at(active.id), ids().length);
    },
    onDragOver: ({ active, over }) => {
      const first = justPicked;
      justPicked = false;
      if (!over || (first && over.id === active.id)) return undefined;
      return W.over(name(String(active.id)), at(over.id), ids().length);
    },
    onDragEnd: ({ active, over }) => (over ? W.dropped(name(String(active.id)), at(over.id), ids().length) : W.stays(name(String(active.id)), at(active.id), ids().length)),
    onDragCancel: ({ active }) => W.cancelled(name(String(active.id)), at(active.id), ids().length),
  };
}

/**
 * Whether a drag is under way, read by a toolbar without drawing again: while one is, its arrow keys
 * belong to the drag, not to moving along the toolbar.
 */
export const DraggingContext = createContext<RefObject<boolean> | null>(null);

export function useDragging(): RefObject<boolean> {
  return useContext(DraggingContext) ?? { current: false };
}

/** dnd-kit's attributes for a grip, without the tabindex: the toolbar's roving tabindex owns that. */
export function gripAttributes<T extends { tabIndex?: number }>(attrs: T): Omit<T, "tabIndex"> {
  const { tabIndex, ...rest } = attrs;
  void tabIndex;
  return rest;
}
