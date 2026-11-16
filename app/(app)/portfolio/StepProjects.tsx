"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
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
import { Eye, EyeOff, GripVertical, Pencil, Plus, Star, X } from "lucide-react";
import { UpgradePrompt } from "@/components/site/UpgradePrompt";
import { Button } from "@/components/ui/Button";
import { checkTiles, type CustomiseState } from "@/lib/portfolio-customise";
import {
  emptyTile,
  EXTRA_SECTIONS,
  SECTION_HINTS,
  SECTION_KEYS,
  SECTION_NAMES,
  shownKeys,
  tileKindsShownBy,
  type SectionKey,
  type TileKind,
  type Tiles,
} from "@/lib/portfolio-layout";
import type { BuilderPlan, BuilderProject } from "./steps";
import { TileEditor } from "./TileEditor";

/**
 * Step 3, Your page (decisions 0014 and 0016): the exhbts in their order (drag a row by its grip with
 * the mouse, a short press on touch, or Space, arrows, Space on the keyboard), feature one for the band,
 * hide one (it stays live at its own link), open one in the editor; then the page's sections: add one,
 * fill in its words, take one off. The sections are put in order by dragging them in the preview.
 */

/** Sections whose words are written here. */
const WRITTEN: Partial<Record<SectionKey, TileKind[]>> = { about: ["about", "education"], experience: ["experience"], quote: ["quote"] };
const EASE = "cubic-bezier(0.2, 0, 0, 1)";
const MOVE_MS = 180;

const ICON_BTN =
  "inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-ink hover:border-ink aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-white aria-expanded:border-ink disabled:opacity-50";

function IconButton({ label, onClick, pressed, expanded, children }: { label: string; onClick: () => void; pressed?: boolean; expanded?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label} aria-pressed={pressed} aria-expanded={expanded} onClick={onClick} className={ICON_BTN}>
      {children}
    </button>
  );
}

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

function SortableRow({ id, label, reduced, children }: { id: string; label: string; reduced: boolean; children: (handle: React.ReactNode) => React.ReactNode }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id,
    transition: reduced ? null : { duration: MOVE_MS, easing: EASE },
    attributes: { roleDescription: "draggable tile" },
  });
  const handle = (
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
  );
  return (
    <li
      ref={setNodeRef}
      data-row={id}
      style={{ transform: CSS.Translate.toString(transform), transition: transition ?? undefined }}
      className={isDragging ? "opacity-40" : undefined}
    >
      {children(handle)}
    </li>
  );
}

export function StepProjects({
  state,
  change,
  projects,
  drafts,
  plan,
  ready,
  onFocusLost,
}: {
  state: CustomiseState;
  change: (update: (s: CustomiseState) => CustomiseState, undo?: string) => void;
  projects: BuilderProject[];
  drafts: { id: string; title: string; live: boolean }[];
  plan: BuilderPlan;
  ready: boolean;
  /** A row just left the list (hide, remove): park focus somewhere sensible. */
  onFocusLost: () => void;
}) {
  const reduced = useReducedMotion();
  const [editing, setEditing] = useState<SectionKey | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const byId = new Map(projects.map((p) => [p.id, p]));
  const shown = shownKeys(state.order, new Set(state.hidden), state.featured);
  const featured = state.featured && shown[0] === state.featured ? state.featured : null;
  const listKeys = featured ? shown.slice(1) : shown;
  const problems = checkTiles(state.tiles, tileKindsShownBy(state.sections)).problems;
  const labelOf = (key: string) => byId.get(key)?.title ?? "exhbt";
  const addable = SECTION_KEYS.filter((k) => !state.sections.includes(k));
  const justPicked = useRef(false);

  useEffect(() => {
    if (!editing) return;
    document.querySelector<HTMLElement>(`[data-tile-editor="${editing}"] textarea, [data-tile-editor="${editing}"] input`)?.focus();
  }, [editing]);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 160, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const position = (key: string | number) => shown.indexOf(String(key)) + 1;
  const announcements: Announcements = {
    onDragStart: ({ active }) => {
      justPicked.current = true;
      return `Picked up ${labelOf(String(active.id))}. Position ${position(active.id)} of ${shown.length}.`;
    },
    onDragOver: ({ active, over }) => {
      const first = justPicked.current;
      justPicked.current = false;
      if (!over || (first && over.id === active.id)) return undefined;
      return `${labelOf(String(active.id))} is over position ${position(over.id)} of ${shown.length}.`;
    },
    onDragEnd: ({ active, over }) =>
      over
        ? `Dropped ${labelOf(String(active.id))}. Position ${position(over.id)} of ${shown.length}.`
        : `Dropped ${labelOf(String(active.id))}. It stays at position ${position(active.id)} of ${shown.length}.`,
    onDragCancel: ({ active }) => `Cancelled. ${labelOf(String(active.id))} is back at position ${position(active.id)} of ${shown.length}.`,
  };

  function onDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null);
    if (!over || active.id === over.id) return;
    const from = listKeys.indexOf(String(active.id));
    const to = listKeys.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    const moved = arrayMove(listKeys, from, to);
    change((s) => {
      const inList = new Set(listKeys);
      let i = 0;
      return { ...s, order: s.order.map((k) => (inList.has(k) ? moved[i++]! : k)) };
    }, `Moved ${labelOf(String(active.id))}`);
  }

  const hide = (id: string) => {
    change((s) => ({ ...s, hidden: [...s.hidden, id], featured: s.featured === id ? null : s.featured }), `Hid ${labelOf(id)}`);
    onFocusLost();
  };
  const show = (id: string) => {
    change((s) => ({ ...s, hidden: s.hidden.filter((h) => h !== id) }), `Showed ${labelOf(id)}`);
    onFocusLost();
  };
  const feature = (id: string) =>
    change((s) => ({ ...s, featured: s.featured === id ? null : id }), state.featured === id ? `Took the star off ${labelOf(id)}` : `Featured ${labelOf(id)}`);
  const addSection = (key: SectionKey) => {
    setMenuOpen(false);
    change((s) => {
      const tiles = { ...s.tiles };
      for (const kind of WRITTEN[key] ?? []) if (!tiles[kind]) (tiles as Record<string, unknown>)[kind] = emptyTile(kind);
      return { ...s, sections: [...s.sections, key], tiles };
    }, `Added ${SECTION_NAMES[key]}`);
    if (WRITTEN[key]) setEditing(key);
  };
  const removeSection = (key: SectionKey) => {
    if (editing === key) setEditing(null);
    change((s) => ({ ...s, sections: s.sections.filter((k) => k !== key) }), `Removed ${SECTION_NAMES[key]}`);
    onFocusLost();
  };
  const editTile = <K extends TileKind>(kind: K, next: NonNullable<Tiles[K]>) => change((s) => ({ ...s, tiles: { ...s.tiles, [kind]: next } }));

  function row(key: string, handle: React.ReactNode) {
    const p = byId.get(key);
    if (!p) return null;
    const isFeatured = key === featured;
    return (
      <div className={`flex items-center gap-2 rounded-[14px] border bg-surface p-2 ${isFeatured ? "border-ink" : "border-line"}`}>
        {handle ?? <span aria-hidden className="inline-flex size-9 shrink-0 items-center justify-center text-jade"><Star size={16} strokeWidth={2} fill="currentColor" /></span>}
        <div className="min-w-0 flex-1 px-1">
          <p className="font-semibold leading-snug break-words">{p.title}</p>
          <p className="text-sm text-graphite">{isFeatured ? "Featured, always first" : p.live ? "Live" : "Draft"}</p>
        </div>
        <IconButton label={isFeatured ? `Take the star off ${p.title}` : `Feature ${p.title}`} pressed={isFeatured} onClick={() => feature(key)}>
          <Star aria-hidden size={16} strokeWidth={2} fill={isFeatured ? "currentColor" : "none"} />
        </IconButton>
        <IconButton label={`Hide ${p.title} from your portfolio`} onClick={() => hide(key)}>
          <EyeOff aria-hidden size={16} strokeWidth={2} />
        </IconButton>
        <Link href={`/exhbts/${key}/edit`} data-icon-button aria-label={`Edit ${p.title}`} title={`Edit ${p.title}`} className={ICON_BTN}>
          <Pencil aria-hidden size={16} strokeWidth={2} />
        </Link>
      </div>
    );
  }

  return (
    <div>
      {plan.publishNote && <UpgradePrompt className="mb-6" reason={`On ${plan.name} this is a preview. ${plan.publishNote.reason}`} upgradeTo={plan.publishNote.upgradeTo} />}

      {projects.length === 0 ? (
        <div className="rounded-[16px] border border-dashed border-field p-6 text-center">
          <p className="font-semibold">No exhbts yet</p>
          <p className="mt-1 text-graphite">Write up a project and it shows here, ready to put in order.</p>
          <div className="mt-4 flex justify-center">
            <Button href="/exhbts/new" variant="primary" size="sm">
              Start an exhbt
            </Button>
          </div>
        </div>
      ) : (
        <>
          <p className="text-graphite">Top to bottom, as your page shows them. Drag the grip, or focus it and press Space, then the arrow keys, then Space.</p>
          <DndContext
            id="portfolio-tiles"
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={(e) => setActiveId(String(e.active.id))}
            onDragEnd={onDragEnd}
            onDragCancel={() => setActiveId(null)}
            accessibility={{
              announcements,
              screenReaderInstructions: { draggable: "To pick up a tile, press Space. Use the arrow keys to move it, then press Space to drop it. Press Escape to cancel." },
            }}
          >
            <SortableContext items={listKeys} strategy={verticalListSortingStrategy}>
              <ul className="mt-4 space-y-2" aria-label="Tiles on your portfolio, in order" data-testid="tile-list">
                {featured && <li data-row={featured}>{row(featured, null)}</li>}
                {listKeys.map((key) => (
                  <SortableRow key={key} id={key} label={labelOf(key)} reduced={reduced}>
                    {(handle) => row(key, handle)}
                  </SortableRow>
                ))}
              </ul>
            </SortableContext>
            <DragOverlay dropAnimation={reduced ? null : { duration: MOVE_MS, easing: EASE }}>
              {activeId ? (
                <div className="cursor-grabbing rounded-[14px] shadow-pack outline outline-2 outline-jade" data-testid="lifted-tile">
                  {row(activeId, <span aria-hidden className={ICON_BTN}><GripVertical size={18} strokeWidth={2} /></span>)}
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        </>
      )}

      {projects.length > 0 && shown.length === 0 && plan.isPublic && (
        <p role="alert" className="mt-4 rounded-[14px] border border-error/40 bg-surface px-4 py-3 text-error">
          Every exhbt is hidden, so your portfolio page is offline. Show at least one.
        </p>
      )}

      {state.hidden.some((id) => byId.has(id)) && (
        <section aria-labelledby="hidden-heading" className="mt-8" data-testid="hidden-tray">
          <h3 id="hidden-heading" className="text-[1.0625rem] font-sans font-semibold tracking-normal">
            Hidden from your page
          </h3>
          <p className="mt-1 text-sm text-graphite">Still live at their own links, but not on your page.</p>
          <ul className="mt-3 space-y-2">
            {state.hidden
              .filter((id) => byId.has(id))
              .map((id) => (
                <li key={id} data-hidden-key={id} className="flex flex-wrap items-center justify-between gap-2 rounded-[14px] border border-dashed border-field px-4 py-2.5">
                  <span className="min-w-0 break-words text-graphite">{byId.get(id)!.title}</span>
                  <button
                    type="button"
                    onClick={() => show(id)}
                    aria-label={`Show ${byId.get(id)!.title} on your portfolio`}
                    className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-sm font-semibold hover:border-ink"
                  >
                    <Eye aria-hidden size={15} strokeWidth={2} /> Show
                  </button>
                </li>
              ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="sections-heading" className="mt-10 border-t border-line pt-8" data-testid="sections-panel">
        <h3 id="sections-heading" className="text-[1.0625rem] font-sans font-semibold tracking-normal">
          Sections on your page
        </h3>
        <p className="mt-1 text-sm text-graphite">Your name and intro stay at the top. Drag the sections into order in the preview.</p>
        <ul className="mt-3 space-y-2">
          {state.sections.map((key) => {
            const written = WRITTEN[key];
            const open = editing === key;
            return (
              <li key={key} data-section-row={key} className="rounded-[14px] border border-line bg-surface">
                <div className="flex items-center gap-2 p-2 pl-4">
                  <p className="min-w-0 flex-1 font-semibold">{SECTION_NAMES[key]}</p>
                  {written && (
                    <IconButton label={open ? `Close ${SECTION_NAMES[key]} editor` : `Edit ${SECTION_NAMES[key]}`} expanded={open} onClick={() => setEditing(open ? null : key)}>
                      <Pencil aria-hidden size={16} strokeWidth={2} />
                    </IconButton>
                  )}
                  <IconButton label={`Take ${SECTION_NAMES[key]} off the page`} onClick={() => removeSection(key)}>
                    <X aria-hidden size={16} strokeWidth={2.25} />
                  </IconButton>
                </div>
                {open && written && (
                  <div className="space-y-3 border-t border-line p-3">
                    {written.map((kind) => (
                      <TileEditor
                        key={kind}
                        kind={kind}
                        value={(state.tiles[kind] ?? emptyTile(kind)) as never}
                        onChange={(v) => editTile(kind, v as never)}
                        onDone={() => setEditing(null)}
                        problems={problems}
                        ready={ready}
                      />
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        <div className="relative mt-3">
          <button
            type="button"
            aria-expanded={menuOpen}
            aria-controls="add-section-menu"
            disabled={!ready || addable.length === 0}
            onClick={() => setMenuOpen((o) => !o)}
            onKeyDown={(e) => e.key === "Escape" && setMenuOpen(false)}
            className="inline-flex items-center gap-1.5 rounded-full border border-ink bg-surface px-4 py-2 text-sm font-semibold hover:bg-mist disabled:opacity-50"
          >
            <Plus aria-hidden size={16} strokeWidth={2.5} /> Add a section
          </button>
          {menuOpen && (
            <div id="add-section-menu" onKeyDown={(e) => e.key === "Escape" && setMenuOpen(false)} className="mt-2 rounded-[14px] border border-line bg-surface p-2 shadow-pack">
              <ul>
                {addable.map((k) =>
                  EXTRA_SECTIONS.includes(k) && !plan.extraTiles ? (
                    <li key={k} className="px-3 py-2">
                      <span className="block font-semibold">{SECTION_NAMES[k]}</span>
                      <UpgradePrompt reason={plan.extraTilesReason ?? ""} upgradeTo="premium" primary={false} className="mt-1" />
                    </li>
                  ) : (
                    <li key={k}>
                      <button type="button" onClick={() => addSection(k)} className="block w-full rounded-[10px] px-3 py-2 text-left hover:bg-mist">
                        <span className="block font-semibold">{SECTION_NAMES[k]}</span>
                        <span className="block text-sm text-graphite">{SECTION_HINTS[k]}</span>
                      </button>
                    </li>
                  ),
                )}
              </ul>
            </div>
          )}
        </div>
        {plan.heldTiles && (
          <p className="mt-3 text-sm text-graphite" data-testid="tiles-held">
            Your saved experience and quote come back when you&rsquo;re on a plan that has them.
          </p>
        )}
      </section>

      {(drafts.length > 0 || projects.length > 0) && (
        <section aria-labelledby="drafts-heading" className="mt-10 border-t border-line pt-8">
          <h3 id="drafts-heading" className="text-[1.0625rem] font-sans font-semibold tracking-normal">
            {drafts.length ? "Not on your page yet" : "Another project?"}
          </h3>
          {drafts.length > 0 && (
            <ul className="mt-3 space-y-2">
              {drafts.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center justify-between gap-2">
                  <span className="min-w-0 break-words">
                    {d.title} <span className="text-sm text-graphite">({d.live ? "over your plan’s limit" : "draft"})</span>
                  </span>
                  <Link href={`/exhbts/${d.id}/edit`} className="link text-sm font-semibold">
                    {d.live ? "Open" : "Finish and publish"}
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4">
            <Button href="/exhbts/new" size="sm" label="Start an exhbt">
              <Plus aria-hidden size={15} strokeWidth={2.5} /> Start an exhbt
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}
