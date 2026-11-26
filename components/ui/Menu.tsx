"use client";

import { DropdownMenu } from "@astryxdesign/core/DropdownMenu";
import { MoreMenu } from "@astryxdesign/core/MoreMenu";

export type MenuItem = {
  label: string;
  onSelect?: () => void;
  href?: string;
  danger?: boolean;
  /** Why it is off: shown under the label and read out. */
  off?: string;
};

function toItems(items: MenuItem[]) {
  return items.map((i) => ({
    label: i.label,
    onClick: i.onSelect,
    href: i.href,
    variant: i.danger ? ("destructive" as const) : undefined,
    isDisabled: i.off ? true : undefined,
    description: i.off,
  }));
}

/**
 * An Astryx DropdownMenu. `trigger` is the visible text of its button, a string and not a node: Astryx's menu has to
 * anchor to a real control (it hands that control a ref and the open and keyboard handlers), and a node the caller
 * passes, such as our Button, cannot take them. `label` is the button's tooltip.
 */
export function Menu({ trigger, items, label }: { trigger: string; items: MenuItem[]; label: string }) {
  return <DropdownMenu items={toItems(items)} button={{ label: trigger, tooltip: label }} presentation="adaptive" />;
}

export function More({ items, label }: { items: MenuItem[]; label: string }) {
  return <MoreMenu label={label} items={toItems(items)} alignment="end" presentation="adaptive" />;
}
