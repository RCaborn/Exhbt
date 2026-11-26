import { ShellSpecimen } from "@/components/lab/kit/ShellSpecimen";
import { labGate, labMetadata } from "@/components/lab/server";

export const generateMetadata = labMetadata("The app's frame");

/** Astryx's AppShell in the proposed theme, on its own page (the kit's last section links here). */
export default function LabKitShell() {
  labGate();
  return <ShellSpecimen />;
}
