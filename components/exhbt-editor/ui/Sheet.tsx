"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { useRuntime, useUiState, type SheetName } from "../context";

/*
 * A sheet (decision 0026, "Accessibility"): a native <dialog>, opened by `ui.open(name)`, at the side
 * on a desktop and filling the screen under 48rem (css/core.css). Titled; the focus is trapped while
 * it is open; Escape closes it; the focus goes back to what opened it. Its contents are drawn only
 * while it is open. App chrome, in the app's own style.
 */
export function Sheet({ name, title, returnTo, children }: { name: SheetName; title: string; /** Where the focus goes on closing, tried before the opener (a graph just added: its "Edit figures"). */ returnTo?: () => HTMLElement | null; children: ReactNode }) {
  const open = useUiState((s) => s.sheet?.name === name);
  const { ui, uiApi } = useRuntime();
  const ref = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      d.showModal();
    } else if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="xe-sheet"
      data-sheet={name}
      aria-labelledby={titleId}
      // The dialog's `close` arrives a moment after it shuts. By then another sheet may be open: one opened from
      // this one ("Show me", a jump). Only a sheet that is still the open one closes the view, and the focus goes
      // back to what opened it only when no sheet is open now.
      onClose={(e) => {
        if (ui.get().sheet?.name === name) uiApi.close();
        const from = opener.current;
        const back = returnTo?.() ?? from;
        opener.current = null;
        // Nor when the person (or a jump) has put the focus somewhere since the dialog shut.
        const a = document.activeElement;
        const unmoved = !a || a === document.body || a === from || e.currentTarget.contains(a);
        if (!ui.get().sheet && unmoved && back?.isConnected) back.focus();
      }}
    >
      <div className="xe-sheet-head">
        <h2 id={titleId} className="text-[1.25rem]">
          {title}
        </h2>
        <button type="button" className="xe-sheet-close" aria-label="Close" onClick={() => ref.current?.close()}>
          <X aria-hidden size={18} strokeWidth={2.25} />
        </button>
      </div>
      <div className="xe-sheet-body">{open && children}</div>
    </dialog>
  );
}
