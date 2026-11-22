/*
 * How things are carried when dragged (decision 0026, "Dragging"), as Rory decided on 18 Nov 2026:
 * "Flowchart on b works better, rest on a is better!" Each is one line to change. F's file; K reads
 * FLOW_BOX_STYLE and never edits it.
 *  - "slide": the other sections move aside, by transform, to show where it will land.
 *  - "line": it is carried over a still page, and a line shows where it will land.
 */

/** A section other than the flowchart. */
export const SECTION_STYLE: "slide" | "line" = "slide";
/** The flowchart section. */
export const FLOW_SECTION_STYLE: "slide" | "line" = "line";
/** A box inside the flowchart. Rory, 22 Nov 2026: "Boxes sliding is better" (open question 1). "line" stays one change away until he has tried the real editor. */
export const FLOW_BOX_STYLE: "slide" | "line" = "slide";
