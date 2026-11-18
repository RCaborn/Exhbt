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

/**
 * How dragging feels.
 *  - A: everything slides. The other sections (and the other flow boxes) move aside to show where the lifted one will land.
 *  - B: a line everywhere. The page stays still and a line shows where it will land.
 *  - Mix (the default, Rory's choice on 18 Nov 2026: "Flowchart on b works better, rest on a is
 *    better!"): sections slide, as in A; the flowchart, and the boxes in it, use a line, as in B.
 */
export const VERSIONS = ["mix", "a", "b"] as const;
export type Version = (typeof VERSIONS)[number];
export const isVersion = (v: unknown): v is Version => typeof v === "string" && (VERSIONS as readonly string[]).includes(v);

export type DragStyle = "slide" | "line";

/** How a section drags in a version. `isFlow`: it is the flowchart. */
export const sectionStyle = (v: Version, isFlow: boolean): DragStyle => (v === "a" ? "slide" : v === "b" ? "line" : isFlow ? "line" : "slide");

/** How a box inside the flowchart drags in a version. */
export const boxStyle = (v: Version): DragStyle => (v === "a" ? "slide" : "line");

export type LabInitial = {
  sample: SampleId;
  look: LabLook;
  version: Version;
  /** `?read=1`: the sample as the published page draws it (the real ProjectView), for comparing against. */
  read: boolean;
  /** `?grow=mirror`: text fields grow by the fallback, as they do in a browser without `field-sizing`. */
  grow: "css" | "mirror";
};
