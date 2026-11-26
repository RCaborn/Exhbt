"use client";

import { useRef, type ReactNode } from "react";
import Link from "next/link";
import { useSortable } from "@dnd-kit/sortable";
import { CSS as Dnd } from "@dnd-kit/utilities";
import { DropdownMenu } from "@astryxdesign/core/DropdownMenu";
import { IconButton } from "@astryxdesign/core/IconButton";
import { EyeOff, GripVertical, MoreHorizontal, Star } from "lucide-react";
import { usePhone } from "@/components/exhbt-editor/phone/usePhone";
import type { HomeTileSlot } from "@/components/portfolio/home-ctx";
import { ItemMore, type ItemAction } from "../phone/ItemMore";
import { usePortfolioApi } from "../runtime";
import { hideTile, moveTile, setStar } from "../sections/arrange";
import { EASE, gripAttributes, MOVE_MS, useReducedMotion } from "../sections/drag";
import { placeTile, useSpot } from "../sections/place";
import { refocus } from "../sections/SectionFrame";
import { ToolRow } from "../sections/ToolRow";
import { W } from "../sections/words";
import { useArranged } from "./arranged";
import { useTileNodes } from "./TileBoard";

/*
 * An exhbt on the editing page (brief F, step 4). The whole card or row opens the exhbt in its editor
 * (a link laid over it, so the toolbar beside it stays its own control); over its corner, the owner's
 * controls: the star (it goes in the band), Hide, the grip, and More with Move up and Move down. On
 * Free, where nothing can be published, a "Draft" chip over its top edge says only its owner sees it;
 * it is still arranged (the server's rule).
 *
 * In the band, the exhbt is not dragged (the band is not a drop target) and its star and Hide are on the
 * band's own section toolbar (SectionFrame.tsx), so the corner holds one toolbar.
 *
 * The page puts it inside the card's <li>, and the card is `h-full`: the frame passes the height through.
 */
export function TileFrame(props: HomeTileSlot & { children: ReactNode }): ReactNode {
  return props.where === "band" ? <BandTile {...props} /> : <WorkTile {...props} />;
}

function DraftChip(): ReactNode {
  return (
    <span className="pe-chip" data-pe-chip="draft" title={W.draftTip}>
      {W.draft}
    </span>
  );
}

function BandTile({ id, children }: HomeTileSlot & { children: ReactNode }): ReactNode {
  const arranged = useArranged();
  const title = arranged.title(id);
  return (
    <div className="pe-tile pe-tile-band" data-tile-frame={id}>
      {children}
      <Link href={`/exhbts/${id}/edit`} className="pe-open" aria-label={W.open(title)} data-pe-open />
      {!arranged.live(id) && <DraftChip />}
    </div>
  );
}

function WorkTile({ id, where, index, count, children }: HomeTileSlot & { children: ReactNode }): ReactNode {
  const api = usePortfolioApi();
  const phone = usePhone();
  const reduced = useReducedMotion();
  const arranged = useArranged();
  const nodes = useTileNodes();
  nodes?.set(id, children);
  const frame = useRef<HTMLDivElement | null>(null);
  const tools = useRef<HTMLDivElement | null>(null);
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id,
    transition: reduced ? null : { duration: MOVE_MS, easing: EASE },
    attributes: { roleDescription: "draggable exhbt" },
  });
  const spot = useSpot(
    frame,
    () => {
      const el = frame.current;
      const t = tools.current;
      if (!el || !t) return null;
      const list = el.closest("ul, ol");
      const wrap = el.closest("[data-section]") ?? list;
      const box = wrap?.getBoundingClientRect() ?? new DOMRect(0, 0, window.innerWidth, window.innerHeight);
      const pad = wrap ? parseFloat(getComputedStyle(wrap).paddingRight) || 0 : 0;
      const bounds = new DOMRect(box.left, box.top, box.width - pad, box.height);
      const neighbours = list ? [...list.children].filter((li) => !li.contains(el)) : [];
      return placeTile(el, t, bounds, neighbours);
    },
    [id, index, count, phone, where],
  );

  const title = arranged.title(id);
  const at = `[data-tile-frame="${CSS_ESCAPE(id)}"]`;
  const first = index === 0;
  const last = index === count - 1;

  const move = (by: -1 | 1) => {
    const { work, known } = arranged;
    const to = work.indexOf(id) + by;
    api.change((s) => moveTile(s, work, known, id, to), W.movedTile(title));
    api.say(W.saidMoved(title, to + 1, work.length));
    refocus(`${at} [data-act="more"]`);
  };
  const star = () => {
    api.change((s) => setStar(s, id, true), W.starred(title));
    api.say(W.saidStarred(title));
    refocus(`[data-section-frame="featured"] [data-act="star"]`);
  };
  const hide = () => {
    const { work } = arranged;
    const next = work[work.indexOf(id) + 1] ?? work[work.indexOf(id) - 1];
    api.change((s) => hideTile(s, id), W.hid(title));
    api.say(W.saidHid(title));
    refocus(next ? `[data-tile-frame="${CSS_ESCAPE(next)}"] [data-pe-tools] button` : `[data-hidden-row] [data-show="${CSS_ESCAPE(id)}"]`);
  };

  const grip = (
    <IconButton
      ref={setActivatorNodeRef}
      {...gripAttributes(attributes)}
      {...listeners}
      data-act="grip"
      className="pe-grip"
      variant="ghost"
      label={W.grip(title)}
      tooltip={W.gripTip(title)}
      icon={<GripVertical aria-hidden size={18} strokeWidth={2} />}
    />
  );

  const actions: ItemAction[] = [
    { id: "open", label: W.open(title), run: () => (window.location.href = `/exhbts/${id}/edit`) },
    { id: "star", label: W.star(title), run: star },
    { id: "hide", label: W.hide(title), run: hide },
    { id: "up", label: W.tileUp, off: first ? W.tileFirst : undefined, run: () => move(-1) },
    { id: "down", label: W.tileDown, off: last ? W.tileLast : undefined, run: () => move(1) },
  ];

  return (
    <div
      ref={(el) => {
        frame.current = el;
        setNodeRef(el);
      }}
      className={`pe-frame pe-tile pe-tile-${where}`}
      data-tile-frame={id}
      data-dragging={isDragging ? "true" : undefined}
      style={{ transform: Dnd.Translate.toString(transform), transition: transition ?? undefined }}
    >
      {children}
      <Link href={`/exhbts/${id}/edit`} className="pe-open" aria-label={W.open(title)} data-pe-open />
      {!arranged.live(id) && <DraftChip />}
      <ToolRow ref={tools} spot={spot} kind="tile" label={W.tileTools(title)}>
        {phone ? (
          <>
            {grip}
            <ItemMore name={title} actions={actions} />
          </>
        ) : (
          <>
            <IconButton data-act="star" variant="ghost" aria-pressed={false} label={W.star(title)} tooltip={W.starTip} onClick={star} icon={<Star aria-hidden size={16} strokeWidth={2} />} />
            <IconButton data-act="hide" variant="ghost" label={W.hide(title)} tooltip={W.hideTip} onClick={hide} icon={<EyeOff aria-hidden size={16} strokeWidth={2} />} />
            {grip}
            <DropdownMenu
              hasChevron={false}
              alignment="end"
              items={[
                { id: "up", label: W.tileUp, description: first ? W.tileFirst : undefined, isDisabled: first, onClick: () => move(-1) },
                { id: "down", label: W.tileDown, description: last ? W.tileLast : undefined, isDisabled: last, onClick: () => move(1) },
              ]}
              renderTrigger={(p) => <IconButton {...p} data-act="more" variant="ghost" label={W.tileMore(title)} tooltip={W.tileMore(title)} icon={<MoreHorizontal aria-hidden size={16} strokeWidth={2} />} />}
            />
          </>
        )}
      </ToolRow>
    </div>
  );
}

const CSS_ESCAPE = (s: string) => globalThis.CSS?.escape?.(s) ?? s;
