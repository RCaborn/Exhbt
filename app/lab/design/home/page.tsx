import type { Metadata } from "next";
import { Coming } from "@/components/lab/Coming";

export const metadata: Metadata = { title: "Home" };

/** A placeholder, so the lab bar's link works. The screen's own agent replaces this file. */
export default function LabHome() {
  return <Coming screen="Home" />;
}
