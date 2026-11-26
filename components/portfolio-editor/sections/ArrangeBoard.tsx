"use client";

import type { ReactNode } from "react";

/*
 * STUB (brief E, milestone 1). Brief F takes this file over: whatever has to sit round the whole
 * editing page for sections and tiles to be dragged (dnd-kit's context, its sensors, its announcements
 * and the lifted copy). The canvas draws the editing page inside it (Canvas.tsx), within the look's own
 * wrapper, so a lifted copy drawn here has the look's variables. `useEditingHome()` (home.ts) gives the
 * page's own props, for drawing one section of it lifted. Until then it draws the page and nothing else.
 *
 * It is not in brief E's list of stubs: the frames are drawn one per section, and a drag needs one
 * parent round them all, which only the canvas can give.
 */
export function ArrangeBoard({ children }: { children: ReactNode }): ReactNode {
  return children;
}
