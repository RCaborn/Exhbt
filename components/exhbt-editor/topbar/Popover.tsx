"use client";

import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore, type ReactNode } from "react";

/*
 * What the top bar's panels share: a button that opens a panel under it (the layout menu, "Things to fix",
 * the menu). The focus goes into the panel when it opens and back to the button when it closes with Escape
 * or the button; a click or the Tab key leaving it closes it without taking the focus back, so it never
 * pulls the cursor away from what the person went to. Under 48rem the panel is as wide as the screen
 * (css/topbar.css). `inline` draws it in the flow instead, for a panel inside another (the layout menu
 * inside the menu on a phone).
 */

const NARROW = "(max-width: 47.99rem)";
const subscribeNarrow = (fn: () => void) => {
  const m = window.matchMedia(NARROW);
  m.addEventListener("change", fn);
  return () => m.removeEventListener("change", fn);
};

/** True under 48rem, where the bar keeps only its short row and the rest is in the menu. */
export function useNarrow(): boolean {
  return useSyncExternalStore(
    subscribeNarrow,
    () => window.matchMedia(NARROW).matches,
    () => false,
  );
}

export type PopoverApi = { close(restoreFocus?: boolean): void };

export function Popover({
  trigger,
  children,
  focusIn,
  className = "",
  panelClassName = "",
  inline = false,
  region,
}: {
  trigger: (p: { id: string; open: boolean; toggle(): void; panelId: string }) => ReactNode;
  children: (api: PopoverApi) => ReactNode;
  /** Where the focus goes when the panel opens; the panel itself by default. */
  focusIn?: (panel: HTMLElement) => HTMLElement | null | undefined;
  className?: string;
  panelClassName?: string;
  inline?: boolean;
  /** Makes the panel a landmark region with this name. */
  region?: string;
}): ReactNode {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const id = useId();
  const panelId = `${id}-panel`;

  const close = useCallback(
    (restoreFocus = false) => {
      setOpen(false);
      if (restoreFocus) document.getElementById(id)?.focus();
    },
    [id],
  );

  useEffect(() => {
    if (!open) return;
    const p = panel.current;
    if (p) (focusIn?.(p) ?? p).focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      e.preventDefault();
      close(true);
    };
    const onPointer = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) close();
    };
    const onFocus = (e: FocusEvent) => {
      if (!root.current?.contains(e.target as Node)) close();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("focusin", onFocus);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("focusin", onFocus);
    };
    // focusIn is read once, when the panel opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, close]);

  return (
    <div ref={root} className={`xe-pop ${inline ? "xe-pop-inline" : ""} ${className}`.trim()}>
      {trigger({ id, open, toggle: () => (open ? close(true) : setOpen(true)), panelId })}
      {open && (
        <div ref={panel} id={panelId} tabIndex={-1} {...(region ? { role: "region", "aria-label": region } : {})} className={`xe-pop-panel ${panelClassName}`.trim()}>
          {children({ close })}
        </div>
      )}
    </div>
  );
}
