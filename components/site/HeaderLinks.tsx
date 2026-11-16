"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** The header's row of links. The page you're on is marked: aria-current for screen readers, an ink underline for everyone else. */
export function HeaderLinks({ items }: { items: { href: string; label: string }[] }) {
  const pathname = usePathname();
  return (
    <ul className="flex gap-7 text-[0.95rem] font-medium text-graphite">
      {items.map((n) => {
        const current = pathname === n.href || pathname.startsWith(`${n.href}/`);
        return (
          <li key={n.href} className="shrink-0">
            <Link
              href={n.href}
              aria-current={current ? "page" : undefined}
              className={current ? "text-ink underline decoration-jade decoration-2 underline-offset-8" : "hover:text-ink"}
            >
              {n.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
