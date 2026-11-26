"use client";

import "../css/phone.css";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { IconButton } from "@astryxdesign/core/IconButton";
import {
  ArrowDown,
  ArrowUp,
  Eye,
  EyeOff,
  MoreHorizontal,
  SquareArrowOutUpRight,
  Star,
  StarOff,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { usePortfolioApi, usePortfolioUi } from "../runtime";
import { Sheet } from "../ui/Sheet";
import { useOfferUndo } from "./PhoneUndo";

/*
 * On a phone, a section's or a tile's one 44px "More" button in place of its toolbar (decision 0031,
 * "On a phone"; brief I, step 1): F's frames draw it beside the grip where `usePhone()` is true. It opens
 * a sheet (E's `Sheet`, named "item", the whole screen on a phone) of the actions the frame gives it, in
 * their order, each a 44px row with its name. An action that is `off` stays in the list, dimmed, with its
 * reason under its name and read out with it (aria-disabled, so it keeps the focus and is not skipped).
 *
 * After an action the sheet closes and the focus goes back to this button; after Remove or Hide, whose
 * part has gone from the page, to the More of the part that took its place. The frame's action says
 * what happened in the live region; a move, a remove or a hide also offers a one-tap Undo
 * (PhoneUndo.tsx), since under 48rem the bar keeps its Undo in the menu.
 */

export type ItemAction = {
  id: "up" | "down" | "remove" | "star" | "unstar" | "hide" | "show" | "open";
  label: string;
  /** Why it is off, read out and shown. */ off?: string;
  run(): void;
};

/** The words the button and the sheet draw. */
export const MORE = {
  button: (name: string) => `More for ${name}`,
  title: (name: string) => name,
  subtitle: "Choose what to do with it.",
};

const ICON: Record<ItemAction["id"], typeof ArrowUp> = {
  up: ArrowUp,
  down: ArrowDown,
  remove: X,
  star: Star,
  unstar: StarOff,
  hide: EyeOff,
  show: Eye,
  open: SquareArrowOutUpRight,
};

/** The actions that take their part off the page: the focus then goes to the next part's More. */
const GOES: ReadonlySet<ItemAction["id"]> = new Set(["remove", "hide"]);
/** The actions a phone's one-tap Undo is offered after. */
const UNDOABLE: ReadonlySet<ItemAction["id"]> = new Set([
  "up",
  "down",
  "remove",
  "hide",
  "star",
  "unstar",
]);

/** The frame this More is in (a section's or a tile's), its kind's selector, and the one after or before it. */
function nextMore(
  button: HTMLElement | null,
): (() => HTMLElement | null) | null {
  const own = button?.closest<HTMLElement>(
    "[data-section-frame], [data-tile-frame]",
  );
  if (!own) return null;
  const sel = own.hasAttribute("data-section-frame")
    ? "[data-section-frame]"
    : "[data-tile-frame]";
  const all = [...document.querySelectorAll<HTMLElement>(sel)].filter((f) =>
    f.querySelector('[data-act="more"]'),
  );
  const i = all.indexOf(own);
  const after = all.slice(i + 1).map(keyOf);
  const before = all.slice(0, i).reverse().map(keyOf);
  const find = (k: string) =>
    document.querySelector<HTMLElement>(`${k} [data-act="more"]`);
  return () => {
    for (const k of [...after, ...before]) {
      const b = find(k);
      if (b) return b;
    }
    return null;
  };
}

const esc = (s: string) => globalThis.CSS?.escape?.(s) ?? s;
const keyOf = (f: HTMLElement) =>
  f.hasAttribute("data-section-frame")
    ? `[data-section-frame="${esc(f.getAttribute("data-section-frame")!)}"]`
    : `[data-tile-frame="${esc(f.getAttribute("data-tile-frame")!)}"]`;

/** After the sheet's own focus return and the frame's (each a frame later): the focus where it belongs. */
function afterAll(fn: () => void) {
  requestAnimationFrame(() =>
    requestAnimationFrame(() => requestAnimationFrame(fn)),
  );
}

export function ItemMore({
  name,
  actions,
}: {
  name: string;
  actions: ItemAction[];
}): ReactNode {
  const api = usePortfolioApi();
  const button = useRef<HTMLButtonElement | null>(null);
  // Every section and tile draws a sheet named "item": this one opens only when its own More was pressed.
  const [mine, setMine] = useState(false);
  const open = usePortfolioUi((u) => u.sheet === "item");
  // Closed from anywhere (Escape, the scrim, its close button): it is no longer this one's.
  useEffect(() => {
    if (!open) setMine(false);
  }, [open]);
  // The sheet is drawn at the editor's root, not in the frame: a move puts the frame's node back in the
  // page, and a dialog moved while it closes stays on the screen, empty.
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setHost(
      button.current?.closest<HTMLElement>('[data-editor="portfolio"]') ??
        document.body,
    );
  }, []);
  const id = useId();
  const offerUndo = useOfferUndo();

  const act = (a: ItemAction) => {
    if (a.off) return api.say(a.off);
    // Worked out before the part goes: its frame is still on the page now.
    const next = GOES.has(a.id) ? nextMore(button.current) : null;
    const own = button.current?.closest<HTMLElement>(
      "[data-section-frame], [data-tile-frame]",
    );
    const ownKey = own ? keyOf(own) : null;
    setMine(false);
    api.close();
    a.run();
    if (UNDOABLE.has(a.id)) offerUndo();
    if (a.id === "open") return;
    afterAll(() => {
      const target = next
        ? next()
        : ownKey
          ? document.querySelector<HTMLElement>(`${ownKey} [data-act="more"]`)
          : button.current;
      (target ?? button.current)?.focus({ preventScroll: false });
    });
  };

  return (
    <>
      <IconButton
        ref={button}
        data-act="more"
        className="pe-more"
        variant="ghost"
        label={MORE.button(name)}
        aria-haspopup="dialog"
        aria-expanded={mine && open}
        onClick={() => {
          setMine(true);
          api.open("item");
        }}
        icon={<MoreHorizontal aria-hidden size={18} strokeWidth={2} />}
      />
      {host &&
        createPortal(
          <Sheet
            name="item"
            when={mine}
            title={MORE.title(name)}
            subtitle={MORE.subtitle}
          >
            <ul
              className="pe-item-actions"
              aria-label={MORE.button(name)}
              data-item-actions
            >
              {actions.map((a) => {
                const Icon = ICON[a.id];
                const why = a.off ? `${id}-${a.id}-why` : undefined;
                return (
                  <li
                    key={a.id}
                    data-action={a.id}
                    data-off={a.off ? "true" : undefined}
                  >
                    <Button
                      size="md"
                      className="pe-item-action"
                      label={a.label}
                      aria-describedby={why}
                      // Off, but still a stop for Tab and a screen reader, which reads its reason with its name.
                      {...(a.off
                        ? ({ "aria-disabled": true, tabIndex: 0 } as object)
                        : {})}
                      onClick={() => act(a)}
                    >
                      <Icon
                        aria-hidden
                        size={18}
                        strokeWidth={2}
                        className="shrink-0"
                      />
                      <span className="pe-item-action-words">
                        <span>{a.label}</span>
                        {a.off && (
                          <span id={why} className="pe-item-action-why">
                            {a.off}
                          </span>
                        )}
                      </span>
                    </Button>
                  </li>
                );
              })}
            </ul>
          </Sheet>,
          host,
        )}
    </>
  );
}
