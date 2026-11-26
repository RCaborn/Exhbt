import { Coming } from "@/components/lab/Coming";
import { labMetadata } from "@/components/lab/server";

export const generateMetadata = labMetadata("App");

/** A placeholder, so the lab bar's link works. The screen's own agent replaces this file. */
export default function LabApp() {
  return <Coming screen="App" />;
}
