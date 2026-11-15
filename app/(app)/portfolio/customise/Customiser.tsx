"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates, useSortable, type SortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Eye, EyeOff, GripVertical, Pencil, Plus, Star, Undo2, X } from "lucide-react";
import { ExhbtTile, type TileExhbt } from "@/components/exhbt/ExhbtTile";
import { PortfolioHeader } from "@/components/exhbt/PortfolioHeader";
import { ExtraTile } from "@/components/portfolio/ExtraTiles";
import { GLANCE_GRID, WIDE, headerOwner } from "@/components/portfolio/GlanceView";
import { UpgradePrompt } from "@/components/site/UpgradePrompt";
import type { Plan } from "@/lib/entitlements";
import { checkTiles, type CustomiseState } from "@/lib/portfolio-customise";
import {
  emptyTile,
  isTileKind,
  shownKeys,
  TILE_HINTS,
  TILE_KINDS,
  TILE_NAMES,
  tileHasContent,
  wideIndexes,
  type TileKind,
  type Tiles,
} from "@/lib/portfolio-layout";
import { DEFAULT_THEME, themeById } from "@/lib/portfolio-themes";
import { useHydrated } from "@/lib/use-hydrated";
import { saveCustomisationAction } from "./actions";
import { ThemeStrip, type ThemeLock } from "./ThemeStrip";
import { TileEditor } from "./TileEditor";
import { useCustomiser } from "./useCustomiser";

/**
 * The customiser (decision 0014): the person's own at-a-glance page, drawn from the same pieces as
 * /p/<username> (PortfolioHeader, ExhbtTile, ExtraTile, the same grid and wide-tile rule), with a
 * small bar of controls on each tile. Everything saves itself (useCustomiser).
 *
 * Dragging is @dnd-kit: mouse (a few pixels of travel), touch (a short press on the handle, so the
 * page still scrolls), and the keyboard (Space to pick up, arrows, Space to drop). Announcements are
 * in plain English. Motion is short, and off under prefers-reduced-motion. The featured exhbt is
 * pinned first and isn't draggable; hidden exhbts wait in a list below and keep their place.
 */

export type CustomiseProject = { id: string; title: string; tile: TileExhbt; live: boolean };

type Props = {
  initial: CustomiseState;
  projects: CustomiseProject[];
  owner: { username: string; name: string; headline: string | null; bio: string | null; linkedin: string | null; photoUrl: string | null };
  plan: {
    name: string;
    canPublish: boolean;
    publishNote: { reason: string; upgradeTo?: Plan } | null;
    extraTiles: boolean;
    extraTilesReason: string | null;
    heldTiles: boolean;
  };
  locks: Record<string, ThemeLock>;
  savedButLocked: string | null;
  viewHref: string | null;
  /** Their exhbts that aren't tiles here (drafts on a paid plan, or beyond what the plan shows). */
  unpublished: number;
};

const EASE = "cubic-bezier(0.2, 0, 0, 1)";
const MOVE_MS = 180;

/** rectSortingStrategy without its scaling: tiles slide, they don't squash while another passes. */
const slide: SortingStrategy = (args) => {
  const r = rectSortingStrategy(args);
  return r ? { ...r, scaleX: 1, scaleY: 1 } : null;
};

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

const ICON_BTN =
  "inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-ink hover:border-ink aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-white aria-expanded:border-ink disabled:opacity-50";

function IconButton({
  label,
  onClick,
  pressed,
  expanded,
  children,
}: {
  label: string;
  onClick: () => void;
  pressed?: boolean;
  expanded?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button type="button" aria-label={label} title={label} aria-pressed={pressed} aria-expanded={expanded} onClick={onClick} className={ICON_BTN}>
      {children}
    </button>
  );
}

const STATUS_TEXT = { saved: "Saved", pending: "Saving soon", saving: "Saving" } as const;

/** One tile that can be dragged. The handle (a real button) carries the drag and the keyboard. */
function SortableItem({
  id,
  label,
  wide,
  reduced,
  children,
}: {
  id: string;
  label: string;
  wide: boolean;
  reduced: boolean;
  children: (handle: React.ReactNode) => React.ReactNode;
}) {
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
      data-key={id}
      data-dragging={isDragging ? "true" : undefined}
      style={{ transform: CSS.Translate.toString(transform), transition: transition ?? undefined }}
      className={`${wide ? WIDE : ""} ${isDragging ? "opacity-40" : ""}`}
    >
      {children(handle)}
    </li>
  );
}

export function Customiser({ initial, projects, owner, plan, locks, savedButLocked, viewHref, unpublished }: Props) {
  const ready = useHydrated();
  const reduced = useReducedMotion();
  const { state, status, change, undo, undoable, retry } = useCustomiser(initial, saveCustomisationAction);
  const [editing, setEditing] = useState<TileKind | null>(null);
  const [lockedPick, setLockedPick] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const undoButton = useRef<HTMLButtonElement>(null);

  const byId = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  const hiddenSet = new Set(state.hidden);
  const shown = shownKeys(state.order, hiddenSet, state.featured);
  const featured = state.featured && shown[0] === state.featured ? state.featured : null;
  const gridKeys = featured ? shown.slice(1) : shown;
  const wide = wideIndexes(shown.length, Boolean(featured));
  const problems = checkTiles(state.tiles, state.order).problems;
  const themeId = lockedPick ?? state.themeId;
  const theme = themeById(themeId) ?? DEFAULT_THEME;
  const shownProjects = shown.filter((k) => byId.has(k));
  const labelOf = (key: string) => (isTileKind(key) ? TILE_NAMES[key] : (byId.get(key)?.title ?? "tile"));
  const present = TILE_KINDS.filter((k) => state.order.includes(k));
  const addable = TILE_KINDS.filter((k) => !state.order.includes(k));

  // A tile just added opens its editor: put the cursor in its first field.
  useEffect(() => {
    if (!editing) return;
    const first = document.querySelector<HTMLElement>(`[data-tile-editor="${editing}"] textarea, [data-tile-editor="${editing}"] input`);
    first?.focus();
  }, [editing]);

  // After a tile leaves the grid (hide, remove), focus would be lost: park it on Undo.
  const parkFocus = () => requestAnimationFrame(() => undoButton.current?.focus({ preventScroll: true }));

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    // A short press on the handle: a swipe over the handle still scrolls the page.
    useSensor(TouchSensor, { activationConstraint: { delay: 160, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const position = (key: string | number) => shown.indexOf(String(key)) + 1;
  // dnd-kit reports "over" at once when a tile is picked up; that would drown "Picked up", so skip that first one.
  const justPicked = useRef(false);
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
      over ? `Dropped ${labelOf(String(active.id))}. Position ${position(over.id)} of ${shown.length}.` : `Dropped ${labelOf(String(active.id))}. It stays at position ${position(active.id)} of ${shown.length}.`,
    onDragCancel: ({ active }) => `Cancelled. ${labelOf(String(active.id))} is back at position ${position(active.id)} of ${shown.length}.`,
  };

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }
  function onDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null);
    if (!over || active.id === over.id) return;
    const from = gridKeys.indexOf(String(active.id));
    const to = gridKeys.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    const moved = arrayMove(gridKeys, from, to);
    // The moved tiles take the places the grid's tiles had; hidden and featured exhbts keep theirs.
    change((s) => {
      const inGrid = new Set(gridKeys);
      let i = 0;
      return { ...s, order: s.order.map((k) => (inGrid.has(k) ? moved[i++]! : k)) };
    }, `Moved ${labelOf(String(active.id))}`);
  }

  const hide = (id: string) => {
    change((s) => ({ ...s, hidden: [...s.hidden, id], featured: s.featured === id ? null : s.featured }), `Hid ${labelOf(id)}`);
    parkFocus();
  };
  const show = (id: string) => {
    change((s) => ({ ...s, hidden: s.hidden.filter((h) => h !== id) }), `Showed ${labelOf(id)}`);
    parkFocus();
  };
  const feature = (id: string) =>
    change((s) => ({ ...s, featured: s.featured === id ? null : id }), state.featured === id ? `Took the star off ${labelOf(id)}` : `Featured ${labelOf(id)}`);
  const addTile = (kind: TileKind) => {
    setMenuOpen(false);
    const start = kind === "links" ? { ...emptyTile("links"), linkedin: owner.linkedin ?? "" } : emptyTile(kind);
    change((s) => ({ ...s, order: [...s.order, kind], tiles: { ...s.tiles, [kind]: start } }), `Added ${TILE_NAMES[kind]}`);
    setEditing(kind);
  };
  const removeTile = (kind: TileKind) => {
    if (editing === kind) setEditing(null);
    change((s) => {
      const { [kind]: _gone, ...tiles } = s.tiles;
      void _gone;
      return { ...s, order: s.order.filter((k) => k !== kind), tiles };
    }, `Removed ${TILE_NAMES[kind]}`);
    parkFocus();
  };
  const editTile = <K extends TileKind>(kind: K, next: NonNullable<Tiles[K]>) => change((s) => ({ ...s, tiles: { ...s.tiles, [kind]: next } }));
  const pickLook = (id: string) => {
    if (locks[id]) {
      setLockedPick(id);
      return;
    }
    setLockedPick(null);
    change((s) => ({ ...s, themeId: id }), `Changed the look to ${themeById(id)?.name ?? id}`);
  };
  const setHeader = (key: "skills" | "linkedin", on: boolean) =>
    change((s) => ({ ...s, header: { ...s.header, [key]: on } }), `Turned the ${key === "skills" ? "skills strip" : "LinkedIn button"} ${on ? "on" : "off"}`);

  const linkedinUsable = Boolean(owner.linkedin);
  // Catalogue numbers (EX·01 and on) count the projects shown, top to bottom, as on the public page.
  const projectNo = new Map(shownProjects.map((k, n) => [k, n + 1]));

  /** The toolbar and tile for one place on the page. `handle` is the drag button (absent on the featured tile and in the overlay). */
  function cell(key: string, handle: React.ReactNode, i: number) {
    if (isTileKind(key)) {
      const kind = key;
      const open = editing === kind;
      return (
        <div className="flex h-full flex-col">
          <div className="mb-1.5 flex items-center gap-1.5">
            {handle}
            <span className="min-w-0 flex-1" />
            <IconButton label={open ? `Close ${TILE_NAMES[kind]} editor` : `Edit ${TILE_NAMES[kind]}`} expanded={open} onClick={() => setEditing(open ? null : kind)}>
              <Pencil aria-hidden size={16} strokeWidth={2} />
            </IconButton>
            <IconButton label={`Remove ${TILE_NAMES[kind]}`} onClick={() => removeTile(kind)}>
              <X aria-hidden size={16} strokeWidth={2.25} />
            </IconButton>
          </div>
          <div className="min-h-0 flex-1">
            {open ? (
              <TileEditor
                kind={kind}
                value={(state.tiles[kind] ?? emptyTile(kind)) as never}
                onChange={(v) => editTile(kind, v as never)}
                onDone={() => setEditing(null)}
                problems={problems}
                ready={ready}
              />
            ) : tileHasContent(kind, state.tiles) ? (
              // The preview is not interactive: nothing in it takes focus or opens a page.
              <div inert className="h-full [&>*]:h-full">
                <ExtraTile kind={kind} tiles={previewTiles(state.tiles, kind)} />
              </div>
            ) : (
              <div className="flex h-full min-h-28 flex-col justify-center rounded-[16px] border border-dashed border-field bg-surface p-5 text-graphite">
                <p className="font-semibold text-ink">{TILE_NAMES[kind]}</p>
                <p className="mt-1 text-sm">Empty, so it isn&rsquo;t shown to visitors. Use Edit to add your words.</p>
              </div>
            )}
          </div>
        </div>
      );
    }
    const p = byId.get(key);
    if (!p) return null;
    const isFeatured = key === featured;
    return (
      <div className="flex h-full flex-col">
        <div className="mb-1.5 flex items-center gap-1.5">
          {handle}
          {isFeatured && <span className="chip">Featured, always first</span>}
          <span className="min-w-0 flex-1" />
          {!p.live && <span className="chip bg-mist text-graphite">Draft</span>}
          <IconButton label={isFeatured ? `Take the star off ${p.title}` : `Feature ${p.title}`} pressed={isFeatured} onClick={() => feature(key)}>
            <Star aria-hidden size={16} strokeWidth={2} fill={isFeatured ? "currentColor" : "none"} />
          </IconButton>
          <IconButton label={`Hide ${p.title} from your portfolio`} onClick={() => hide(key)}>
            <EyeOff aria-hidden size={16} strokeWidth={2} />
          </IconButton>
        </div>
        <div inert className="min-h-0 flex-1 [&>*]:h-full">
          <ExhbtTile exhbt={p.tile} href="#" position={projectNo.get(key) ?? 1} maxSkills={wide.has(i) ? 6 : 4} />
        </div>
      </div>
    );
  }
  const activeIndex = activeId ? shown.indexOf(activeId) : -1;
  const statusLine =
    status.kind === "invalid"
      ? `Not saved yet. ${status.message}`
      : status.kind === "error"
        ? `Couldn’t save. ${status.message}`
        : STATUS_TEXT[status.kind];

  return (
    <div data-ready={ready ? "true" : undefined} className="editor-touch">
      <p className="mt-3 max-w-[40rem] text-graphite">Drag tiles to put them in order. Everything saves as you go.</p>

      {/* Status and undo stay in view while the page scrolls. */}
      <div className="sticky top-0 z-20 -mx-4 mt-5 border-y border-line bg-surface px-4 py-2 sm:mx-0 sm:rounded-[14px] sm:border">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <p role="status" data-testid="save-status" data-state={status.kind} className={`text-sm ${status.kind === "error" || status.kind === "invalid" ? "font-semibold text-error" : "text-graphite"}`}>
            {statusLine}
          </p>
          {status.kind === "error" && (
            <button type="button" onClick={retry} className="link text-sm font-semibold">
              Try again
            </button>
          )}
          <span className="flex-1" />
          <button
            ref={undoButton}
            type="button"
            onClick={undo}
            disabled={!undoable}
            aria-label={undoable ? `Undo: ${undoable.label}` : "Undo"}
            className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-sm font-semibold hover:border-ink disabled:opacity-45"
          >
            <Undo2 aria-hidden size={15} strokeWidth={2.25} /> Undo
          </button>
          {viewHref && (
            <a href={viewHref} className="link text-sm font-semibold">
              View my portfolio
            </a>
          )}
        </div>
      </div>

      {plan.publishNote && (
        <UpgradePrompt className="mt-4" reason={`This is a preview on ${plan.name}. ${plan.publishNote.reason}`} upgradeTo={plan.publishNote.upgradeTo} />
      )}

      <section aria-label="Look, header and tiles" className="mt-5 grid gap-6 rounded-[20px] border border-line bg-surface p-5 sm:p-6">
        <ThemeStrip picked={themeId} locks={locks} onPick={pickLook} ready={ready} />
        {lockedPick && locks[lockedPick] && <UpgradePrompt reason={locks[lockedPick]!.reason} upgradeTo={locks[lockedPick]!.upgradeTo} primary={false} />}
        {savedButLocked && !lockedPick && (
          <p className="text-graphite" data-testid="look-held">
            Your saved look, {savedButLocked}, comes with a plan you&rsquo;re not on now. Your portfolio shows the default until you&rsquo;re back on it, then it returns.
          </p>
        )}

        <div className="grid gap-6 border-t border-line pt-6 sm:grid-cols-2">
          <fieldset>
            <legend className="text-[1.0625rem] font-semibold">Top of the page</legend>
            <div className="mt-3 space-y-3">
              <label className="flex items-start gap-3">
                <input type="checkbox" checked={state.header.skills} disabled={!ready} onChange={(e) => setHeader("skills", e.target.checked)} className="mt-1 size-5 shrink-0 accent-[var(--color-jade)]" />
                <span>Show the skills strip</span>
              </label>
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={state.header.linkedin && linkedinUsable}
                  disabled={!ready || !linkedinUsable}
                  onChange={(e) => setHeader("linkedin", e.target.checked)}
                  className="mt-1 size-5 shrink-0 accent-[var(--color-jade)]"
                />
                <span>
                  Show the LinkedIn button
                  {!linkedinUsable && (
                    <span className="block text-sm text-slate">
                      Add your LinkedIn address in{" "}
                      <Link href="/account/portfolio" className="link">
                        portfolio settings
                      </Link>{" "}
                      first.
                    </span>
                  )}
                </span>
              </label>
            </div>
          </fieldset>

          <div>
            <h2 className="text-[1.0625rem] font-semibold">Extra tiles</h2>
            <div className="relative mt-3">
              <button
                type="button"
                aria-expanded={menuOpen}
                aria-controls="add-tile-menu"
                disabled={!ready}
                onClick={() => setMenuOpen((o) => !o)}
                onKeyDown={(e) => e.key === "Escape" && setMenuOpen(false)}
                className="inline-flex items-center gap-1.5 rounded-full border border-ink bg-surface px-4 py-2 text-sm font-semibold hover:bg-mist"
              >
                <Plus aria-hidden size={16} strokeWidth={2.5} /> Add a tile
              </button>
              {menuOpen && (
                <div id="add-tile-menu" onKeyDown={(e) => e.key === "Escape" && setMenuOpen(false)} className="mt-2 rounded-[14px] border border-line bg-surface p-2 shadow-pack">
                  {!plan.extraTiles ? (
                    <UpgradePrompt reason={plan.extraTilesReason ?? ""} upgradeTo="premium" />
                  ) : addable.length === 0 ? (
                    <p className="px-3 py-2 text-graphite">Every tile is on your page.</p>
                  ) : (
                    <ul>
                      {addable.map((k) => (
                        <li key={k}>
                          <button type="button" onClick={() => addTile(k)} className="block w-full rounded-[10px] px-3 py-2 text-left hover:bg-mist">
                            <span className="block font-semibold">{TILE_NAMES[k]}</span>
                            <span className="block text-sm text-graphite">{TILE_HINTS[k]}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
            {plan.heldTiles && (
              <p className="mt-3 text-sm text-graphite" data-testid="tiles-held">
                Your saved tiles come back when you&rsquo;re on a plan that has them.
              </p>
            )}
            {present.length === 0 && plan.extraTiles && <p className="mt-3 text-sm text-graphite">About you, your education, a quote and your links. Remove any with one click.</p>}
          </div>
        </div>
      </section>

      <h2 className="mt-10 text-[1.375rem]">Preview</h2>
      <p className="mt-1 text-graphite">
        Your page as visitors see it. Hold the grip on a tile and drag it, or focus it and press Space, then the arrow keys, then Space again. On a phone, press and hold the grip.
      </p>

      <div data-testid="preview" className="mt-5">
        <PortfolioHeader
          framed
          theme={theme}
          owner={headerOwner(owner, owner.name, owner.photoUrl, state)}
          exhbts={shownProjects.map((k) => byId.get(k)!.tile)}
          showSkills={state.header.skills}
        />

        {projects.length === 0 ? (
          <p className="mt-6 rounded-[16px] border border-line bg-surface p-5">
            You have no exhbts yet.{" "}
            <Link href="/exhbts" className="link font-semibold">
              Start one
            </Link>{" "}
            and it will show here.
          </p>
        ) : (
          <DndContext
            id="portfolio-tiles"
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onDragCancel={() => setActiveId(null)}
            accessibility={{
              announcements,
              screenReaderInstructions: {
                draggable: "To pick up a tile, press Space. Use the arrow keys to move it, then press Space to drop it. Press Escape to cancel.",
              },
            }}
          >
            <SortableContext items={gridKeys} strategy={slide}>
              <ul className={GLANCE_GRID} aria-label="Tiles on your portfolio, in order">
                {featured && (
                  <li key={featured} data-key={featured} className={WIDE}>
                    {cell(featured, null, 0)}
                  </li>
                )}
                {gridKeys.map((key, n) => {
                  const i = featured ? n + 1 : n;
                  return (
                    <SortableItem key={key} id={key} label={labelOf(key)} wide={wide.has(i)} reduced={reduced}>
                      {(handle) => cell(key, handle, i)}
                    </SortableItem>
                  );
                })}
              </ul>
            </SortableContext>
            <DragOverlay dropAnimation={reduced ? null : { duration: MOVE_MS, easing: EASE }} adjustScale={false}>
              {activeId && activeIndex >= 0 ? (
                <div className="cursor-grabbing rounded-[16px] shadow-pack outline outline-2 outline-jade" data-testid="lifted-tile">
                  {cell(activeId, <span aria-hidden className={ICON_BTN}><GripVertical size={18} strokeWidth={2} /></span>, activeIndex)}
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        )}
      </div>

      {projects.length > 0 && shownProjects.length === 0 && plan.canPublish && (
        <p role="alert" className="mt-4 rounded-[14px] border border-error/40 bg-surface px-4 py-3 text-error">
          Every exhbt is hidden, so your portfolio page is offline. Show at least one.
        </p>
      )}

      {state.hidden.length > 0 && (
        <section aria-labelledby="hidden-heading" className="mt-10" data-testid="hidden-tray">
          <h2 id="hidden-heading" className="text-[1.375rem]">
            Hidden from your portfolio
          </h2>
          <p className="mt-1 text-graphite">These stay live at their own links, but they aren&rsquo;t on your page or in lists of it.</p>
          <ul className="mt-3 space-y-2">
            {state.hidden
              .filter((id) => byId.has(id))
              .map((id) => (
                <li key={id} data-hidden-key={id} className="flex flex-wrap items-center justify-between gap-2 rounded-[14px] border border-line bg-surface px-4 py-2.5">
                  <span className="min-w-0 font-semibold break-words">{byId.get(id)!.title}</span>
                  <button
                    type="button"
                    onClick={() => show(id)}
                    aria-label={`Show ${byId.get(id)!.title} on your portfolio`}
                    className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-sm font-semibold hover:border-ink"
                  >
                    <Eye aria-hidden size={15} strokeWidth={2} /> Show
                  </button>
                </li>
              ))}
          </ul>
        </section>
      )}

      {unpublished > 0 && plan.canPublish && (
        <p className="mt-8 text-graphite">
          {unpublished === 1 ? "1 exhbt isn’t" : `${unpublished} exhbts aren’t`} on your portfolio yet.{" "}
          <Link href="/exhbts" className="link font-semibold text-ink">
            Go to your exhbts
          </Link>
        </p>
      )}
    </div>
  );
}

/** The tile as the page will show it: each kind's words tidied by the same rules as saving, or as typed if they don't pass yet. */
function previewTiles(tiles: Tiles, kind: TileKind): Tiles {
  const { clean } = checkTiles(tiles, [kind]);
  return clean[kind] ? clean : tiles;
}
