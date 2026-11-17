"use client";

import { useEffect, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, X } from "lucide-react";
import { PortfolioHome, type HomeProps } from "@/components/portfolio/PortfolioHome";
import type { PortfolioPerson } from "@/components/portfolio/PortfolioPage";
import { checkTiles } from "@/lib/portfolio-customise";
import { SECTION_NAMES, tileKindsShownBy, type SectionKey, type Tiles } from "@/lib/portfolio-layout";
import type { PortfolioTheme } from "@/lib/portfolio-themes";
import type { BuilderProject, BuilderState } from "./steps";

/**
 * The live preview, and the place the page is arranged (decision 0016): the person's home page as
 * visitors see it, drawn by the same component as /p/<username> (`PortfolioHome`). The top bar and
 * hero are fixed; each section below has a grip to drag it (mouse, a short press on touch, or Space,
 * the arrow keys and Space on the keyboard) and a button to take it off the page. Empty sections show
 * as outlines saying what goes there. The page lays itself out by the width it is given (container
 * queries), so the preview column shows the real arrangement without scaling.
 */

const EASE = "cubic-bezier(0.2, 0, 0, 1)";
const MOVE_MS = 180;
const ICON_BTN =
  "inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-ink shadow-pack hover:border-ink";

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const q = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(q.matches);
    const on = () => setReduced(q.matches);
    q.addEventListener("change", on);
    return () => q.removeEventListener("change", on);
  }, []);
  return reduced;
}

export function Preview({
  state,
  person,
  theme,
  projects,
  onSections,
  onRemove,
}: {
  state: BuilderState;
  person: PortfolioPerson;
  theme: PortfolioTheme;
  projects: BuilderProject[];
  /** A new order of the sections, after a drag. */
  onSections: (next: SectionKey[], moved: SectionKey) => void;
  onRemove: (key: SectionKey) => void;
}) {
  const a = state.arrangement;
  const reduced = useReducedMotion();
  const [activeId, setActiveId] = useState<SectionKey | null>(null);
  const justPicked = useRef(false);
  const byId = new Map(projects.map((p) => [p.id, p]));
  const hidden = new Set(a.hidden);
  const shownProjects = a.order.filter((id) => byId.has(id) && !hidden.has(id)).map((id) => byId.get(id)!.home);
  const tiles = tidy(a.tiles, a.sections);
  const sections = a.sections;
  const name = (k: string) => SECTION_NAMES[k as SectionKey] ?? "section";
  const position = (k: string | number) => sections.indexOf(String(k) as SectionKey) + 1;

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 160, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const announcements: Announcements = {
    onDragStart: ({ active }) => {
      justPicked.current = true;
      return `Picked up ${name(String(active.id))}. Position ${position(active.id)} of ${sections.length}.`;
    },
    onDragOver: ({ active, over }) => {
      const first = justPicked.current;
      justPicked.current = false;
      if (!over || (first && over.id === active.id)) return undefined;
      return `${name(String(active.id))} is over position ${position(over.id)} of ${sections.length}.`;
    },
    onDragEnd: ({ active, over }) =>
      over
        ? `Dropped ${name(String(active.id))}. Position ${position(over.id)} of ${sections.length}.`
        : `Dropped ${name(String(active.id))}. It stays at position ${position(active.id)} of ${sections.length}.`,
    onDragCancel: ({ active }) => `Cancelled. ${name(String(active.id))} is back at position ${position(active.id)} of ${sections.length}.`,
  };

  function onDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null);
    if (!over || active.id === over.id) return;
    const from = sections.indexOf(active.id as SectionKey);
    const to = sections.indexOf(over.id as SectionKey);
    if (from < 0 || to < 0) return;
    onSections(arrayMove(sections, from, to), active.id as SectionKey);
  }

  const page = (frame?: (key: SectionKey, node: React.ReactNode) => React.ReactNode, only?: SectionKey) => (
    <PortfolioHome
      person={person}
      theme={theme}
      projects={shownProjects}
      featuredId={a.featured}
      sections={only ? [only] : sections}
      tiles={tiles}
      mode="preview"
      frame={frame}
      inertChrome
      sectionsOnly={Boolean(only)}
    />
  );

  return (
    <div data-testid="preview" className="relative">
      <DndContext
        id="portfolio-sections"
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={(e) => setActiveId(e.active.id as SectionKey)}
        onDragEnd={onDragEnd}
        onDragCancel={() => setActiveId(null)}
        accessibility={{
          announcements,
          screenReaderInstructions: {
            draggable: "To pick up a section, press Space. Use the arrow keys to move it, then press Space to drop it. Press Escape to cancel.",
          },
        }}
      >
        <SortableContext items={sections} strategy={verticalListSortingStrategy}>
          {page((key, node) => (
            <SortableSection id={key} reduced={reduced} onRemove={() => onRemove(key)}>
              {node}
            </SortableSection>
          ))}
        </SortableContext>
        <DragOverlay dropAnimation={reduced ? null : { duration: MOVE_MS, easing: EASE }}>
          {activeId ? (
            <div className="cursor-grabbing overflow-hidden rounded-[16px] bg-surface opacity-95 shadow-pack outline outline-2 outline-jade" data-testid="lifted-section">
              {page(undefined, activeId)}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

/**
 * A section with its controls. The page inside is a picture (inert: its links don't open and nothing
 * in it takes focus); the grip and the remove button sit on top of it, outside the picture.
 */
function SortableSection({ id, reduced, onRemove, children }: { id: SectionKey; reduced: boolean; onRemove: () => void; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id,
    transition: reduced ? null : { duration: MOVE_MS, easing: EASE },
    attributes: { roleDescription: "draggable section" },
  });
  const label = SECTION_NAMES[id];
  return (
    <div
      ref={setNodeRef}
      data-section-key={id}
      style={{ transform: CSS.Translate.toString(transform), transition: transition ?? undefined }}
      className={`group/section relative outline-offset-[-2px] hover:outline hover:outline-2 hover:outline-jade/50 focus-within:outline focus-within:outline-2 focus-within:outline-jade ${isDragging ? "opacity-40" : ""}`}
    >
      <div className="absolute top-2 right-2 z-10 flex gap-1.5">
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          aria-label={`Move ${label}`}
          title={`Move ${label}`}
          className={`${ICON_BTN} cursor-grab touch-none active:cursor-grabbing`}
        >
          <GripVertical aria-hidden size={18} strokeWidth={2} />
        </button>
        <button type="button" onClick={onRemove} aria-label={`Remove ${label}`} title={`Remove ${label}`} className={ICON_BTN}>
          <X aria-hidden size={16} strokeWidth={2.25} />
        </button>
      </div>
      <div inert>{children}</div>
    </div>
  );
}

/** The person's page as the builder draws it (the live preview and the look step's pictures): what's shown, in their order. */
export function homeFrom(state: BuilderState, person: PortfolioPerson, projects: BuilderProject[]): Omit<HomeProps, "theme"> {
  const a = state.arrangement;
  const byId = new Map(projects.map((p) => [p.id, p]));
  const hidden = new Set(a.hidden);
  return {
    person,
    projects: a.order.filter((id) => byId.has(id) && !hidden.has(id)).map((id) => byId.get(id)!.home),
    featuredId: a.featured,
    sections: a.sections,
    tiles: tidy(a.tiles, a.sections),
  };
}

/** The tiles as the page will show them: each kind's words tidied by the same rules as saving, or as typed if they don't pass yet. */
function tidy(tiles: Tiles, sections: SectionKey[]): Tiles {
  const { clean } = checkTiles(tiles, tileKindsShownBy(sections));
  return { ...tiles, ...clean };
}
