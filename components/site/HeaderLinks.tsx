"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** The header's row of links. The page you're on is marked: aria-current for screen readers, an ink underline for everyone else. `middle` sits between the two halves, so a button can be the centre of the row. */
export function HeaderLinks({ items, middle }: { items: { href: string; label: string }[]; middle?: React.ReactNode }) {
  const pathname = usePathname();
  const split = Math.ceil(items.length / 2);
  const halves = [items.slice(0, split), items.slice(split)];
  const link = (n: { href: string; label: string }) => {
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
  };
  return (
    <ul className="flex items-center gap-7 text-[0.95rem] font-medium text-graphite">
      {halves[0].map(link)}
      {middle ? <li className="shrink-0">{middle}</li> : null}
      {halves[1].map(link)}
    </ul>
  );
}
