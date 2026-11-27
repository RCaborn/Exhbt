"use client";

import "../css/arrange.css";
import { useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { closestCenter, DndContext, DragOverlay, type DragEndEvent, type DragStartEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { SectionKey } from "@/lib/portfolio-layout";
import { useEditingHome } from "../home";
import { usePortfolioApi, usePortfolioState, useRuntime } from "../runtime";
import { moveSection } from "./arrange";
import { usePhone } from "@/components/exhbt-editor/phone/usePhone";
import { useOfferUndo } from "../phone/PhoneUndo";
import { announcementsFor, DraggingContext, EASE, MOVE_MS, useDragSensors, useReducedMotion } from "./drag";
import { SectionPicture } from "./Picture";
import { sectionName, W } from "./words";

/*
 * What sits round the whole editing page for its sections to be dragged (brief F, step 2): dnd-kit's
 * context with the step builder's sensors and announcements, the sections as one sortable list, and the
 * lifted copy. Each section's frame (SectionFrame.tsx) is one sortable item; its grip is the only handle.
 * The exhbts are dragged on a board of their own, inside More of my work (tiles/TileBoard.tsx), so a
 * card never collides with a section.
 */
export function ArrangeBoard({ children }: { children: ReactNode }): ReactNode {
  const sections = usePortfolioState((s) => s.arrangement.sections);
  const api = usePortfolioApi();
  const rt = useRuntime();
  const sensors = useDragSensors();
  const phone = usePhone();
  const offerUndo = useOfferUndo();
  const reduced = useReducedMotion();
  const [active, setActive] = useState<SectionKey | null>(null);
  const dragging = useRef(false);
  const announcements = useMemo(() => announcementsFor(() => rt.state.get().arrangement.sections, (id) => sectionName(id as SectionKey)), [rt]);

  function onStart(e: DragStartEvent) {
    dragging.current = true;
    setActive(e.active.id as SectionKey);
  }
  function onEnd({ active: a, over }: DragEndEvent) {
    dragging.current = false;
    setActive(null);
    if (!over || a.id === over.id) return;
    const key = a.id as SectionKey;
    const to = rt.state.get().arrangement.sections.indexOf(over.id as SectionKey);
    const drop = () => api.change((s) => moveSection(s, key, to), W.moved(sectionName(key)));

    // On a phone a drop gets the one-tap Undo the More sheet's moves get (phone/PhoneUndo.tsx): an
    // accidental drag is the main reason a phone needs one.
    if (phone) offerUndo(drop);
    else drop();
  }
  function onCancel() {
    dragging.current = false;
    setActive(null);
  }

  return (
    <DraggingContext value={dragging}>
      <DndContext
        id="portfolio-editor-sections"
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={onStart}
        onDragEnd={onEnd}
        onDragCancel={onCancel}
        accessibility={{ announcements, screenReaderInstructions: { draggable: W.sectionsHelp } }}
      >
        <SortableContext items={sections} strategy={verticalListSortingStrategy}>
          {children}
        </SortableContext>
        {/* In the body, so its fixed place is the window's and not a container's (the page's own wrappers are containers). */}
        {createPortal(<DragOverlay dropAnimation={reduced ? null : { duration: MOVE_MS, easing: EASE }}>{active ? <Lifted sectionKey={active} /> : null}</DragOverlay>, document.body)}
      </DndContext>
    </DraggingContext>
  );
}

/** The lifted copy: the section as the page draws it, on a card with the pack shadow and an outline in the look's link colour, never scaled. */
function Lifted({ sectionKey }: { sectionKey: SectionKey }): ReactNode {
  const home = useEditingHome();
  return (
    <div className="pe-lifted" data-testid="lifted-section">
      <SectionPicture home={home} sectionKey={sectionKey} />
    </div>
  );
}
