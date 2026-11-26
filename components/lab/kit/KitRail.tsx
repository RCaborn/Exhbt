"use client";

import { Outline } from "@astryxdesign/core/Outline";
import { KIT_SECTIONS } from "./parts";

const ITEMS = KIT_SECTIONS.map((s) => ({ id: s.id, label: s.label, level: 1 as const }));

/** The kit's sections down the side of a wide window, marking the one being read (Astryx's Outline). */
export function KitRail() {
  return <Outline items={ITEMS} label="The kit's sections" density="compact" offset={24} />;
}
