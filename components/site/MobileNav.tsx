"use client";

import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { Menu } from "lucide-react";
import { Divider } from "@astryxdesign/core/Divider";
import { MobileNav as AstryxMobileNav } from "@astryxdesign/core/MobileNav";
import { TopNavItem, TopNavRenderContext } from "@astryxdesign/core/TopNav";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/Button";
import { isCurrent } from "./HeaderLinks";

/**
 * The header links on narrow screens: one "Menu" button that opens Astryx's MobileNav, a drawer from the
 * side of the screen. The drawer is a modal dialog holding a navigation named "Main menu": the same links
 * as the row, drawn as Astryx draws a TopNav's own drawer, then the calls to action. Opening it moves focus
 * to the first link; Escape, the close button, a press outside and following a link close it, and focus
 * goes back to the Menu button (MobileNav does that itself). Wider screens show the row (SiteHeader).
 *
 * The button is in the server's HTML and is hidden by CSS above `breakpoint`, so a phone never sees the
 * laptop row first. The drawer is drawn outside any AppShell, so this component holds its open state.
 */
export function MobileNav({
  items,
  actions = [],
  breakpoint = "sm",
}: {
  items: { href: string; label: string }[];
  /** The calls to action, shown as buttons under the links. */
  actions?: { href: string; label: string; variant: "primary" | "secondary" }[];
  /** Where the header switches to its row of links: `sm` (640px) or `lg` (1024px). */
  breakpoint?: "sm" | "lg";
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const drawer = useRef<HTMLDialogElement>(null);
  const pathname = usePathname();

  // A new page closes the drawer.
  useEffect(() => setOpen(false), [pathname]);

  // Opening moves focus to the first link, so a keyboard or screen-reader user lands on the links
  // (MobileNav itself focuses the drawer's panel).
  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => drawer.current?.querySelector<HTMLElement>("nav a")?.focus());
    return () => cancelAnimationFrame(frame);
  }, [open]);

  return (
    <div className={breakpoint === "lg" ? "lg:hidden" : "sm:hidden"}>
      <Button aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)} label="Menu">
        <Menu aria-hidden size={16} strokeWidth={2.25} />
        Menu
      </Button>
      <AstryxMobileNav
        ref={drawer}
        id={id}
        isOpen={open}
        onOpenChange={setOpen}
        label="Main menu"
        side="end"
        header={<Logo />}
      >
        <TopNavRenderContext value="drawer">
          {items.map((n) => (
            <TopNavItem
              key={n.href}
              href={n.href}
              label={n.label}
              isSelected={isCurrent(pathname, n.href)}
              onClick={() => setOpen(false)}
            />
          ))}
        </TopNavRenderContext>
        {actions.length > 0 && <Divider />}
        {actions.length > 0 && (
          <div className="site-drawer-actions">
            {actions.map((a) => (
              <Button key={a.href} href={a.href} variant={a.variant} size="lg">
                {a.label}
              </Button>
            ))}
          </div>
        )}
      </AstryxMobileNav>
    </div>
  );
}
