"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Drawer, DrawerHeader } from "@astryxdesign/core/Drawer";
import { Layout, LayoutContent, LayoutFooter } from "@astryxdesign/core/Layout";
import { usePortfolioApi, usePortfolioUi, type PortfolioSheet } from "../runtime";

/** How long a closed sheet keeps its contents, so they are still there while it slides away. */
const KEEP_MS = 400;

/**
 * A sheet of the portfolio editor (decision 0031, "The bar": the photo, the address, Job links, Team,
 * and on a phone a section's or a tile's More): Astryx's Drawer, opened by `open(name)` and closed by
 * `close()`. At the side on a desktop; under 640px it covers the screen, so a phone's sheet is the whole
 * screen. Titled; the focus is trapped while it is open; Escape, its close button or a press outside it
 * closes it, and the Drawer gives the focus back to what had it as the sheet opened. That is the opener:
 * whatever opens a sheet passes itself to `open(name, trigger)` (for a choice in the bar's menu, the
 * menu's button), which gives it the focus first when it lacks it, as a pressed button does everywhere
 * but Safari (runtime-core.ts, takeFocus). Opened with no trigger (a field's "Show me", the address's
 * ?open=), it gives the focus back to whatever had it. When the focus is lost all the same (a choice in
 * the bar's menu under a finger), the runtime gives it to the opener once the dialog has closed
 * (runtime-core.ts, sheetClosed). Its contents are drawn only while it is open
 * (and for a moment after, while it slides away).
 *
 * `purpose="form"` for a sheet holding a form a stray press outside must not lose (the address);
 * `footer` for a sheet's own actions, pinned while its contents scroll. `when` for a name that several
 * parts on the page share: every section and tile draws a sheet named "item", and only the one whose
 * More was pressed is to open. App chrome, in the app's own style: nothing here is hand-built.
 */
export function Sheet({
  name,
  when = true,
  title,
  subtitle,
  purpose = "info",
  width,
  footer,
  children,
}: {
  name: PortfolioSheet;
  /** For a name several parts share (each section's and each tile's "item"): whether this one is the one meant. */
  when?: boolean;
  title: string;
  subtitle?: string;
  purpose?: "info" | "form";
  width?: number | string;
  footer?: ReactNode;
  children: ReactNode;
}): ReactNode {
  const open = usePortfolioUi((u) => u.sheet === name) && when;
  const api = usePortfolioApi();
  const [kept, setKept] = useState(open);
  useEffect(() => {
    if (open) return setKept(true);
    const t = setTimeout(() => setKept(false), KEEP_MS);
    return () => clearTimeout(t);
  }, [open]);
  // Astryx asks to close (Escape, the scrim, the header's button): only the open sheet closes the view.
  const onOpenChange = (next: boolean) => {
    if (!next && open) api.close();
  };
  // Its dialog's close, once the slide-out is over and the Drawer has given the focus back: the runtime sees that the
  // focus landed somewhere (runtime-core.ts, sheetClosed).
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    const closed = () => api.sheetClosed(name, d);
    d.addEventListener("close", closed);
    return () => d.removeEventListener("close", closed);
  }, [api, name]);
  const drawn = open || kept;
  return (
    <Drawer ref={dialog} isOpen={open} onOpenChange={onOpenChange} label={title} purpose={purpose} width={width} experimental={{ isFullWidthOnMobile: true }} data-sheet={name}>
      <Layout
        header={<DrawerHeader title={title} subtitle={subtitle} onOpenChange={onOpenChange} />}
        content={<LayoutContent>{drawn && children}</LayoutContent>}
        footer={drawn && footer ? <LayoutFooter>{footer}</LayoutFooter> : undefined}
      />
    </Drawer>
  );
}
