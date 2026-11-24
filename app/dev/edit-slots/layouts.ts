import { SCHEMA_VERSION, text, type Chart, type ExhbtDoc } from "../../../lib/exhbt/blocks";

/*
 * A fixture doc for each of the four layouts of decision 0028, so the slot harness can draw them
 * before their real samples exist (those are lib/exhbt/sample.ts, agent D's). Fictional, in each
 * layout's usual order, with every part the layout draws. Development only.
 */

const pic = (n: number, w: number, h: number, alt: string, caption: string, stage?: "before" | "after") => ({
  id: `image-${n}`,
  kind: "image" as const,
  fileId: `fixture-${n}`,
  alt,
  caption: text(caption),
  w,
  h,
  ...(stage ? { stage } : {}),
});

export const buildFixture: ExhbtDoc = {
  schemaVersion: SCHEMA_VERSION,
  format: "build",
  title: "A bus-times app for the campus shuttle",
  context: "BSc Computer Science, Year 2 project",
  whereWhen: "University of Bristol, April 2026",
  skills: ["React Native", "TypeScript", "Firebase"],
  gap: [{ t: "Students waited at the stop with no idea when the shuttle would come. " }, { t: "Could its live position be on their phones?", b: true }],
  flow: [{ step: "Asked 30 riders what they needed" }, { step: "Read the shuttle's GPS feed" }, { step: "Built the app in React Native", detail: "six weeks" }, { step: "Tested with the transport office" }],
  sections: [
    pic(1, 1200, 2400, "A phone showing a map of campus with the shuttle's position and the next stop.", "The live map, the app's first screen"),
    { id: "flow", kind: "flow" },
    { id: "findings", kind: "findings", items: [text("Shows where the shuttle is, updated every ten seconds."), text("Says when it will reach the stop you picked."), text("Works offline with the last known times.")] },
    { id: "graph-1", kind: "graph", chart: { kind: "bar", title: "Minutes waited at the stop", rows: [{ label: "Before the app", value: 14 }, { label: "With the app", value: 5 }] } as Chart },
    pic(2, 1200, 2400, "The stop list with times for the next three shuttles.", "Times at each stop"),
    pic(3, 1600, 1000, "A chart of riders per hour drawn on the transport office's screen.", "The office's view of riders"),
    { id: "quote-1", kind: "quote", text: "The questions at the front desk stopped in the first week.", name: "Dana Hughes", role: "Transport office" },
    { id: "reflection-1", kind: "reflection", text: text("Next I'd add alerts when the shuttle is two stops away.") },
    { id: "link-1", kind: "link", href: "https://example.com/shuttle-demo", label: "Try the demo", description: "Runs in the browser" },
    { id: "link-2", kind: "link", href: "https://example.com/shuttle-code", label: "See the code", description: "On GitHub" },
  ],
  evidence: { kind: "link", href: "https://example.com/shuttle-report.pdf", label: "Project report (PDF)" },
};

export const essayFixture: ExhbtDoc = {
  schemaVersion: SCHEMA_VERSION,
  format: "essay",
  title: "Did the 1832 Reform Act widen the vote, or only move it?",
  context: "BA History, Year 3 essay",
  whereWhen: "University of York, January 2026",
  skills: ["Archival research", "Argument", "Source criticism"],
  gap: [{ t: "The Act is often called the start of democracy. " }, { t: "Who could vote after it, and who lost out?", b: true }],
  flow: [{ step: "The old franchise" }, { step: "What the Act changed" }, { step: "Who gained and who lost" }],
  sections: [
    { id: "flow", kind: "flow" },
    {
      id: "findings",
      kind: "findings",
      items: [text("The electorate grew by about half, mostly among middle-class men."), text("Some working men in old boroughs lost a vote they had held."), text("Seats moved to growing towns, but property still decided who voted.")],
    },
    { id: "pullquote-1", kind: "pullquote", text: "The Act moved the vote towards property, not towards the people." },
    pic(1, 1600, 1100, "A page of a poll book listing voters and their votes in ink.", "A York poll book, 1835"),
    { id: "quote-1", kind: "quote", text: "A careful reading of the poll books.", name: "Dr Ruth Allen", role: "Tutor" },
    { id: "reflection-1", kind: "reflection", text: text("Next I'd compare two towns' poll books before and after.") },
    { id: "link-1", kind: "link", href: "https://example.com/reform-act-text", label: "The Representation of the People Act 1832", description: "The Act's text" },
    { id: "link-2", kind: "link", href: "", label: "Phillips and Wetherell, The Great Reform Act of 1832, 1995", description: "" },
  ],
};

export const beforeAfterFixture: ExhbtDoc = {
  schemaVersion: SCHEMA_VERSION,
  format: "before-after",
  title: "The library's room-booking page",
  context: "MA UX Design, Year 1 project",
  whereWhen: "University of Glasgow, February 2026",
  skills: ["User research", "Figma", "Usability testing"],
  gap: [{ t: "Students booked the wrong rooms. " }, { t: "The page hid the times behind three menus.", b: true }],
  flow: [{ step: "Watched 8 students book a room" }, { step: "Sketched two layouts" }, { step: "Tested the better one", detail: "12 students" }],
  sections: [
    pic(1, 1600, 1000, "The old booking page with three drop-down menus and no times on show.", "Before: three menus", "before"),
    pic(2, 1600, 1000, "The new booking page with every room's free times as a grid.", "After: one grid", "after"),
    pic(3, 1080, 1920, "The old page on a phone, with the menus cut off at the edge.", "Before, on a phone", "before"),
    pic(4, 1080, 1920, "The new page on a phone, the grid scrolling sideways.", "After, on a phone", "after"),
    { id: "flow", kind: "flow" },
    { id: "findings", kind: "findings", items: [text("All free times now show at once, so nobody opens a menu."), text("Rooms are named the way the signs on the doors name them.")] },
    { id: "graph-1", kind: "graph", chart: { kind: "bar", title: "Seconds to book a room", rows: [{ label: "Old page", value: 94 }, { label: "New page", value: 31 }] } as Chart },
    { id: "quote-1", kind: "quote", text: "The wrong-room emails have nearly stopped.", name: "Priya Shah", role: "Library services" },
    { id: "reflection-1", kind: "reflection", text: text("Next I'd test the new page with a screen reader.") },
    { id: "link-1", kind: "link", href: "https://example.com/booking-prototype", label: "Open the prototype", description: "In Figma" },
  ],
};

export const eventFixture: ExhbtDoc = {
  schemaVersion: SCHEMA_VERSION,
  format: "event",
  title: "The Music Society's spring concert",
  context: "Student society, committee role",
  whereWhen: "Leeds University Union, March 2026",
  myRole: "Stage manager",
  skills: ["Event planning", "Budgeting", "Team leading"],
  gap: [{ t: "The society wanted a concert that " }, { t: "paid for itself and filled the hall", b: true }, { t: "." }],
  flow: [{ step: "Booked the hall and set a budget" }, { step: "Ran three rehearsals" }, { step: "Sold tickets through the union" }, { step: "Ran the night", detail: "40 performers" }],
  sections: [
    pic(1, 1200, 1700, "The concert poster: a violin drawn in one line over the date.", "The poster"),
    { id: "flow", kind: "flow" },
    { id: "findings", kind: "findings", items: [text("All 300 seats sold, a week before the night."), text("The concert made £420 for next year's tour.")] },
    { id: "graph-1", kind: "graph", chart: { kind: "bar", title: "Tickets sold by week", rows: [{ label: "Week one", value: 120 }, { label: "Week two", value: 180 }] } as Chart },
    pic(2, 1600, 1100, "The orchestra on stage under warm lights.", "The orchestra in the second half"),
    pic(3, 1600, 1100, "The full hall from the back, every seat taken.", "A full hall"),
    { id: "quote-1", kind: "quote", text: "The smoothest concert the society has run.", name: "Tom Reid", role: "Society president" },
    { id: "reflection-1", kind: "reflection", text: text("Next time I'd open ticket sales a week earlier.") },
    { id: "link-1", kind: "link", href: "https://example.com/concert-recording", label: "Hear the recording", description: "The second half, on SoundCloud" },
    { id: "link-2", kind: "link", href: "https://example.com/concert-programme", label: "Read the programme", description: "The pieces and the players" },
  ],
};
