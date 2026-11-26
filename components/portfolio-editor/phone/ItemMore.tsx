"use client";

import type { ReactNode } from "react";

/*
 * STUB (brief E, milestone 1). Brief I takes this file over: on a phone, the one 44px "More" button a
 * section or a tile has in place of its toolbar, opening a sheet of its actions (`Sheet` from
 * ../ui/Sheet.tsx, named "item"). F's frames draw it where `usePhone()` is true. Until then it draws
 * nothing.
 */

export type ItemAction = { id: "up" | "down" | "remove" | "star" | "unstar" | "hide" | "show" | "open"; label: string; /** Why it is off, read out and shown. */ off?: string; run(): void };

export function ItemMore(props: { name: string; actions: ItemAction[] }): ReactNode {
  void props;
  return null;
}
