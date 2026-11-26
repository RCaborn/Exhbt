"use client";

import "../css/phone.css";
import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { closestCenter, DndContext, type DragEndEvent } from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS as Dnd } from "@dnd-kit/utilities";
import { IconButton } from "@astryxdesign/core/IconButton";
import { ArrowDown, ArrowUp, GripVertical, Undo2 } from "lucide-react";
import { Said } from "@/components/exhbt-editor/ui/Said";
import { Button } from "@/components/ui/Button";
import type { SectionKey } from "@/lib/portfolio-layout";
import {
  usePortfolioApi,
  usePortfolioState,
  usePortfolioUndo,
  useRuntime,
} from "../runtime";
import { moveSection } from "../sections/arrange";
import {
  announcementsFor,
  EASE,
  MOVE_MS,
  useDragSensors,
  useReducedMotion,
} from "../sections/drag";
import { sectionName, W } from "../sections/words";
import { Sheet } from "../ui/Sheet";

/*
 * "Reorder sections" (decision 0031, "On a phone"; brief I, step 2), opened by `open("reorder")` from the
 * bar's menu under a finger: a sheet of the page's sections as short rows, in page order, each with its
 * name, a grip and Move up and Move down, for a thumb, where a long drag down the page is hard. The rows
 * are one height, so dnd-kit's sortable list does the dragging with the page's own sensors (a 160ms press
 * with 8px of give on a grip; the keyboard from the grip). Every drop and every button is one change to
 * `arrangement.sections`, one Undo step, named as the page's own moves are ("moved About me"), and the
 * sheet's foot has its own Undo beside Done.
 *
 * The sheet is a modal dialog, so the page behind it (and its live region) is inert: what happens is said
 * in the sheet's own live region, and dnd-kit's words are drawn there too. "Done" closes it and takes the
 * page to the section last moved, with its More focused. The exhbt editor's sheet is the pattern
 * (components/exhbt-editor/phone/ReorderSheet.tsx); this one is the portfolio's, in app chrome.
 */

export const REORDER = {
  title: "Reorder sections",
  how: "Hold a grip to drag a section, or use the arrows. Each move can be undone.",
  list: "Sections, in page order",
  done: "Done",
  grip: (n: string) => `Drag ${n}`,
};

export function ReorderSheet(): ReactNode {
  return (
    <Sheet
      name="reorder"
      title={REORDER.title}
      subtitle={REORDER.how}
      footer={<DoneButton />}
    >
      <ReorderList />
    </Sheet>
  );
}

/** The section last moved in the sheet, for Done: one per editor, the sheet is drawn once. */
const last = { moved: null as SectionKey | null };

/**
 * The sheet's foot: Undo, named for the last move (the page and its bar are behind the sheet, so its own
 * Undo is here), and Done.
 */
function DoneButton(): ReactNode {
  const api = usePortfolioApi();
  const undo = usePortfolioUndo();
  const done = () => {
    const key = last.moved;
    last.moved = null;
    api.close();
    if (!key) return;
    // After the dialog has given the focus back (to the bar's menu): the page at the section moved.
    setTimeout(() => {
      const frame = document.querySelector<HTMLElement>(
        `[data-section-frame="${key}"]`,
      );
      if (!frame) return;
      frame.scrollIntoView({ block: "center" });
      frame
        .querySelector<HTMLElement>('[data-act="more"]')
        ?.focus({ preventScroll: true });
    }, 450);
  };
  return (
    <span className="pe-reorder-foot">
      <Button
        size="md"
        label={undo.label ? `Undo: ${undo.label}` : "Undo"}
        {...(undo.label ? {} : ({ "aria-disabled": true } as object))}
        onClick={() => undo.label && undo.undo()}
      >
        <Undo2 aria-hidden size={16} strokeWidth={2.25} className="shrink-0" />
        Undo
      </Button>
      <Button variant="primary" size="md" onClick={done}>
        {REORDER.done}
      </Button>
    </span>
  );
}

function ReorderList(): ReactNode {
  const api = usePortfolioApi();
  const rt = useRuntime();
  const sections = usePortfolioState((s) => s.arrangement.sections);
  const sensors = useDragSensors();
  const reduced = useReducedMotion();
  const announcements = useMemo(
    () =>
      announcementsFor(
        () => rt.state.get().arrangement.sections,
        (id) => sectionName(id as SectionKey),
      ),
    [rt],
  );
  const [said, setSaid] = useState({ text: "", n: 0 });
  const [region, setRegion] = useState<HTMLElement | null>(null);
  const list = useRef<HTMLUListElement>(null);
  /** After a move by button: the row's button to give the focus back to (the row has moved). */
  const refocus = useRef<{ key: SectionKey; by: -1 | 1 } | null>(null);
  const n = sections.length;

  const moveTo = (key: SectionKey, to: number) => {
    const name = sectionName(key);
    api.change((s) => moveSection(s, key, to), W.moved(name));
    last.moved = key;
    const at = rt.state.get().arrangement.sections.indexOf(key) + 1;
    setSaid((s) => ({ text: W.saidMoved(name, at, n), n: s.n + 1 }));
  };

  const step = (key: SectionKey, by: -1 | 1) => {
    const from = rt.state.get().arrangement.sections.indexOf(key);
    const to = from + by;
    if (from < 0 || to < 0 || to >= n) return;
    refocus.current = { key, by };
    moveTo(key, to);
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const to = rt.state
      .get()
      .arrangement.sections.indexOf(over.id as SectionKey);
    if (to >= 0) moveTo(active.id as SectionKey, to);
  };

  // The focus stays on the button pressed, or goes to the other one at an end.
  useLayoutEffect(() => {
    const r = refocus.current;
    if (!r) return;
    refocus.current = null;
    const row = list.current?.querySelector(`[data-row="${r.key}"]`);
    const pressed = row?.querySelector<HTMLButtonElement>(
      `[data-move="${r.by < 0 ? "up" : "down"}"]`,
    );
    const other = row?.querySelector<HTMLButtonElement>(
      `[data-move="${r.by < 0 ? "down" : "up"}"]`,
    );
    (pressed &&
    !pressed.disabled &&
    pressed.getAttribute("aria-disabled") !== "true"
      ? pressed
      : other
    )?.focus();
  });

  return (
    <div className="pe-reorder" data-reorder>
      <div ref={setRegion}>
        <Said text={said.text} n={said.n} data-said={said.n} />
      </div>
      <DndContext
        id="portfolio-editor-reorder"
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
        accessibility={{
          announcements,
          container: region ?? undefined,
          screenReaderInstructions: { draggable: W.sectionsHelp },
        }}
      >
        <SortableContext
          items={sections}
          strategy={verticalListSortingStrategy}
        >
          <ul ref={list} className="pe-reorder-list" aria-label={REORDER.list}>
            {sections.map((key, i) => (
              <Row
                key={key}
                sectionKey={key}
                first={i === 0}
                last={i === n - 1}
                reduced={reduced}
                onStep={step}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
    </div>
  );
}

function Row({
  sectionKey,
  first,
  last: end,
  reduced,
  onStep,
}: {
  sectionKey: SectionKey;
  first: boolean;
  last: boolean;
  reduced: boolean;
  onStep(key: SectionKey, by: -1 | 1): void;
}): ReactNode {
  const name = sectionName(sectionKey);
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: sectionKey,
    transition: reduced ? null : { duration: MOVE_MS, easing: EASE },
    attributes: { roleDescription: "sortable section" },
  });
  return (
    <li
      ref={setNodeRef}
      data-row={sectionKey}
      data-dragging={isDragging ? "true" : undefined}
      className="pe-reorder-row"
      style={{
        transform: Dnd.Translate.toString(transform && { ...transform, x: 0 }),
        transition: transition ?? undefined,
      }}
    >
      <IconButton
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        data-grip
        className="pe-reorder-grip"
        variant="ghost"
        label={REORDER.grip(name)}
        icon={<GripVertical aria-hidden size={18} strokeWidth={2} />}
      />
      <span className="pe-reorder-name">{name}</span>
      <IconButton
        data-move="up"
        variant="ghost"
        label={W.sectionUp(name)}
        tooltip={first ? W.firstAlready(name) : undefined}
        isDisabled={first}
        onClick={() => onStep(sectionKey, -1)}
        icon={<ArrowUp aria-hidden size={18} strokeWidth={2} />}
      />
      <IconButton
        data-move="down"
        variant="ghost"
        label={W.sectionDown(name)}
        tooltip={end ? W.lastAlready(name) : undefined}
        isDisabled={end}
        onClick={() => onStep(sectionKey, 1)}
        icon={<ArrowDown aria-hidden size={18} strokeWidth={2} />}
      />
    </li>
  );
}
