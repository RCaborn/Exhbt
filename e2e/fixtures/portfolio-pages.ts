/**
 * The portfolio parity gate's fixtures (brief A of docs/briefs/portfolio-first, decision 0031,
 * "Visitors' pages stay as they are"): whole portfolios, each seeded through POST /dev/portfolio-parity
 * and drawn by today's pages, so e2e/portfolio-parity.spec.ts can compare them with golden copies
 * written on main's commit. The portfolio editor's tests seed their pages from here too: import, never
 * edit (a change here changes what the golden copies were drawn from).
 *
 * Plain data. This file must run unchanged on main's commit, so it imports nothing the portfolio-first
 * releases add, and nothing at all from the app: the exhbts, the layouts and the look ids are written
 * out here, so a later change to the samples or the looks cannot move what a golden copy shows.
 *
 * Every username starts "pp-" and belongs to one page only, so the pages never share a person.
 */

/** What POST /dev/portfolio-parity takes (app/dev/portfolio-parity/route.ts says what each field does). */
export type PortfolioFixture = {
  username: string;
  plan: "free" | "premium" | "max" | "institutional";
  /** The stored look (`profiles.portfolio_theme`); null is the default. */
  look: string | null;
  person: {
    name: string;
    headline?: string;
    bio?: string;
    location?: string;
    lookingFor?: string;
    linkedin?: string;
    github?: string;
    website?: string;
    contactEmail?: string;
    hideFromSearch?: boolean;
    /** A stand-in photo (a flat drawing), stored as the person's own file. */
    photo?: boolean;
  };
  /** `profiles.portfolio_layout` as stored; null is a person who never arranged anything. */
  layout: unknown;
  exhbts: { key: string; slug: string; doc: unknown; working?: unknown; draft?: boolean; hidden?: boolean }[];
  /** The key of the starred exhbt. */
  featured: string | null;
  jobLinks?: { slug: string; company: string; roleTitle: string; intro?: string; picks: { exhbt: string; reason: string }[] }[];
  publishedAt?: string;
};

/**
 * Where a page is seen:
 *  - "public": the portfolio home, /p/<username>, signed out;
 *  - "owner": /p/<username> signed in as the owner, with nothing live (the owner's preview);
 *  - { job }: that job link's page, on the person's own host (<username>.localhost);
 *  - { exhbt }: that exhbt's page in its frame, on the person's own host.
 * `root` is what is compared: [data-portfolio-home] unless it says otherwise.
 */
export type PortfolioView = "public" | "owner" | { job: string } | { exhbt: string };
export type PortfolioPage = { name: string; fixture: PortfolioFixture; view: PortfolioView; root?: string };

/* ---------------- The exhbts ---------------- */

const SCHEMA_VERSION = 2;
type Rich = { t: string; b?: boolean }[];
const text = (t: string): Rich => [{ t }];

/** A published exhbt as today's code stores it: a case study, no flowchart marker. */
function caseStudy(o: { title: string; context: string; whereWhen: string; summary: string; skills: string[]; gap: Rich; flow: string[]; sections: unknown[]; evidence?: unknown }) {
  return {
    schemaVersion: SCHEMA_VERSION,
    title: o.title,
    context: o.context,
    whereWhen: o.whereWhen,
    summary: o.summary,
    skills: o.skills,
    gap: o.gap,
    flow: o.flow.map((step) => ({ step })),
    sections: o.sections,
    ...(o.evidence ? { evidence: o.evidence } : {}),
  };
}

/** Key figure: a before-and-after graph. Its work is attached, so the band says "Source attached and checked". */
const QUEUE = caseStudy({
  title: "Would a second till cut the lunch queue?",
  context: "Year 2 operations module",
  whereWhen: "Campus cafe, May 2026",
  summary: "Waits at the till fell from 11 minutes to 4 with a second till at lunch.",
  skills: ["Excel", "Timing studies", "Operations"],
  gap: [{ t: "Queues ran long at lunch. " }, { t: "Would a second till help?", b: true }],
  flow: ["Timed the queue for a week", "Opened a second till", "Timed it again"],
  sections: [
    { id: "findings", kind: "findings", items: [text("Waits at the till fell from 11 minutes to 4."), text("Sales at lunch held steady in both weeks.")] },
    {
      id: "graph-1",
      kind: "graph",
      chart: { kind: "beforeAfter", title: "Wait at the till (minutes)", beforeLabel: "One till", afterLabel: "Two tills", lowerIsBetter: true, unit: "min", rows: [{ label: "Monday", before: 12, after: 4 }, { label: "Wednesday", before: 11, after: 5 }, { label: "Friday", before: 10, after: 3 }] },
    },
    { id: "reflection-1", kind: "reflection", text: text("Next I would time the evening queue too.") },
  ],
  evidence: { kind: "link", href: "https://example.com/queue-timings", label: "Queue timings, week by week" },
});

/** Key figure: a bar graph. */
const LIBRARY = caseStudy({
  title: "Where do students sit in the library?",
  context: "Dissertation pilot study",
  whereWhen: "University library, March 2026",
  summary: "The quiet floor filled by ten each morning while the group rooms stood half empty.",
  skills: ["Python", "Surveys"],
  gap: [{ t: "Students said there was nowhere to sit. " }, { t: "Was that true on every floor?", b: true }],
  flow: ["Counted seats every hour", "Mapped them by floor", "Compared the floors"],
  sections: [
    { id: "findings", kind: "findings", items: [text("The quiet floor was full by ten every morning."), text("Group rooms were half empty until two.")] },
    { id: "graph-1", kind: "graph", chart: { kind: "bar", title: "Seats taken at 11am (%)", unit: "%", rows: [{ label: "Quiet floor", value: 96 }, { label: "Group rooms", value: 48 }, { label: "Cafe area", value: 71 }] } },
  ],
});

/** Key figure: a picture (no graph), so the card and the band show the image. */
const POSTER = caseStudy({
  title: "Did a new poster bring more people to the food bank?",
  context: "Volunteer project",
  whereWhen: "Student union, October 2025",
  summary: "Sign-ups at the stall doubled in the fortnight after the new poster went up.",
  skills: ["Design", "Excel"],
  gap: [{ t: "Few students knew the food bank was there. " }, { t: "Would a clearer poster help?", b: true }],
  flow: ["Counted sign-ups for two weeks", "Put up the new poster", "Counted them again"],
  sections: [
    { id: "image-1", kind: "image", fileId: "parity", alt: "The new food bank poster on the union noticeboard.", caption: text("The poster on the union noticeboard"), w: 1200, h: 800 },
    { id: "findings", kind: "findings", items: [text("Sign-ups rose from 14 to 29 a week."), text("Most new sign-ups came on the first two days.")] },
  ],
});

/** Key figure: the steps of the process (no graph, no picture). */
const ROTA = caseStudy({
  title: "Could a shared rota stop missed cafe shifts?",
  context: "Part-time job",
  whereWhen: "Campus cafe, January 2026",
  summary: "Missed shifts fell from six a month to one after the rota moved to a shared sheet.",
  skills: ["Excel", "Scheduling"],
  gap: [{ t: "Shifts were swapped by text and often missed. " }, { t: "Would one shared sheet help?", b: true }],
  flow: ["Listed every missed shift", "Built a shared rota sheet", "Asked staff to swap there", "Counted missed shifts again"],
  sections: [{ id: "findings", kind: "findings", items: [text("Missed shifts fell from six a month to one."), text("Every swap in February went through the sheet.")] }],
});

/** Key figure: a line graph. */
const SURVEY = caseStudy({
  title: "How much food does the halls kitchen throw away?",
  context: "Year 3 sustainability module",
  whereWhen: "Halls of residence, autumn term 2025",
  summary: "Weighing the bins for eight weeks showed waste fell by a third once portions were cut.",
  skills: ["Python", "Data cleaning"],
  gap: [{ t: "The kitchen guessed its waste. " }, { t: "How much was it really?", b: true }],
  flow: ["Weighed the bins each night", "Cut the lunch portions", "Kept weighing for a month"],
  sections: [
    { id: "findings", kind: "findings", items: [text("Waste fell from 31 kg a night to 20 kg."), text("Nobody asked for a second portion in the trial.")] },
    {
      id: "graph-1",
      kind: "graph",
      chart: { kind: "line", title: "Food thrown away each night (kg)", unit: "kg", series: ["Waste"], rows: [{ label: "Week 1", values: [31] }, { label: "Week 2", values: [30] }, { label: "Week 3", values: [26] }, { label: "Week 4", values: [22] }, { label: "Week 5", values: [20] }] },
    },
  ],
});

type Exhbt = PortfolioFixture["exhbts"][number];
/** The five exhbts of a full portfolio, in its order: two graphs, a picture, the steps, a line. */
const FIVE: Exhbt[] = [
  { key: "queue", slug: "lunch-queue", doc: QUEUE },
  { key: "library", slug: "library-seats", doc: LIBRARY },
  { key: "poster", slug: "food-bank-poster", doc: POSTER },
  { key: "rota", slug: "shared-rota", doc: ROTA },
  { key: "survey", slug: "kitchen-waste", doc: SURVEY },
];

/* ---------------- The people and their layouts ---------------- */

const FULL_PERSON: PortfolioFixture["person"] = {
  name: "Maya Clarke",
  headline: "Operations analyst, food service and retail",
  bio: "Final-year Business Analytics student at Sheffield. I like timing things, then changing one thing and timing them again.\n\nThis year I ran small trials in the campus cafe, the library and the halls kitchen, and wrote up what worked and what did not.",
  location: "Sheffield",
  lookingFor: "Graduate operations or analyst roles in the north of England",
  linkedin: "https://www.linkedin.com/in/example-parity",
  github: "https://github.com/example-parity",
  website: "https://example.org/maya",
  contactEmail: "maya@example.com",
  photo: true,
};

/** The words of every section, within every limit in lib/portfolio-layout.ts (a tile over one is dropped). */
const TILES = {
  about: { text: "I worked in my aunt's cafe for three summers, which is where I first timed a queue. I like work where a small change can be measured and felt by the people in the line." },
  education: { lines: ["BSc Business Analytics, University of Sheffield, 2023 to now", "Foundation year, Sheffield College, 2022–2023", "A levels: Maths, Economics, Geography, 2022"], tools: "Excel, Python, SQL, Tableau" },
  experience: { lines: ["Shift supervisor, campus cafe, 2024 to now", "Summer analyst intern, Sheffield City Council, 2025", "Weekend retail assistant, 2021–2023"] },
  quote: { text: "Maya's queue trial changed how we staff the lunch rush, and her numbers made the case for us.", name: "Sam Patel", role: "Cafe manager" },
};

const ALL_SIX = ["featured", "work", "about", "experience", "quote", "contact"];
const layoutOf = (slots: string[]) => ({ v: 1, slots, tiles: TILES, header: { skills: true, linkedin: true } });

/** A full portfolio: a photo, two paragraphs, where and what, every link, three education lines with years, tools, experience, a quote, five exhbts, every section. */
export function fullFixture(username: string, look: string | null, plan: PortfolioFixture["plan"] = "max"): PortfolioFixture {
  return { username, plan, look, person: { ...FULL_PERSON }, layout: layoutOf(ALL_SIX), exhbts: FIVE.map((e) => ({ ...e })), featured: null };
}

/** A name and nothing else, with the one live exhbt a public page needs (with none, visitors get not found). */
export function sparseFixture(username: string, look: string | null): PortfolioFixture {
  return { username, plan: "max", look, person: { name: "Maya Clarke" }, layout: null, exhbts: [{ ...FIVE[0]! }], featured: null };
}

/** Studio sets the name one word per line; a hyphenated word is the longest a hero has to fit. */
export const LONG_NAME = "Oluwaseun Adebayo-Montgomery Fitzwilliam";

/** The full portfolio in the Exhbt look and the sparse one: what the editor's tests start from. */
export const FULL = fullFixture("pp-full", null);
export const SPARSE = sparseFixture("pp-sparse", null);

/* ---------------- The pages the gate compares ---------------- */

/**
 * Every look in every colourway (lib/portfolio-themes.ts `ALL_THEMES`, written out; the spec checks the
 * two lists agree), in plan order.
 */
export const LOOK_IDS = [
  "exhbt",
  "classic",
  "classic-burgundy",
  "classic-black",
  "classic-ochre",
  "notebook",
  "mono",
  "night",
  "studio",
  "studio-green",
  "studio-pink",
  "studio-mint",
  "studio-black",
  "ledger",
  "bloom",
  "bloom-mint",
  "bloom-lavender",
  "bloom-blue",
] as const;

/** The eight looks, each in its default colourway: the home page's look pictures and the step builder's cards. */
export const BASE_LOOKS = ["exhbt", "classic", "notebook", "mono", "night", "studio", "ledger", "bloom"] as const;

/** The Exhbt look and two others with different heroes (Studio's block, Notebook's rows of facts), for the content that changes a hero most. */
const HERO_LOOKS = ["exhbt", "studio", "notebook"] as const;

const withSections = (username: string, slots: string[]): PortfolioFixture => ({ ...fullFixture(username, null), layout: layoutOf(slots) });

export const PORTFOLIO_PAGES: PortfolioPage[] = [
  // Every look and colourway, with everything filled in.
  ...LOOK_IDS.map((id): PortfolioPage => ({ name: `look-${id}`, fixture: fullFixture(`pp-look-${id}`, id === "exhbt" ? null : id), view: "public" })),

  // In three heroes: a name only, a long name, no photo.
  ...HERO_LOOKS.flatMap((look): PortfolioPage[] => {
    const stored = look === "exhbt" ? null : look;
    return [
      { name: `sparse-${look}`, fixture: sparseFixture(`pp-sparse-${look}`, stored), view: "public" },
      { name: `long-name-${look}`, fixture: { ...fullFixture(`pp-long-name-${look}`, stored), person: { ...FULL_PERSON, name: LONG_NAME } }, view: "public" },
      { name: `no-photo-${look}`, fixture: { ...fullFixture(`pp-no-photo-${look}`, stored), person: { ...FULL_PERSON, photo: false } }, view: "public" },
    ];
  }),

  // Section sets. All six in their usual order is every look above; here they are turned round.
  { name: "sections-default", fixture: withSections("pp-sections-default", ["featured", "work", "about", "contact"]), view: "public" },
  { name: "sections-all-six-reversed", fixture: withSections("pp-sections-reversed", [...ALL_SIX].reverse()), view: "public" },
  // As the step builder stores it. Today sectionsOf reads slots with no "featured", "work" or "contact"
  // as a layout of decision 0014, so this page draws the default arrangement: kept as it is.
  { name: "sections-about-only", fixture: withSections("pp-sections-about", ["about"]), view: "public" },
  { name: "sections-contact-only", fixture: withSections("pp-sections-contact", ["contact"]), view: "public" },

  // The band. Not starred is every look above (the first exhbt); starred, the last; starred but hidden
  // (the band falls back to the first shown, and the hidden one leaves the page); starred with a picture as its key figure.
  { name: "featured-set", fixture: { ...fullFixture("pp-featured-set", null), featured: "survey" }, view: "public" },
  {
    name: "featured-hidden",
    fixture: { ...fullFixture("pp-featured-hidden", null), featured: "library", exhbts: FIVE.map((e) => ({ ...e, hidden: e.key === "library" })) },
    view: "public",
  },
  { name: "featured-image", fixture: { ...fullFixture("pp-featured-image", null), featured: "poster" }, view: "public" },

  // A layout saved by the old customiser (decision 0014): "p" for each exhbt among the tiles, and a links
  // tile. The header's LinkedIn switch is off, so the links tile's LinkedIn is the one shown.
  {
    name: "legacy-layout",
    fixture: {
      ...fullFixture("pp-legacy-layout", null),
      person: { ...FULL_PERSON, github: undefined, website: undefined, contactEmail: undefined },
      layout: {
        v: 1,
        slots: ["p", "about", "p", "education", "p", "quote", "links", "p", "p"],
        tiles: {
          about: TILES.about,
          education: { lines: TILES.education.lines.slice(0, 2) },
          quote: TILES.quote,
          links: { linkedin: "https://www.linkedin.com/in/example-legacy", github: "https://github.com/example-legacy", website: "", email: "maya.legacy@example.com" },
        },
        header: { skills: false, linkedin: false },
      },
    },
    view: "public",
  },

  // Held extras: Experience and a quote stored on a plan without them. Only Free lacks them, and Free has
  // no public page, so this is the owner's preview, compared from the page down (the note above it is
  // the owner-preview page's). A draft is never drawn there.
  {
    name: "held-extras",
    fixture: { ...fullFixture("pp-held-extras", null, "free"), exhbts: [{ ...FIVE[0]!, draft: true }] },
    view: "owner",
  },

  // The owner's preview: signed in, nothing live yet (one draft), the note and its buttons included.
  {
    name: "owner-preview",
    fixture: { ...fullFixture("pp-owner-preview", "classic-ochre", "premium"), exhbts: [{ ...FIVE[0]!, draft: true }] },
    view: "owner",
    root: "main",
  },

  // A job link's page on the person's own host: the portfolio's cards (ProjectCard) in the person's look.
  {
    name: "job-link",
    fixture: {
      ...fullFixture("pp-job-link", "studio-pink"),
      jobLinks: [
        {
          slug: "northfield-analyst",
          company: "Northfield Foods",
          roleTitle: "Graduate Operations Analyst",
          intro: "I like finding the one change that makes a busy service run better, then measuring it.\n\nThese three pieces show how I time a process, test a change and report what happened.",
          picks: [
            { exhbt: "queue", reason: "A timed trial of a change to a busy service, with the before and after." },
            { exhbt: "poster", reason: "Shows I can test a small change and count what it does." },
            { exhbt: "rota", reason: "" },
          ],
        },
      ],
    },
    view: { job: "northfield-analyst" },
    root: "[data-job-page]",
  },

  // An exhbt's page in its frame on the person's own host: the look's variables, the pager's cards, the sign-off.
  { name: "exhbt-frame", fixture: fullFixture("pp-exhbt-frame", "classic-burgundy"), view: { exhbt: "library-seats" }, root: "[data-look]:has([data-exhbt-route])" },
];

/**
 * The step builder's look cards (/portfolio?step=look, signed in): every look drawn as the top of this
 * person's page. On Premium, so four looks are locked; a stored colourway, so Classic shows it; five
 * exhbts, one over the plan's limit.
 */
export const BUILDER_LOOK_CARDS: PortfolioFixture = fullFixture("pp-builder-looks", "classic-burgundy", "premium");
