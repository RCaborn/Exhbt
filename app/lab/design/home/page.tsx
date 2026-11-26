import { Coming } from "@/components/lab/Coming";
import { labGate, labMetadata } from "@/components/lab/server";

export const generateMetadata = labMetadata("Home");

/**
 * A placeholder, so the lab bar's link works. The screen's own agent replaces this file, and
 * keeps the two lines every lab page has: the title through labMetadata, and labGate() first.
 */
export default function LabHome() {
  labGate();
  return <Coming screen="Home" />;
}
