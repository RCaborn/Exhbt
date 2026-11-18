import type { LookId } from "@/lib/portfolio-themes";
import type { SampleId } from "./samples";

/**
 * What the lab page can be opened with (its address carries them). Kept apart from the client
 * components so the server page can read them.
 */

/** The three looks the lab switches between: the default, a serif one with square corners, and the dark one. */
export const LAB_LOOKS = ["exhbt", "classic", "night"] as const satisfies readonly LookId[];
export type LabLook = (typeof LAB_LOOKS)[number];
export const isLabLook = (v: unknown): v is LabLook => typeof v === "string" && (LAB_LOOKS as readonly string[]).includes(v);

/** A: the other sections slide to show where the lifted one will land. B: the page stays still and a line shows it. */
export type Version = "a" | "b";

export type LabInitial = {
  sample: SampleId;
  look: LabLook;
  version: Version;
  /** `?read=1`: the sample as the published page draws it (the real ProjectView), for comparing against. */
  read: boolean;
  /** `?grow=js`: text fields grow by script, as they do in a browser without `field-sizing`. */
  grow: "css" | "script";
};
