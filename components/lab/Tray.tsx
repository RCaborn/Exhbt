"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useDraggable } from "@dnd-kit/core";
import { blockOptions, type BlockKind, type BlockOption } from "./blocks";
import { useLab, useLabStore } from "./store";

/** What a tray block's drag is called, in front of its kind ("tray:quote"). */
export const TRAY_ID = "tray:";

/**
 * The tray: the blocks the page can take, in a rail beside it, to drag onto the page. On a
 * desktop only (from 77rem of window, with a mouse or trackpad); on anything narrower, and on a
 * touch screen, it isn't drawn and the "+" between sections is how blocks are added.
 *
 * Where it lives: fixed to the window, upright, in the margin to the right of the page's 64rem
 * frame, in the middle of the window's height. So it never covers the page, it is there however
 * far the page is scrolled, and it is clear of the top and bottom fifths of the window, where
 * carrying something scrolls the page. 77rem is the narrowest window with that much margin.
 *
 * Each block is a button. Dragged, it goes onto the page with the same feel as moving a section
 * (the board does that: components/lab/Board.tsx). Pressed (Enter, Space or a click), it is added
 * after the section the focus was last in, or at the end. A kind the layout has no room for can't
 * be dragged or added, and says why when it is pointed at or focused.
 *
 * Drawn inside the look's wrapper, not the page's column, so it takes the look's colours and is
 * placed against the window in every browser.
 */
export function Tray({ onAdd }: { onAdd: (kind: BlockKind) => void }) {
  const store = useLabStore();
  // Read so the tray is drawn again when a block is added, moved or taken off: what there is room for changes with it.
  useLab((d) => d.order);
  const anchor = useRef<HTMLSpanElement>(null);
  const [look, setLook] = useState<Element | null>(null);
  useEffect(() => setLook(anchor.current?.closest("[data-look]") ?? null), []);
  const options = blockOptions(store.get());
  return (
    <>
      <span ref={anchor} hidden />
      {look &&
        createPortal(
          <aside aria-label="Blocks to add" data-lab-tray className="lab-tray xp">
            <p className="lab-tray-title">Add a block</p>
            <ul className="lab-tray-list">
              {options.map((o) => (
                <TrayBlock key={o.kind} option={o} onAdd={onAdd} />
              ))}
            </ul>
            <p id="lab-tray-how" hidden>
              Press Enter to add it after the section you were last in, or at the end of the page. With a mouse, drag it onto the page.
            </p>
          </aside>,
          look,
        )}
    </>
  );
}

function TrayBlock({ option, onAdd }: { option: BlockOption; onAdd: (kind: BlockKind) => void }) {
  const { kind, name, icon: Icon, full } = option;
  const { setNodeRef, listeners, isDragging } = useDraggable({ id: `${TRAY_ID}${kind}`, disabled: Boolean(full) });
  const why = `lab-tray-why-${kind}`;
  return (
    <li className="lab-tray-item">
      <button
        type="button"
        ref={setNodeRef}
        {...listeners}
        data-tray-kind={kind}
        data-dragging={isDragging || undefined}
        // Kept focusable when there is no room, so the reason can be reached and read.
        aria-disabled={full ? true : undefined}
        aria-describedby={full ? why : "lab-tray-how"}
        onClick={() => onAdd(kind)}
        className="lab-tray-tile"
      >
        <Icon aria-hidden size={18} strokeWidth={2} />
        <span>{name}</span>
      </button>
      {full && (
        <span id={why} className="lab-tray-why">
          {full}
        </span>
      )}
    </li>
  );
}
