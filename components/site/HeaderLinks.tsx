"use client";

import { usePathname } from "next/navigation";
import { TopNavItem } from "@astryxdesign/core/TopNav";

/** The page you are on: its own address, or any page under it. */
export function isCurrent(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * The header's row of links, the "Main" navigation, as Astryx TopNavItems. The page you're on is marked:
 * aria-current for screen readers (TopNavItem's isSelected), and the theme's jade underline for everyone else.
 * `middle` sits between the two halves, so a button can be the centre of the row. `className` says below which
 * width the row gives way to the Menu button (SiteHeader).
 */
export function HeaderLinks({
  items,
  middle,
  className = "",
}: {
  items: { href: string; label: string }[];
  middle?: React.ReactNode;
  className?: string;
}) {
  const pathname = usePathname();
  const split = Math.ceil(items.length / 2);
  const halves = [items.slice(0, split), items.slice(split)];
  const link = (n: { href: string; label: string }) => (
    <li key={n.href}>
      <TopNavItem href={n.href} label={n.label} isSelected={isCurrent(pathname, n.href)} />
    </li>
  );
  return (
    <nav aria-label="Main" className={`site-links ${className}`}>
      <ul>
        {halves[0].map(link)}
        {middle ? <li className="site-links-middle">{middle}</li> : null}
        {halves[1].map(link)}
      </ul>
    </nav>
  );
}
