"use client";

import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { BottomSheet } from "@astryxdesign/core/BottomSheet";
import { Drawer, DrawerHeader } from "@astryxdesign/core/Drawer";
import { Heading } from "@astryxdesign/core/Heading";
import { Layout, LayoutContent, LayoutFooter } from "@astryxdesign/core/Layout";
import { Text } from "@astryxdesign/core/Text";

/** How long a closed sheet keeps its contents, so they are still there while it slides away. */
const KEEP_MS = 400;

const PHONE = "(pointer: coarse) and (max-width: 639px)";
function usePhone(): boolean {
  return useSyncExternalStore(
    (notify) => {
      const m = window.matchMedia(PHONE);
      m.addEventListener("change", notify);
      return () => m.removeEventListener("change", notify);
    },
    () => window.matchMedia(PHONE).matches,
    () => false,
  );
}

/**
 * A panel over the page, as the portfolio editor's own sheet is: an Astryx Drawer at the side on a wide window and
 * the full width under 640px. `kind="form"` cannot be lost by a stray press outside it. `kind="actions"` on a touch
 * phone is an Astryx BottomSheet that hugs its short list instead. `name` goes on the root as data-sheet, which the
 * tests select by. `presentation` forces one or the other, for a test.
 *
 * Titled; focus is trapped while it is open; Escape or its close button closes it and focus goes back to what opened
 * it. Contents are drawn only while it is open (and for a moment after, while it slides away).
 */
export function Sheet({
  name,
  title,
  subtitle,
  open,
  onOpenChange,
  kind = "info",
  footer,
  children,
  presentation,
}: {
  name: string;
  title: string;
  subtitle?: string;
  open: boolean;
  onOpenChange(open: boolean): void;
  kind?: "actions" | "form" | "info";
  footer?: ReactNode;
  children: ReactNode;
  presentation?: "drawer" | "bottom-sheet";
}): ReactNode {
  const phone = usePhone();
  const [kept, setKept] = useState(open);
  useEffect(() => {
    if (open) return setKept(true);
    const t = setTimeout(() => setKept(false), KEEP_MS);
    return () => clearTimeout(t);
  }, [open]);
  const drawn = open || kept;
  const purpose = kind === "form" ? "form" : "info";
  const bottom = presentation ? presentation === "bottom-sheet" : kind === "actions" && phone;

  if (bottom) {
    return (
      <BottomSheet isOpen={open} onOpenChange={onOpenChange} label={title} purpose={purpose} height="hug" padding={5}>
        <div data-sheet={name} className="flex flex-col gap-4">
          <div>
            <Heading level={2}>{title}</Heading>
            {subtitle && (
              <Text as="p" display="block" color="secondary">
                {subtitle}
              </Text>
            )}
          </div>
          {drawn && children}
          {drawn && footer}
        </div>
      </BottomSheet>
    );
  }
  return (
    <Drawer isOpen={open} onOpenChange={onOpenChange} label={title} purpose={purpose} experimental={{ isFullWidthOnMobile: true }} data-sheet={name}>
      <Layout
        header={<DrawerHeader title={title} subtitle={subtitle} onOpenChange={onOpenChange} />}
        content={<LayoutContent>{drawn && children}</LayoutContent>}
        footer={drawn && footer ? <LayoutFooter>{footer}</LayoutFooter> : undefined}
      />
    </Drawer>
  );
}
