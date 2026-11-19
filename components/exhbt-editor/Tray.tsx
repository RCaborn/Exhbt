"use client";

import "./css/drag.css";
import type { ReactNode } from "react";
import { blockOptions, type BlockOption } from "@/lib/exhbt/layouts";
import { useEngine } from "./drag/Board";
import { BlockIcon, fullLine, wordsLeft } from "./drag/blocks";
import { useDoc, useStoreInternal } from "./store";

/*
 * The tray (decision 0026, "The tray"): the blocks the page can take, in a rail beside it, to drag
 * onto it. On a desktop only: from a 77rem window with a mouse or trackpad (css/drag.css); anywhere
 * else it is not drawn and the "+" is the way to add.
 *
 * It is fixed to the window, upright, in the margin right of the page's frame, in the middle of the
 * window's height: never over the page, there however far the page is scrolled, and clear of the
 * top and bottom fifths, where carrying something scrolls the page. Drawn inside the look's wrapper,
 * so it takes the look's colours.
 *
 * Each block is a button. Dragged, it has no place until it is over the page, then it is placed by
 * the same plan as a moved section (drag/engine.ts) and lands where it is dropped, the flowchart's
 * block included. Pressed (Enter, Space or a click), it is added after the section the focus was
 * last in, or at the end, and the focus stays here. A kind the layout has no room for can't be
 * dragged or added, and says why when it is pointed at or focused.
 */

const TRAY_HOW = "xe-tray-how";

export function Tray(): ReactNode {
  const store = useStoreInternal();
  // Drawn again when what there is room for, or the words left, could change.
  useDoc((d) => d.sections);
  useDoc((d) => d.flowOff);
  useDoc((d) => d.format);
  const words = useDoc((d) => wordsLeft(d).text);
  const over = useDoc((d) => wordsLeft(d).over);
  const doc = store.get();
  const options = blockOptions(doc);
  const full = fullLine(doc, options);
  return (
    <aside aria-label="Blocks to add" data-xe-tray data-edit-only className="xe-tray">
      <p className="xe-tray-title">Add a block</p>
      {full && <p className="xe-tray-note">{full}</p>}
      <p className="xe-tray-note" data-testid="tray-words-left" data-over={over || undefined}>
        {words}
      </p>
      <ul className="xe-tray-list">
        {options.map((o) => (
          <TrayBlock key={o.kind} option={o} />
        ))}
      </ul>
      <p id={TRAY_HOW} hidden>
        Press Enter to add it after the section you were last in, or at the end of the page. With a mouse, drag it onto the page.
      </p>
    </aside>
  );
}

function TrayBlock({ option }: { option: BlockOption }) {
  const engine = useEngine();
  const { kind, name, full } = option;
  const why = `xe-tray-why-${kind}`;
  return (
    <li className="xe-tray-item">
      <button
        type="button"
        className="xe-tray-block"
        data-kind={kind}
        // Kept focusable when there is no room, so the reason can be reached and read.
        aria-disabled={full ? true : undefined}
        aria-describedby={full ? why : TRAY_HOW}
        onMouseDown={(e) => {
          if (!full) engine.senseNew(kind, e.nativeEvent, e.currentTarget);
        }}
        onClick={() => engine.addFromTray(kind)}
      >
        <BlockIcon kind={kind} size={16} />
        <span>{name}</span>
      </button>
      {full && (
        <span id={why} className="xe-tray-why">
          {full}
        </span>
      )}
    </li>
  );
}
