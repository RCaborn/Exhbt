import { SECTION_NAMES, type SectionKey } from "@/lib/portfolio-layout";

/*
 * Every word the sections and tiles draw (brief F), in one place, so the design plan's changes to the
 * vision, the Add tile, the hidden row and the owner-only tiles (decision 0033) are made here and
 * nowhere else. Plain British English, "exhbt" in lower case, and no plan figure typed in: counts come
 * from the loader (`addRoom`, read from lib/entitlements.ts through the plan rules).
 *
 * Undo's labels are past tense and lower case ("moved Experience"): the bar's button reads
 * "Undo: moved Experience".
 */

export const sectionName = (k: SectionKey): string => SECTION_NAMES[k];

export const W = {
  /* ---------- A section's toolbar ---------- */
  sectionTools: (n: string) => `${n}: arrange`,
  grip: (n: string) => `Drag ${n}`,
  gripTip: (n: string) => `Drag ${n}, or press Space and use the arrow keys`,
  sectionUp: (n: string) => `Move ${n} up`,
  sectionDown: (n: string) => `Move ${n} down`,
  sectionRemove: (n: string) => `Remove ${n}`,
  sectionMore: (n: string) => `More for ${n}`,
  firstAlready: (n: string) => `${n} is already at the top`,
  lastAlready: (n: string) => `${n} is already at the bottom`,
  keepOne: "Your portfolio keeps at least one section.",
  keepWork: "Your portfolio always shows your work.",
  keepAnchor: "Your portfolio keeps your work, your best piece of work or Get in touch.",
  moved: (n: string) => `moved ${n}`,
  removed: (n: string) => `removed ${n}`,
  added: (n: string) => `added ${n}`,
  saidMoved: (n: string, at: number, of: number) => `${n} moved to position ${at} of ${of}.`,
  saidRemoved: (n: string) => `${n} removed. Undo puts it back with its words.`,
  saidAdded: (n: string) => `${n} added at the end of your portfolio.`,

  /* ---------- Add a section ---------- */
  addSection: "Add a section",
  addSectionAllOn: "Every section is on your portfolio",
  onPageAlready: "Already on your portfolio",
  seePlans: "See plans",

  /* ---------- Dragging ---------- */
  sectionsHelp: "To pick up a section, press Space on its grip. Use the arrow keys to move it, then press Space to drop it. Press Escape to cancel.",
  tilesHelp: "To pick up an exhbt, press Space on its grip. Use the arrow keys to move it, then press Space to drop it. Press Escape to cancel.",
  pickedUp: (n: string, at: number, of: number) => `Picked up ${n}. Position ${at} of ${of}.`,
  over: (n: string, at: number, of: number) => `${n} is over position ${at} of ${of}.`,
  dropped: (n: string, at: number, of: number) => `Dropped ${n}. Position ${at} of ${of}.`,
  stays: (n: string, at: number, of: number) => `Dropped ${n}. It stays at position ${at} of ${of}.`,
  cancelled: (n: string, at: number, of: number) => `Cancelled. ${n} is back at position ${at} of ${of}.`,

  /* ---------- An exhbt's tile ---------- */
  tileTools: (t: string) => `${t}: arrange`,
  open: (t: string) => `Open ${t}`,
  star: (t: string) => `Put ${t} in the band`,
  starTip: "Show it large at the top, as your best piece of work",
  unstar: (t: string) => `Take ${t} out of the band`,
  hide: (t: string) => `Hide ${t}`,
  hideTip: "Take it off your portfolio. It keeps its link.",
  show: (t: string) => `Show ${t}`,
  tileMore: (t: string) => `More for ${t}`,
  tileUp: "Move up",
  tileDown: "Move down",
  tileFirst: "Already first",
  tileLast: "Already last",
  draft: "Draft",
  draftTip: "Only you can see a draft",
  starred: (t: string) => `put ${t} in the band`,
  unstarred: (t: string) => `took ${t} out of the band`,
  hid: (t: string) => `hid ${t}`,
  showed: (t: string) => `showed ${t}`,
  movedTile: (t: string) => `moved ${t}`,
  saidHid: (t: string) => `${t} hidden. It is in the row under your work, with Show.`,
  saidShowed: (t: string) => `${t} is back on your portfolio.`,
  saidStarred: (t: string) => `${t} is in the band at the top of your portfolio.`,
  saidUnstarred: (t: string) => `${t} is back with the rest of your work.`,

  /* ---------- What only the owner sees ---------- */
  ownerOnly: "Only you can see this",
  overLimit: "Over your plan's limit",
  overLimitWhy: "It stays live at its link, but your plan shows fewer on your portfolio.",
  draftWhy: "Finish it and publish it to put it on your portfolio.",
  finish: "Finish and publish",
  openIt: "Open",
  showShort: "Show",
  hiddenHeading: "Hidden from your portfolio",
  hiddenWhy: "Visitors don't see these here. Each one still works at its link.",

  /* ---------- Add an exhbt ---------- */
  addHeading: "Your next project goes here",
  addExhbt: "Add an exhbt",
  addWhat: "An exhbt is a short, checked write-up of one project, with its key result. Each one you add shows here.",
  room: (used: number, limit: number, plan: string) => `${used} of ${limit} on ${plan}`,
  seePlansUpgrade: "See plans",
  freeNote: "On your plan an exhbt stays a draft that only you can see.",

  /* ---------- The vision ---------- */
  visionAdd: "Add an exhbt",

  /* ---------- Lines of education and experience ---------- */
  lineTools: (kind: "education" | "experience", n: number) => `${kind === "education" ? "Education" : "Experience"} line ${n}`,
  addLine: (kind: "education" | "experience") => (kind === "education" ? "Add a course or qualification" : "Add a role"),
  lineUp: (n: number) => `Move line ${n} up`,
  lineDown: (n: number) => `Move line ${n} down`,
  lineRemove: (n: number) => `Remove line ${n}`,
  addedLine: (kind: "education" | "experience") => (kind === "education" ? "added a line of education" : "added a role"),
  movedLine: (n: number) => `moved line ${n}`,
  removedLine: (n: number) => `removed line ${n}`,
  yearHint: "This shows as part of the line: use a year, like 2024, or 2021 to 2024",
} as const;
