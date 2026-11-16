"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { Menu, X } from "lucide-react";

/**
 * The header links on phones (below `sm`): one "Menu" button that opens a panel under the header.
 * A disclosure, not an ARIA menu: the button has aria-expanded and aria-controls, the panel is a
 * list of links, Escape or a click outside closes it and puts focus back on the button, and so
 * does following a link. Wider screens show the links in a row (SiteHeader).
 */
export function MobileNav({ items }: { items: { href: string; label: string }[] }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  // A new page closes the panel.
  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    const onPointer = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!panel.current?.contains(t) && !button.current?.contains(t)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  return (
    <div className="sm:hidden">
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => {
          const next = !open;
          setOpen(next);
          // Move into the panel when it opens, so a keyboard or screen-reader user lands on the links.
          if (next) requestAnimationFrame(() => panel.current?.querySelector("a")?.focus());
        }}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-ink bg-surface px-4 text-[0.95rem] font-semibold text-ink"
      >
        {open ? <X aria-hidden size={16} strokeWidth={2.25} /> : <Menu aria-hidden size={16} strokeWidth={2.25} />}
        Menu
      </button>
      <div
        ref={panel}
        id={id}
        hidden={!open}
        className="absolute inset-x-0 top-full z-20 border-b border-line bg-surface px-4 pb-3 shadow-pack"
      >
        <nav aria-label="Main menu">
          <ul>
            {items.map((n) => (
              <li key={n.href} className="border-t border-line first:border-t-0">
                <Link href={n.href} onClick={() => setOpen(false)} className="block py-3 text-[1rem] font-medium text-ink">
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </div>
  );
}
