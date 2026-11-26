"use client";

import { useRef, type ReactNode } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS as Dnd } from "@dnd-kit/utilities";
import { IconButton } from "@astryxdesign/core/IconButton";
import { ArrowDown, ArrowUp, EyeOff, GripVertical, Star, X } from "lucide-react";
import { usePhone } from "@/components/exhbt-editor/phone/usePhone";
import type { HomeSectionSlot } from "@/components/portfolio/home-ctx";
import type { SectionKey } from "@/lib/portfolio-layout";
import { ItemMore, type ItemAction } from "../phone/ItemMore";
import { usePortfolioApi, useRuntime } from "../runtime";
import { TileBoard } from "../tiles/TileBoard";
import { useArranged } from "../tiles/arranged";
import { hideTile, moveSection, removeSection, setStar } from "./arrange";
import { AddSection } from "./AddSection";
import { EASE, gripAttributes, MOVE_MS, useReducedMotion } from "./drag";
import { placeSection, useSpot } from "./place";
import { ToolRow } from "./ToolRow";
import { sectionName, W } from "./words";

/*
 * A section on the editing page in its frame (brief F, step 1): an outline, not a border, so nothing
 * moves; and its corner toolbar, drawn over the page and out of its flow (ToolRow.tsx, placed by
 * place.ts): the grip, Move up, Move down and Remove. In the band, the band's exhbt's own two (the star
 * and Hide) join it, so one corner holds one toolbar. On a phone, only the grip and one More button
 * (`ItemMore`, I's) with the same actions.
 *
 * It is one item of the sections' sortable list (ArrangeBoard.tsx). More of my work's frame also holds
 * the exhbts' own board (TileBoard.tsx). The last section's frame holds "Add a section".
 *
 * The adapter draws it inside a boundary that is not drawn again while its section's words and place
 * are the same, so what it must follow besides (the arrangement, a drag) it reads itself.
 */

/**
 * A section's place, as `HomeSectionSlot` gives it, with the section's key as `sectionKey`: `key` is
 * React's own word and never reaches a component, so a frame could not read it.
 */
export type SectionFrameProps = Omit<HomeSectionSlot, "key"> & { sectionKey: SectionKey; children: ReactNode };

/** After a move the frame's node is put back in the page, which drops the focus: it goes back to the same button. */
export function refocus(selector: string) {
  requestAnimationFrame(() => document.querySelector<HTMLElement>(selector)?.focus());
}

export function SectionFrame({ sectionKey, index, count, children }: SectionFrameProps): ReactNode {
  const api = usePortfolioApi();
  const rt = useRuntime();
  const phone = usePhone();
  const reduced = useReducedMotion();
  const arranged = useArranged();
  const frame = useRef<HTMLDivElement | null>(null);
  const body = useRef<HTMLDivElement | null>(null);
  const tools = useRef<HTMLDivElement | null>(null);
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: sectionKey,
    transition: reduced ? null : { duration: MOVE_MS, easing: EASE },
    attributes: { roleDescription: "draggable section" },
  });
  const spot = useSpot(frame, () => (frame.current && body.current && tools.current ? placeSection(frame.current, body.current, tools.current) : null), [sectionKey, index, count, phone]);

  const name = sectionName(sectionKey);
  const band = sectionKey === "featured" ? arranged.band : null;
  const bandTitle = band ? arranged.title(band) : "";
  const at = `[data-section-frame="${sectionKey}"]`;
  const first = index === 0;
  const last = index === count - 1;

  const move = (by: -1 | 1, act: string) => {
    const to = rt.state.get().arrangement.sections.indexOf(sectionKey) + by;
    api.change((s) => moveSection(s, sectionKey, to), W.moved(name));
    const n = rt.state.get().arrangement.sections.length;
    api.say(W.saidMoved(name, rt.state.get().arrangement.sections.indexOf(sectionKey) + 1, n));
    refocus(`${at} [data-act="${act}"]`);
  };
  const remove = () => {
    const list = rt.state.get().arrangement.sections;
    const i = list.indexOf(sectionKey);
    const next = list[i + 1] ?? list[i - 1];
    api.change((s) => removeSection(s, sectionKey), W.removed(name));
    api.say(W.saidRemoved(name));
    // The focus goes to the section that takes its place, or to "Add a section" when none is left.
    refocus(next ? `[data-section-frame="${next}"] [data-pe-tools] button` : '[data-path="arrangement.sections"] button');
  };
  const unstar = () => {
    if (!band) return;
    const on = rt.state.get().arrangement.featured !== band;
    api.change((s) => setStar(s, band, on), on ? W.starred(bandTitle) : W.unstarred(bandTitle));
    api.say(on ? W.saidStarred(bandTitle) : W.saidUnstarred(bandTitle));
  };
  const hideBand = () => {
    if (!band) return;
    api.change((s) => hideTile(s, band), W.hid(bandTitle));
    api.say(W.saidHid(bandTitle));
    refocus(`${at} [data-pe-tools] button`);
  };
  const starred = band != null && rt.state.get().arrangement.featured === band;

  const grip = (
    <IconButton
      ref={setActivatorNodeRef}
      {...gripAttributes(attributes)}
      {...listeners}
      data-act="grip"
      className="pe-grip"
      variant="ghost"
      label={W.grip(name)}
      tooltip={W.gripTip(name)}
      icon={<GripVertical aria-hidden size={18} strokeWidth={2} />}
    />
  );

  const actions: ItemAction[] = [
    { id: "up", label: W.sectionUp(name), off: first ? W.firstAlready(name) : undefined, run: () => move(-1, "up") },
    { id: "down", label: W.sectionDown(name), off: last ? W.lastAlready(name) : undefined, run: () => move(1, "down") },
    ...(band
      ? ([
          { id: starred ? "unstar" : "star", label: starred ? W.unstar(bandTitle) : W.star(bandTitle), run: unstar },
          { id: "hide", label: W.hide(bandTitle), run: hideBand },
          { id: "open", label: W.open(bandTitle), run: () => (window.location.href = `/exhbts/${band}/edit`) },
        ] as ItemAction[])
      : []),
    { id: "remove", label: W.sectionRemove(name), run: remove },
  ];

  return (
    <div
      ref={(el) => {
        frame.current = el;
        setNodeRef(el);
      }}
      className="pe-frame pe-sec"
      data-section-frame={sectionKey}
      data-dragging={isDragging ? "true" : undefined}
      style={{ transform: Dnd.Translate.toString(transform), transition: transition ?? undefined }}
    >
      {phone ? (
        <ToolRow ref={tools} spot={spot} kind="section" label={W.sectionTools(name)}>
          {grip}
          <ItemMore name={name} actions={actions} />
        </ToolRow>
      ) : (
        <ToolRow ref={tools} spot={spot} kind="section" label={W.sectionTools(name)}>
          {grip}
          <IconButton data-act="up" variant="ghost" label={W.sectionUp(name)} tooltip={first ? W.firstAlready(name) : W.sectionUp(name)} isDisabled={first} onClick={() => move(-1, "up")} icon={<ArrowUp aria-hidden size={16} strokeWidth={2} />} />
          <IconButton data-act="down" variant="ghost" label={W.sectionDown(name)} tooltip={last ? W.lastAlready(name) : W.sectionDown(name)} isDisabled={last} onClick={() => move(1, "down")} icon={<ArrowDown aria-hidden size={16} strokeWidth={2} />} />
          {band && (
            <>
              <IconButton
                data-act="star"
                variant="ghost"
                aria-pressed={starred}
                label={starred ? W.unstar(bandTitle) : W.star(bandTitle)}
                tooltip={starred ? W.unstar(bandTitle) : W.starTip}
                onClick={unstar}
                icon={<Star aria-hidden size={16} strokeWidth={2} fill={starred ? "currentColor" : "none"} />}
              />
              <IconButton data-act="hide" variant="ghost" label={W.hide(bandTitle)} tooltip={W.hideTip} onClick={hideBand} icon={<EyeOff aria-hidden size={16} strokeWidth={2} />} />
            </>
          )}
          <IconButton data-act="remove" variant="ghost" label={W.sectionRemove(name)} tooltip={W.sectionRemove(name)} onClick={remove} icon={<X aria-hidden size={16} strokeWidth={2.25} />} />
        </ToolRow>
      )}
      <div ref={body} className="pe-sec-body">
        {sectionKey === "work" ? <TileBoard>{children}</TileBoard> : children}
      </div>
      {last && <AddSection />}
    </div>
  );
}
