"use client";

import { createContext, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { closestCenter, DndContext, DragOverlay, type DragEndEvent, type DragStartEvent } from "@dnd-kit/core";
import { rectSortingStrategy, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { usePortfolioApi } from "../runtime";
import { moveTile } from "../sections/arrange";
import { announcementsFor, DraggingContext, EASE, MOVE_MS, useDragSensors, useReducedMotion } from "../sections/drag";
import { W } from "../sections/words";
import { useArranged, useWorkTreatment } from "./arranged";

/*
 * The exhbts' own drag (brief F, step 5), inside More of my work: a board of its own, so a card never
 * collides with a section and the arrow keys step from card to card. The cards (or the rows, in the
 * list and index looks) are one sortable list; the band is not on it (the star puts an exhbt there),
 * nor are the owner-only tiles. A drop writes the order as the step builder does: only the listed
 * exhbts change places, and a hidden or starred one keeps its slot.
 *
 * The lifted copy is the tile's own card or row, as the page drew it (each tile leaves its node here).
 */

type Nodes = Map<string, ReactNode>;
const NodesContext = createContext<Nodes | null>(null);

/** Where a tile leaves its card or row for the lifted copy. */
export function useTileNodes(): Nodes | null {
  return useContext(NodesContext);
}

export function TileBoard({ children }: { children: ReactNode }): ReactNode {
  const api = usePortfolioApi();
  const arranged = useArranged();
  const treatment = useWorkTreatment();
  const sensors = useDragSensors();
  const reduced = useReducedMotion();
  const nodes = useRef<Nodes>(new Map()).current;
  const [active, setActive] = useState<string | null>(null);
  const dragging = useRef(false);
  const latest = useRef(arranged);
  latest.current = arranged;
  const announcements = useMemo(
    () =>
      announcementsFor(
        () => latest.current.work,
        (id) => latest.current.title(id),
      ),
    [],
  );

  function onStart(e: DragStartEvent) {
    dragging.current = true;
    setActive(String(e.active.id));
  }
  function onEnd({ active: a, over }: DragEndEvent) {
    dragging.current = false;
    setActive(null);
    if (!over || a.id === over.id) return;
    const { work, known, title } = latest.current;
    const id = String(a.id);
    const to = work.indexOf(String(over.id));
    api.change((s) => moveTile(s, work, known, id, to), W.movedTile(title(id)));
  }
  function onCancel() {
    dragging.current = false;
    setActive(null);
  }

  const lifted = active ? nodes.get(active) : undefined;
  return (
    <NodesContext value={nodes}>
      <DraggingContext value={dragging}>
        <DndContext
          id="portfolio-editor-tiles"
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={onStart}
          onDragEnd={onEnd}
          onDragCancel={onCancel}
          accessibility={{ announcements, screenReaderInstructions: { draggable: W.tilesHelp } }}
        >
          <SortableContext items={arranged.work} strategy={treatment === "cards" ? rectSortingStrategy : verticalListSortingStrategy}>
            {children}
          </SortableContext>
          <DragOverlay dropAnimation={reduced ? null : { duration: MOVE_MS, easing: EASE }}>
            {lifted ? (
              <div className="pe-lifted pe-lifted-tile" data-testid="lifted-tile" data-treatment={treatment} inert aria-hidden>
                {lifted}
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </DraggingContext>
    </NodesContext>
  );
}
