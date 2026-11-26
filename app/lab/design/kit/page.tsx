import type { Metadata } from "next";
import { Coming } from "@/components/lab/Coming";

export const metadata: Metadata = { title: "Kit" };

export default function LabKit() {
  return <Coming screen="Kit" />;
}
