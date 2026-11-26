import { Coming } from "@/components/lab/Coming";
import { labMetadata } from "@/components/lab/server";

export const generateMetadata = labMetadata("Finish");

/** A placeholder, so the lab bar's link works. The screen's own agent replaces this file. */
export default function LabFinish() {
  return <Coming screen="Finish" />;
}
