"use client";

import type { ReactNode } from "react";
import { Toolbar } from "@astryxdesign/core/Toolbar";
import { SaveStatus } from "../ui/SaveStatus";
import { HEADING_ID, UndoButton } from "../ui/UndoButton";

/*
 * STUB (brief E, milestone 1). Brief G takes this file over: the editor's bar, with the chip, Look, See
 * as a visitor (`seeAsVisitor`), Job links, the menu, and "Claim your address" or "Share". It is already
 * what G builds on: Astryx's Toolbar (one row, one Tab stop, the arrow keys along it) in the bar's own
 * frame, which is exactly `--xe-topbar-h` tall and sticks to the top of the window (css/core.css), with
 * the heading and the two parts that are E's: Undo and the save status. `team` and `jobLinks` are the
 * server-drawn panels for G's Team sheet and Job links menu; nothing draws them yet.
 */
export function EditorBar(props: { team: ReactNode; jobLinks: ReactNode }): ReactNode {
  // Nothing draws the two panels yet: they are G's sheet and menu.
  void props;
  return (
    <div className="pe-bar" data-bar>
      <Toolbar
        label="Your portfolio"
        gap={2}
        startContent={
          <h1 id={HEADING_ID} tabIndex={-1} className="pe-bar-heading">
            Your portfolio
          </h1>
        }
        endContent={
          <>
            <UndoButton />
            <SaveStatus />
          </>
        }
      />
    </div>
  );
}
