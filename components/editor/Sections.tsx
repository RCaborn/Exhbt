"use client";

/* eslint-disable @next/next/no-img-element -- signed Storage URLs; see components/portfolio/Avatar.tsx. */
import { useEffect, useId, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowDown, ArrowUp, ChartBar, Flag, GripVertical, ImageIcon, Lightbulb, Link2, ListChecks, Plus, Quote, Target, TextQuote, X, type LucideIcon } from "lucide-react";
import { PickedFigure, type ReplaceFigure } from "./PickedFigure";
import { Button } from "@/components/ui/Button";
import { useReducedMotion } from "@/components/ui/useReducedMotion";
import { formatLimits, LIMITS, plain, wordCount, words, type ExhbtDoc, type Issue, type Limits, type Section, type SectionKind, type SectionOf } from "@/lib/exhbt/blocks";
import { FORMAT_COPY, FORMAT_RULES, formatOf, isShown, type Format } from "@/lib/exhbt/formats";
import { isArranged } from "@/lib/exhbt/layouts";
import { firstOfKinds, layoutNotes, moveSection, newSection, roomFor, sectionLabel } from "@/lib/exhbt/sections";
import { BlockTools, type DraftTools } from "./BlockTools";
import { ChartEditor } from "./ChartEditor";
import { FieldIssues } from "./FieldIssues";
import { issuesAt, type CardKey } from "./model";
import { Card, TextInput, WordsOf } from "./parts";

/** Tiptap loads in its own chunk, only in the editor, and only in the browser (as in Editor.tsx). */
const RichTextField = dynamic(() => import("./RichTextField").then((m) => m.RichTextField), {
  ssr: false,
  loading: () => <div aria-hidden className="field mt-[2.4rem] min-h-[2.9rem]" />,
});

type SetDoc = React.Dispatch<React.SetStateAction<ExhbtDoc>>;

/**
 * The "Add a section" menu for a layout, in order, with what each kind is for: only the kinds the
 * layout draws, named in its own words, with hints and caps from formatLimits (decision 0024).
 * A case study's menu is as it always was.
 */
function menuFor(f: Format): { kind: SectionKind; add: string; icon: LucideIcon; hint: string }[] {
  const L = formatLimits(f);
  const all: { kind: SectionKind; add: string; icon: LucideIcon; hint: string }[] = [
    { kind: "aim", add: "Add aim or hypothesis", icon: Target, hint: `What the study set out to test, up to ${L.aim.words} words.` },
    {
      kind: "findings",
      add: f === "research" ? "Add results" : f === "gallery" ? "Add what happened" : "Add findings",
      icon: ListChecks,
      hint: `${L.findings.min} to ${L.findings.max} bullets of ${f === "research" ? "what the study found" : "what you found or achieved"}.`,
    },
    { kind: "graph", add: "Add a graph", icon: ChartBar, hint: "Figures from your work, typed in by hand." },
    { kind: "image", add: "Add an image", icon: ImageIcon, hint: `A screenshot or figure, with a caption of up to ${L.images.captionWords} words.` },
    { kind: "conclusion", add: "Add conclusion", icon: Flag, hint: `What the work concludes, up to ${L.conclusion.words} words.` },
    { kind: "pullquote", add: "Add a pull quote", icon: TextQuote, hint: `A line from your own work, drawn large, up to ${L.pullquote.words} words.` },
    { kind: "quote", add: "Add a quote", icon: Quote, hint: `Feedback someone gave, up to ${L.quote.words} words, with their name.` },
    { kind: "reflection", add: `Add ${f === "research" ? "limitations and next steps" : "what I'd do next"}`, icon: Lightbulb, hint: `One or two lines, up to ${L.reflection.words} words.` },
    { kind: "link", add: f === "research" ? "Add a reference" : "Add a link", icon: Link2, hint: f === "research" ? "A paper or source you used, as a link." : f === "gallery" ? "The film, the full set of pictures or the deck." : "A repository, a demo or a document." },
  ];
  const kinds = FORMAT_RULES[f].kinds;
  const order: SectionKind[] = ["findings", "pullquote", "graph", "image", "quote", "reflection", "link", "aim", "conclusion"];
  const sorted = f === "research" ? all : [...all].sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
  return sorted.filter((m) => kinds.includes(m.kind));
}

/** Why a kind can't be added: there's one already, every one is used, or (research) the figures together are at their cap. */
function fullReason(kind: SectionKind, f: Format, sections: Section[]): string {
  const L = formatLimits(f);
  const figures = sections.filter((s) => s.kind === "graph" || s.kind === "image").length;
  const ofKind = sections.filter((s) => s.kind === kind).length;
  if (L.maxFigures !== null && (kind === "graph" || kind === "image") && figures >= L.maxFigures && ofKind < L.sections[kind]) {
    return `Up to ${L.maxFigures} figures, graphs and images together.`;
  }
  return L.sections[kind] === 1 ? "Already on the page." : `All ${L.sections[kind]} used.`;
}

/** "Graph 1" → "graph 1", for "Move graph 1 up". */
const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/** Puts the cursor in a card's first field (or its first button), after it has been drawn. */
function focusCard(id: string) {
  requestAnimationFrame(() => {
    const card = document.getElementById(id)?.closest("section");
    if (!card) return;
    card.scrollIntoView({ block: "nearest" });
    const field = card.querySelector<HTMLElement>("input:not([type=file]),textarea,[role=textbox]") ?? card.querySelector<HTMLElement>("button:not([disabled])");
    field?.focus({ preventScroll: true });
  });
}

/** How dragging works, read out with each drag handle (dnd-kit's screen-reader instructions). */
const DRAG_INSTRUCTIONS =
  "To move this section, press Space or Enter, use the up and down arrow keys, then press Space or Enter again to drop it, or Escape to cancel. The move up and move down buttons do the same.";

/**
 * Everything below the flowchart (decision 0015): one card per section, in page order, each with
 * a drag handle (dnd-kit's sortable, which also works from the keyboard and reads out each move),
 * move up and down buttons (a plain keyboard and screen-reader way to reorder) and a remove
 * button; then "Add a section", which says how many words are left and offers only the kinds
 * there's room for. The flowchart above stays on every exhbt and isn't here.
 */
export function Sections({
  doc,
  setDoc,
  issues,
  words: cw,
  flaggedBy,
  heaviest,
  dt,
  imageUrls,
  maxFileMb,
  onAddImage,
  imageBusy,
  imageError,
  imageStatus,
  dropFile,
  figureSources,
  onReplaceImage,
}: {
  doc: ExhbtDoc;
  setDoc: SetDoc;
  issues: Issue[];
  words: Partial<Record<CardKey, number>>;
  flaggedBy: (card: CardKey) => boolean;
  heaviest: CardKey | undefined;
  dt: DraftTools;
  imageUrls: Record<string, string | null>;
  maxFileMb: number;
  /** Opens the file picker; the image's section is added once it has uploaded. */
  onAddImage: () => void;
  imageBusy: boolean;
  imageError?: string;
  /** Progress and the result of adding pictures ("Uploading 3 of 6"). */
  imageStatus?: string;
  /** Takes an image's file out of the draft (deleted once the save without it lands). */
  dropFile: (fileId: string) => void;
  /** Links to the stored files picked figures came from, by file id (decision 0017). */
  figureSources: Record<string, string | null>;
  /** Puts a new picture in an image section (a picked figure cropped again, or another page). */
  onReplaceImage: (sectionId: string, ...args: Parameters<ReplaceFigure>) => Promise<void>;
}) {
  const sections = doc.sections;
  const f = formatOf(doc);
  const L = formatLimits(f);
  const arranged = isArranged(doc);
  const [status, setStatus] = useState<{ text: string; undo?: { section: Section; index: number; label: string } } | null>(null);
  const dndId = useId();
  const reduced = useReducedMotion();
  const sensors = useSensors(
    // A small movement before a drag starts, so a click on the handle stays a click.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const indexOf = (id: UniqueIdentifier) => sections.findIndex((s) => s.id === id);
  const nameOf = (id: UniqueIdentifier) => (indexOf(id) >= 0 ? sectionLabel(sections, indexOf(id), f) : "The section");
  // dnd-kit reports the section over its own place straight after it's picked up; that isn't
  // read out (it would cut off "Picked up"), only places after it, and coming back to it.
  const leftStart = useRef(false);
  /** What dnd-kit reads out as a section is picked up, moved and dropped, in our words. */
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

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    move(indexOf(active.id), indexOf(over.id), "drag");
  }

  const setSections = (fn: (s: Section[]) => Section[]) => setDoc((d) => ({ ...d, sections: fn(d.sections) }));
  /** Changes one section, found by id, so a change never lands on a section that has just moved. */
  const patch = <K extends SectionKind>(id: string, fn: (s: SectionOf<K>) => SectionOf<K>) =>
    setSections((ss) => ss.map((s) => (s.id === id ? (fn(s as SectionOf<K>) as Section) : s)));

  function move(i: number, to: number, by: "keys" | "drag") {
    if (to < 0 || to >= sections.length || to === i) return;
    const s = sections[i]!;
    const next = moveSection(sections, i, to);
    setSections(() => next);
    // A drag is read out by dnd-kit itself (announcements above); a button press is said here.
    setStatus(by === "keys" ? { text: `${sectionLabel(sections, i, f)} moved ${to < i ? "up" : "down"}: now ${to + 1} of ${sections.length}.` } : null);
    if (by === "keys") {
      // Focus stays on the button that was pressed, or the other one when that end is reached.
      const dir = to < i ? "up" : "down";
      requestAnimationFrame(() => {
        const card = document.querySelector(`[data-section-id="${s.id}"]`);
        const pressed = card?.querySelector<HTMLButtonElement>(`[data-move="${dir}"] button`);
        const other = card?.querySelector<HTMLButtonElement>(`[data-move="${dir === "up" ? "down" : "up"}"] button`);
        const usable = (b: HTMLButtonElement | null | undefined) => b && !b.disabled && b.getAttribute("aria-disabled") !== "true";
        (usable(pressed) ? pressed : other)?.focus();
      });
    }
  }

  /** "Make lead image" (gallery) and "Make key figure" (research): moves the section to the front of its kind. */
  function makeFirst(i: number) {
    const s = sections[i]!;
    const to = firstOfKinds(sections, f === "gallery" ? ["image"] : ["graph", "image"]);
    if (to < 0 || to === i) return;
    setSections((ss) => moveSection(ss, i, to));
    setStatus({ text: f === "gallery" ? "That image is now the lead image." : "That is now the key figure." });
    requestAnimationFrame(() => {
      const card = document.querySelector(`[data-section-id="${s.id}"]`);
      card?.querySelector<HTMLButtonElement>('[data-move="down"] button')?.focus();
    });
  }

  function remove(i: number) {
    const s = sections[i]!;
    const label = sectionLabel(sections, i, f);
    if (s.kind === "image") dropFile(s.fileId);
    setSections((ss) => ss.filter((x) => x.id !== s.id));
    // An image's file goes once the save lands, so it can't come back; anything else can.
    setStatus({ text: `${label} removed.`, ...(s.kind === "image" ? {} : { undo: { section: s, index: i, label: lowerFirst(label) } }) });
    requestAnimationFrame(() => document.getElementById("add-section")?.focus());
  }

  function undo() {
    const u = status?.undo;
    if (!u) return;
    setSections((ss) => [...ss.slice(0, u.index), u.section, ...ss.slice(u.index)]);
    setStatus({ text: "Put back." });
    focusCard(`card-section-${Math.min(u.index, sections.length)}`);
  }

  function add(kind: Exclude<SectionKind, "image">) {
    const index = sections.length;
    setSections((ss) => (roomFor(ss, kind, f) > 0 ? [...ss, newSection(kind, ss)] : ss));
    setStatus(null);
    focusCard(`card-section-${index}`);
  }

  return (
    <section aria-labelledby="card-sections" className="space-y-5">
      <div>
        <h2 id="card-sections" className="scroll-mt-24 text-[1.375rem]">
          Sections
        </h2>
        {/* On the mist page, not a white card: graphite, since the hint's slate is under 4.5:1 here. */}
        <p className="mt-1 text-sm text-graphite">
          {arranged || (f !== "case-study" && f !== "gallery" && f !== "research")
            ? "The page is drawn in this order, the flowchart included. Drag the sections, or use the arrows, to change it."
            : f === "case-study"
              ? "Below the flowchart, in this order. Add the ones that suit the project; drag them, or use the arrows, to change the order."
              : f === "gallery"
                ? "In a gallery, the page sets where each part goes. The order of your images sets the gallery: the first is the lead."
                : "In research, the page sets where each part goes. The order of your graphs and images sets the poster: the first is the key figure."}
        </p>
      </div>

      {sections.length > 0 && (
        <DndContext id={dndId} sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd} accessibility={{ announcements, screenReaderInstructions: { draggable: DRAG_INSTRUCTIONS } }}>
          <SortableContext items={sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            <ol aria-label="Sections, in page order" className="space-y-5">
              {sections.map((s, i) => {
                const key = `section-${i}` as CardKey;
                const label = sectionLabel(sections, i, f);
                const lower = lowerFirst(label);
                const hidden = !isShown(doc, s);
                if (s.kind === "flow") {
                  return (
                    <SortableSection key={s.id} id={s.id} kind="flow" label={lower} reduced={reduced}>
                      {(handle) => (
                        <Card
                          id={`card-section-${i}`}
                          level="h3"
                          title={label}
                          controls={{
                            before: handle,
                            after: (
                              <span className="flex flex-wrap items-center gap-1">
                                <span data-move="up">
                                  <Button size="sm" label={`Move ${lower} up`} disabled={i === 0} onClick={() => move(i, i - 1, "keys")}>
                                    <ArrowUp aria-hidden size={14} strokeWidth={2.25} />
                                  </Button>
                                </span>
                                <span data-move="down">
                                  <Button size="sm" label={`Move ${lower} down`} disabled={i === sections.length - 1} onClick={() => move(i, i + 1, "keys")}>
                                    <ArrowDown aria-hidden size={14} strokeWidth={2.25} />
                                  </Button>
                                </span>
                              </span>
                            ),
                          }}
                        >
                          <p className="text-sm text-graphite">Edit its boxes in the card above.</p>
                        </Card>
                      )}
                    </SortableSection>
                  );
                }
                const makes =
                  f === "gallery" && s.kind === "image" && i !== firstOfKinds(sections, ["image"])
                    ? "Make lead image"
                    : f === "research" && (s.kind === "graph" || s.kind === "image") && i !== firstOfKinds(sections, ["graph", "image"])
                      ? "Make key figure"
                      : null;
                return (
                  <SortableSection key={s.id} id={s.id} kind={s.kind} label={lower} reduced={reduced}>
                    {(handle) => (
                      <Card
                        id={`card-section-${i}`}
                        level="h3"
                        title={label}
                        words={cw[key]}
                        limit={s.kind === "reflection" ? L.reflection.words : s.kind === "aim" ? L.aim.words : s.kind === "conclusion" ? L.conclusion.words : s.kind === "pullquote" ? L.pullquote.words : undefined}
                        hint={hintFor(s, maxFileMb, L, f)}
                        flagged={flaggedBy(key)}
                        heaviest={heaviest === key}
                        controls={{
                          before: handle,
                          after: (
                            <span className="flex flex-wrap items-center gap-1">
                              {makes && (
                                <span data-make>
                                  <Button size="sm" label={`${makes}: ${lower}`} onClick={() => makeFirst(i)}>
                                    {makes}
                                  </Button>
                                </span>
                              )}
                              <span data-move="up">
                                <Button size="sm" label={`Move ${lower} up`} disabled={i === 0} onClick={() => move(i, i - 1, "keys")}>
                                  <ArrowUp aria-hidden size={14} strokeWidth={2.25} />
                                </Button>
                              </span>
                              <span data-move="down">
                                <Button size="sm" label={`Move ${lower} down`} disabled={i === sections.length - 1} onClick={() => move(i, i + 1, "keys")}>
                                  <ArrowDown aria-hidden size={14} strokeWidth={2.25} />
                                </Button>
                              </span>
                              <Button size="sm" variant="danger" label={`Remove ${lower}`} onClick={() => remove(i)}>
                                <X aria-hidden size={14} strokeWidth={2.25} />
                              </Button>
                            </span>
                          ),
                        }}
                      >
                        {hidden && (
                          <p className="mb-4 rounded-[10px] bg-mist px-3 py-2 text-sm text-graphite" data-hidden-tag>
                            Not shown in this layout. It&apos;s kept if you switch back.
                          </p>
                        )}
                        <SectionBody
                          s={s}
                          i={i}
                          sections={sections}
                          f={f}
                          L={L}
                          patch={patch}
                          issues={issues}
                          dt={dt}
                          imageUrls={imageUrls}
                          figureSources={figureSources}
                          onReplaceImage={onReplaceImage}
                        />
                      </Card>
                    )}
                  </SortableSection>
                );
              })}
            </ol>
          </SortableContext>
        </DndContext>
      )}

      <div role="status" className="text-sm">
        {status && (
          <p className="flex flex-wrap items-center gap-2">
            <span>{status.text}</span>
            {status.undo && (
              <Button size="sm" onClick={undo} label={`Undo: put ${status.undo.label} back`}>
                Undo
              </Button>
            )}
          </p>
        )}
        {imageBusy && <p className="text-graphite">{imageStatus || "Uploading the image…"}</p>}
        {!imageBusy && imageStatus && <p>{imageStatus}</p>}
      </div>

      <AddSection doc={doc} onAdd={add} onAddImage={onAddImage} imageBusy={imageBusy} />
      {imageError && (
        <p role="alert" className="text-sm whitespace-pre-line text-error">
          {imageError}
        </p>
      )}
      <FieldIssues id="sections-issues" issues={issuesAt(issues, "sections")} />
    </section>
  );
}

/**
 * One section in the sortable list: the card moves with the pointer (or the arrow keys) and is
 * lifted with the pack shadow while it's dragged. The handle is a button with the grip icon; the
 * sorting animation is off for people who ask for less motion.
 */
function SortableSection({
  id,
  kind,
  label,
  reduced,
  children,
}: {
  id: string;
  kind: SectionKind | "flow";
  /** "graph 1", for "Drag graph 1". */
  label: string;
  reduced: boolean;
  children: (handle: React.ReactNode) => React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id, transition: reduced ? null : undefined });
  const handle = (
    <button
      type="button"
      ref={setActivatorNodeRef}
      {...attributes}
      {...listeners}
      aria-label={`Drag ${label} to move it`}
      data-grip
      className="inline-flex size-9 shrink-0 cursor-grab touch-none items-center justify-center self-center rounded-full border border-line bg-surface text-ink hover:border-ink active:cursor-grabbing"
    >
      <GripVertical aria-hidden size={18} strokeWidth={2.25} />
    </button>
  );
  return (
    <li
      ref={setNodeRef}
      data-section-id={id}
      data-kind={kind}
      data-dragging={isDragging || undefined}
      style={{ transform: CSS.Translate.toString(transform), transition: reduced ? undefined : transition }}
      className={`relative ${isDragging ? "z-10 [&>section]:shadow-pack" : ""}`}
    >
      {children(handle)}
    </li>
  );
}

function hintFor(s: Section, maxFileMb: number, L: Limits, f: Format): string {
  switch (s.kind) {
    case "findings":
      return `${L.findings.min} to ${L.findings.max} bullets, up to ${L.findings.wordsEach} words each.`;
    case "graph":
      return "From figures in your work, typed in by hand. To keep figures confidential, protect the real numbers: the page then shows only the change. Anything else can go in as an image.";
    case "image":
      return `A caption of up to ${L.images.captionWords} words. JPEG, PNG, WebP or GIF, up to ${maxFileMb} MB.`;
    case "quote":
      return `Feedback someone gave on the work, in their own words: up to ${L.quote.words} words, with their name.`;
    case "reflection":
      return f === "research" ? "One or two lines: the limits of the study, and what you'd do next." : "One or two lines: what you'd do next, or do differently.";
    case "link":
      return FORMAT_COPY[f].linkHint;
    case "aim":
    case "conclusion":
      return "Only what your report states.";
    case "pullquote":
      return "A line from your own words, drawn large on the page. Plain text.";
    case "flow":
      return "";
  }
}

/* ---------------- Each kind's fields ---------------- */

type Patch = <K extends SectionKind>(id: string, fn: (s: SectionOf<K>) => SectionOf<K>) => void;

function SectionBody({
  s,
  i,
  sections,
  f,
  L,
  patch,
  issues,
  dt,
  imageUrls,
  figureSources,
  onReplaceImage,
}: {
  s: Section;
  i: number;
  sections: Section[];
  f: Format;
  L: Limits;
  patch: Patch;
  issues: Issue[];
  dt: DraftTools;
  imageUrls: Record<string, string | null>;
  figureSources: Record<string, string | null>;
  onReplaceImage: (sectionId: string, ...args: Parameters<ReplaceFigure>) => Promise<void>;
}) {
  const p = `sections.${i}`;
  const pid = `s-${s.id}`;
  /** Which of its kind this is, from 0: "Graph 2" is graph 1. */
  const nth = sections.slice(0, i).filter((x) => x.kind === s.kind).length;
  switch (s.kind) {
    case "findings":
      return <FindingsFields s={s} p={p} patch={patch} issues={issues} dt={dt} L={L} />;
    case "graph":
      return (
        <ChartEditor
          bare
          chart={s.chart}
          index={nth}
          base={`${p}.chart`}
          issues={issues}
          onChange={(chart) => patch<"graph">(s.id, (x) => ({ ...x, chart }))}
        />
      );
    case "image": {
      const picked = s.picked;
      return (
        <div className="space-y-4">
        {picked && (
          <PickedFigure
            s={{ ...s, picked }}
            path={p}
            issues={issues}
            sourceUrl={picked.sourceFileId ? (figureSources[picked.sourceFileId] ?? null) : null}
            onTick={(shareOk) => patch<"image">(s.id, (x) => (x.picked ? { ...x, picked: { ...x.picked, shareOk } } : x))}
            onReplace={(...args) => onReplaceImage(s.id, ...args)}
          />
        )}
        <div className={`grid gap-3 ${f === "gallery" ? "grid-cols-[4.5rem_1fr]" : "sm:grid-cols-[9rem_1fr]"}`}>
          {imageUrls[s.fileId] ? (
            <img src={imageUrls[s.fileId]!} alt="" className={`rounded-[12px] border border-line ${f === "gallery" ? "size-[4.5rem] object-cover" : "w-full"}`} />
          ) : (
            <div className={`flex items-center justify-center rounded-[12px] border border-dashed border-field bg-mist text-slate ${f === "gallery" ? "size-[4.5rem]" : "aspect-[4/3]"}`}>
              <ImageIcon aria-hidden size={24} />
              <span className="sr-only">Image {nth + 1} (preview not available)</span>
            </div>
          )}
          <div className="space-y-3">
            <TextInput
              id={`image-${nth}-alt`}
              label={`Image ${nth + 1}: describe it for people who can't see it`}
              value={s.alt}
              onChange={(alt) => patch<"image">(s.id, (x) => ({ ...x, alt }))}
              issues={issuesAt(issues, `${p}.alt`)}
              multiline
              placeholder="e.g. Bar chart of queue times before and after"
            />
            {f === "before-after" && (
              <fieldset>
                <legend className="label">{`Image ${nth + 1}: before or after`}</legend>
                <div className="flex flex-wrap gap-5">
                  {([["before", "Before"], ["after", "After"], [undefined, "Neither"]] as const).map(([v, name]) => (
                    <label key={name} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name={`${pid}-stage`}
                        checked={s.stage === v}
                        onChange={() =>
                          patch<"image">(s.id, (x) => {
                            const { stage: _old, ...rest } = x;
                            void _old;
                            return v ? { ...rest, stage: v } : rest;
                          })
                        }
                        className="size-4 accent-jade"
                      />
                      {name}
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
            <div>
              <span id={`image-${nth}-caption`} className="label">
                Image {nth + 1} caption
              </span>
              <RichTextField
                labelId={`image-${nth}-caption`}
                describedBy={`image-${nth}-caption-issues`}
                value={s.caption}
                onChange={(caption) => patch<"image">(s.id, (x) => ({ ...x, caption }))}
              />
              <FieldIssues id={`image-${nth}-caption-issues`} issues={issuesAt(issues, `${p}.caption`)} />
            </div>
          </div>
        </div>
        </div>
      );
    }
    case "quote":
      return (
        <div className="space-y-4">
          <div>
            <TextInput
              id={`${pid}-text`}
              label="The quote, word for word"
              value={s.text}
              multiline
              onChange={(text) => patch<"quote">(s.id, (x) => ({ ...x, text }))}
              issues={issuesAt(issues, `${p}.text`)}
              placeholder="e.g. The second till made lunchtimes calmer for staff and students."
            />
            <p className="mt-1">
              <WordsOf n={words(s.text)} limit={LIMITS.quote.words} />
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextInput
              id={`${pid}-name`}
              label="Who said it"
              value={s.name}
              max={LIMITS.quote.nameChars}
              onChange={(name) => patch<"quote">(s.id, (x) => ({ ...x, name }))}
              issues={issuesAt(issues, `${p}.name`)}
              placeholder="e.g. Priya Shah"
            />
            <TextInput
              id={`${pid}-role`}
              label="Their role (optional)"
              value={s.role}
              max={LIMITS.quote.roleChars}
              onChange={(role) => patch<"quote">(s.id, (x) => ({ ...x, role }))}
              issues={issuesAt(issues, `${p}.role`)}
              placeholder="e.g. Cafe manager"
            />
          </div>
        </div>
      );
    case "reflection":
      return (
        <div>
          <span id={`${pid}-text`} className="label">
            {FORMAT_COPY[f].reflectionLabel}
          </span>
          <RichTextField
            labelId={`${pid}-text`}
            describedBy={`${pid}-text-issues`}
            value={s.text}
            onChange={(text) => patch<"reflection">(s.id, (x) => ({ ...x, text }))}
            placeholder={FORMAT_COPY[f].reflectionPlaceholder}
          />
          <FieldIssues id={`${pid}-text-issues`} issues={issuesAt(issues, `${p}.text`)} />
        </div>
      );
    case "aim":
      return (
        <div className="space-y-4">
          <fieldset>
            <legend className="label">This is the</legend>
            <div className="flex gap-5">
              {(["aim", "hypothesis"] as const).map((h) => (
                <label key={h} className="flex items-center gap-2">
                  <input type="radio" name={`${pid}-heading`} checked={(s.heading ?? "aim") === h} onChange={() => patch<"aim">(s.id, (x) => ({ ...x, heading: h }))} className="size-4 accent-jade" />
                  {h === "aim" ? "Aim" : "Hypothesis"}
                </label>
              ))}
            </div>
          </fieldset>
          <div>
            <span id={`${pid}-text`} className="label">
              What the study set out to do or test
            </span>
            <RichTextField
              labelId={`${pid}-text`}
              describedBy={`${pid}-text-issues`}
              value={s.text}
              onChange={(text) => patch<"aim">(s.id, (x) => ({ ...x, text }))}
              placeholder="e.g. Students who walk before a test will recall more words than students who sit."
            />
            <FieldIssues id={`${pid}-text-issues`} issues={issuesAt(issues, `${p}.text`)} />
          </div>
        </div>
      );
    case "conclusion":
      return (
        <div>
          <span id={`${pid}-text`} className="label">
            What the work concludes
          </span>
          <RichTextField
            labelId={`${pid}-text`}
            describedBy={`${pid}-text-issues`}
            value={s.text}
            onChange={(text) => patch<"conclusion">(s.id, (x) => ({ ...x, text }))}
            placeholder="e.g. A short walk gave a small rise in recall."
          />
          <FieldIssues id={`${pid}-text-issues`} issues={issuesAt(issues, `${p}.text`)} />
        </div>
      );
    case "pullquote":
      return (
        <TextInput
          id={`${pid}-text`}
          label="The pull quote"
          value={s.text}
          multiline
          onChange={(text) => patch<"pullquote">(s.id, (x) => ({ ...x, text }))}
          issues={issuesAt(issues, `${p}.text`)}
          placeholder="e.g. A ruling is only as strong as the next court that reads it."
        />
      );
    case "link":
      return (
        <div className="space-y-4">
          <TextInput
            id={`${pid}-href`}
            label={L.link.hrefOptional ? "Web address (optional)" : "Web address"}
            type="url"
            value={s.href}
            placeholder="https://"
            onChange={(href) => patch<"link">(s.id, (x) => ({ ...x, href: href.trim() }))}
            issues={issuesAt(issues, `${p}.href`)}
          />
          <div>
            <TextInput
              id={`${pid}-label`}
              label="What the link is"
              value={s.label}
              placeholder="e.g. Model code on GitHub"
              onChange={(label) => patch<"link">(s.id, (x) => ({ ...x, label }))}
              issues={issuesAt(issues, `${p}.label`)}
            />
            <p className="mt-1">
              <WordsOf n={words(s.label)} limit={L.link.labelWords} />
            </p>
          </div>
          <div>
            <TextInput
              id={`${pid}-description`}
              label="One line about it (optional)"
              value={s.description}
              placeholder="e.g. The notebook, with the cleaned data"
              onChange={(description) => patch<"link">(s.id, (x) => ({ ...x, description }))}
              issues={issuesAt(issues, `${p}.description`)}
            />
            <p className="mt-1">
              <WordsOf n={words(s.description)} limit={L.link.descriptionWords} />
            </p>
          </div>
        </div>
      );
    case "flow":
      return null;
  }
}

function FindingsFields({ s, p, patch, issues, dt, L }: { s: SectionOf<"findings">; p: string; patch: Patch; issues: Issue[]; dt: DraftTools; L: Limits }) {
  const set = (fn: (items: SectionOf<"findings">["items"]) => SectionOf<"findings">["items"]) => patch<"findings">(s.id, (x) => ({ ...x, items: fn(x.items) }));
  const swap = (i: number, j: number) => set((items) => moveSection(items, i, j));
  const { min, max, wordsEach } = L.findings;
  return (
    <>
      <BlockTools dt={dt} block="findings" />
      <ol className="space-y-4">
        {s.items.map((f, i) => (
          <li key={i}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span id={`finding-${i}`} className="label mb-0">
                Finding {i + 1}
              </span>
              <span className="flex items-center gap-1">
                <WordsOf n={words(plain(f))} limit={wordsEach} />
                <Button size="sm" label={`Move finding ${i + 1} up`} disabled={i === 0} onClick={() => swap(i, i - 1)}>
                  <ArrowUp aria-hidden size={14} strokeWidth={2.25} />
                </Button>
                <Button size="sm" label={`Move finding ${i + 1} down`} disabled={i === s.items.length - 1} onClick={() => swap(i, i + 1)}>
                  <ArrowDown aria-hidden size={14} strokeWidth={2.25} />
                </Button>
                <Button size="sm" label={`Remove finding ${i + 1}`} disabled={s.items.length <= min} onClick={() => set((items) => items.filter((_, j) => j !== i))}>
                  <X aria-hidden size={14} strokeWidth={2.25} />
                </Button>
              </span>
            </div>
            <RichTextField
              labelId={`finding-${i}`}
              describedBy={`finding-${i}-issues`}
              value={f}
              onChange={(v) => set((items) => items.map((x, j) => (j === i ? v : x)))}
              placeholder={i === 0 ? "e.g. Average wait fell from 11 to 4 minutes." : "e.g. Sales held steady, so the till paid for itself."}
            />
            <FieldIssues id={`finding-${i}-issues`} issues={issuesAt(issues, `${p}.items.${i}`)} />
          </li>
        ))}
      </ol>
      <FieldIssues id="findings-issues" issues={issuesAt(issues, `${p}.items`)} />
      <div className="mt-4">
        <Button size="sm" disabled={s.items.length >= max} onClick={() => set((items) => [...items, []])} label="Add a finding">
          <Plus aria-hidden size={14} strokeWidth={2.25} /> Add a finding
        </Button>
      </div>
    </>
  );
}

/* ---------------- Add a section ---------------- */

const ITEM = "flex w-full items-start gap-2.5 rounded-[10px] px-2.5 py-2 text-left text-ink hover:bg-mist disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-transparent";

function AddSection({ doc, onAdd, onAddImage, imageBusy }: { doc: ExhbtDoc; onAdd: (kind: Exclude<SectionKind, "image">) => void; onAddImage: () => void; imageBusy: boolean }) {
  const f = formatOf(doc);
  const menu = menuFor(f);
  const missing = layoutNotes(doc).missing;
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const total = wordCount(doc);
  const left = LIMITS.totalWords - total;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        document.getElementById("add-section")?.focus();
      }
    };
    const onPointer = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  return (
    <div ref={wrap}>
      {missing.length > 0 && (
        <div className="mb-4 rounded-[16px] border border-line bg-surface p-4" data-layout-todo>
          <p className="font-semibold">To finish this layout</p>
          <ul className="mt-2 space-y-2">
            {missing.map((m) => (
              <li key={m.text} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span>{m.text}</span>
                {m.add && (
                  <Button
                    size="sm"
                    label={`${m.text}: add`}
                    disabled={roomFor(doc.sections, m.add, f) === 0 || (m.add === "image" && imageBusy)}
                    onClick={() => (m.add === "image" ? onAddImage() : onAdd(m.add as Exclude<SectionKind, "image">))}
                  >
                    Add
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      <Button id="add-section" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((o) => !o)} label="Add a section">
        <Plus aria-hidden size={16} strokeWidth={2.25} /> Add a section
      </Button>
      {open && (
        <div id={panelId} className="mt-2 rounded-[16px] border border-line bg-surface p-3 shadow-pack">
          <p className={`px-2.5 text-sm ${left < 0 ? "font-semibold text-error" : "text-graphite"}`} data-testid="words-left">
            {left >= 0
              ? `${left} ${left === 1 ? "word" : "words"} left of ${LIMITS.totalWords}. Every word in a section counts.`
              : `${-left} ${left === -1 ? "word" : "words"} over the ${LIMITS.totalWords}-word limit. Trim something before you publish.`}
          </p>
          <ul className="mt-2 space-y-0.5">
            {menu.map(({ kind, add, icon: Icon, hint }) => {
              const room = roomFor(doc.sections, kind, f);
              const busy = kind === "image" && imageBusy;
              const hintId = `${panelId}-${kind}`;
              return (
                <li key={kind}>
                  <button
                    type="button"
                    className={ITEM}
                    aria-label={add}
                    aria-describedby={hintId}
                    disabled={room === 0 || busy}
                    onClick={() => {
                      setOpen(false);
                      if (kind === "image") onAddImage();
                      else onAdd(kind);
                    }}
                  >
                    <Icon aria-hidden size={16} strokeWidth={2.25} className="mt-0.5 shrink-0" />
                    <span>
                      <span className="block font-semibold">{add}</span>
                      <span id={hintId} className="block text-sm text-graphite">
                        {room === 0 ? fullReason(kind, f, doc.sections) : hint}
                        {room > 0 && formatLimits(f).sections[kind] > 1 && ` ${room} of ${formatLimits(f).sections[kind]} left.`}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
