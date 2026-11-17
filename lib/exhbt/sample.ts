import { normaliseDoc, SCHEMA_VERSION, text, type Chart, type ExhbtDoc, type ExhbtDocV1, type Section } from "./blocks";

/**
 * Fictional exhbts, for development, previews and tests (app/dev/portfolio). Same fictional
 * person as the demo portfolio. Never shown as real work.
 */

/**
 * The GP exhbt, stored the way exhbts were before sections (decision 0015): findings and graphs
 * at the top of the doc, and a graph with no `kind` (from before graph kinds, decision 0011).
 * Kept like that on purpose: app/dev/portfolio stores it as is, in both copies, so the seeded
 * portfolio and the tests go through the path old exhbts take.
 */
export const legacyGpDoc: ExhbtDocV1 = {
  schemaVersion: 1,
  title: "Cutting missed GP appointments by changing when reminders are sent",
  context: "BSc Data Science, final-year project",
  headline: { value: "−18%", label: "missed appointments" },
  skills: ["Python", "pandas", "Logistic regression", "Data cleaning"],
  gap: [
    { t: "Two GP practices lost about 8% of appointments to no-shows. " },
    { t: "Did the timing", b: true },
    { t: " of the reminder text matter more than whether one was sent?" },
  ],
  flow: [
    { step: "Collected appointment records", detail: "14,200 rows" },
    { step: "Cleaned and matched reminders" },
    { step: "Modelled no-shows by timing", detail: "logistic regression" },
    { step: "Piloted 3-hour reminders", detail: "6 weeks" },
  ],
  findings: [
    text("3-hour reminders cut missed appointments from 7.9% to 6.5%."),
    text("Under-30s gained most: 11.2% down to 8.4%."),
    text("Same-day bookings were unaffected, so the change is free to keep."),
  ],
  charts: [
    {
      title: "Missed appointments (%)",
      beforeLabel: "24-hour reminder",
      afterLabel: "3-hour reminder",
      lowerIsBetter: true,
      unit: "%",
      rows: [
        { label: "All patients", before: 7.9, after: 6.5 },
        { label: "Under 30", before: 11.2, after: 8.4 },
      ],
    } as unknown as Chart,
  ],
  images: [],
  evidence: { kind: "link", href: "https://example.com/gp-reminders-report.pdf", label: "Final report (PDF)" },
};

/** The library exhbt, in the current layout. */
export const libraryDoc: ExhbtDoc = {
  schemaVersion: SCHEMA_VERSION,
  title: "Forecasting weekly footfall for a city-centre library",
  context: "Data module coursework, Year 2",
  headline: { value: "±6%", label: "forecast error" },
  skills: ["SQL", "Time series", "Excel"],
  gap: text("Staff rotas were set by habit. Could last year's footfall predict next month well enough to plan shifts?"),
  flow: [
    { step: "Pulled gate counts", detail: "3 years" },
    { step: "Added term dates and weather" },
    { step: "Fitted a seasonal model" },
    { step: "Tested on held-out months" },
  ],
  sections: [{ id: "findings", kind: "findings", items: [text("Weekly forecasts landed within 6% of the real count."), text("Term dates explained more than weather did.")] }],
};

/**
 * An exhbt in the page layout Rory drew (16 Nov 2026, decision 0022): the title is the question,
 * the context line marks its gap in bold (drawn highlighted), and it has what it is, where and
 * when, and a summary. Its words follow the layout PDF; the graph's figures are made up for
 * development. Not in sampleSeeds: app/dev/portfolio adds it with `with=open-banking`.
 */
export const openBankingDoc: ExhbtDoc = {
  schemaVersion: SCHEMA_VERSION,
  title: "Will banks and fintechs cooperate under open banking?",
  context: "MSc Finance dissertation",
  whereWhen: "University of St Andrews, August 2026",
  summary: "It depends on two opposing forces, complementarity and substitution.",
  skills: ["Evolutionary game theory", "Replicator dynamics", "Risk dominance", "Comparative statics", "Python", "SymPy"],
  gap: [
    { t: "Open banking makes banks share customer data. " },
    { t: "Nobody knows whether banks and fintechs will then cooperate or compete.", b: true },
  ],
  flow: [
    { step: "Define bank and fintech strategies" },
    { step: "Set payoff matrix with openness parameter" },
    { step: "Derive replicator equations and rest points" },
    { step: "Classify stability of each equilibrium" },
    { step: "Select outcome via risk dominance" },
  ],
  sections: [
    {
      id: "findings",
      kind: "findings",
      items: [
        text("Openness acts through fintech disruption payoffs, not bank payoffs."),
        text("Two opposing forces, complementarity and substitution, decide whether the market moves to cooperation or competition."),
        text("Access fees can shift outcomes, depending on segment and market structure."),
      ],
    },
    {
      id: "graph-1",
      kind: "graph",
      chart: {
        kind: "bar",
        title: "Simulated markets ending in cooperation (%)",
        unit: "%",
        highlight: 0,
        rows: [
          { label: "No access fee", value: 64 },
          { label: "Low access fee", value: 52 },
          { label: "High access fee", value: 31 },
        ],
      },
    },
    { id: "reflection-1", kind: "reflection", text: text("Test the model against real partnership data from UK banks since 2018.") },
  ],
  evidence: { kind: "link", href: "https://example.com/open-banking-dissertation.pdf", label: "Dissertation.pdf" },
};

/**
 * The open-banking sample with every kind of section but an image (which needs an uploaded file),
 * close to the 200-word cap: for checking that a full exhbt still prints on one A4 page.
 * app/dev/portfolio adds it with `with=full`, at /p/<username>/open-banking-full.
 */
export const fullDoc: ExhbtDoc = {
  ...openBankingDoc,
  flow: [...openBankingDoc.flow.slice(0, 4), { step: "Test access fees and market structure", detail: "comparative statics" }, openBankingDoc.flow[4]!],
  sections: [
    {
      id: "findings",
      kind: "findings",
      items: [
        ...(openBankingDoc.sections[0] as { items: ReturnType<typeof text>[] }).items,
        text("Small fintechs gain most from cooperation when switching costs are low."),
      ],
    },
    openBankingDoc.sections[1]!,
    {
      id: "graph-2",
      kind: "graph",
      chart: {
        kind: "line",
        title: "Cooperation over time (%)",
        unit: "%",
        series: ["Retail", "SME"],
        rows: [
          { label: "Year one", values: [20, 15] },
          { label: "Year two", values: [35, 22] },
          { label: "Year three", values: [48, 30] },
        ],
      },
    },
    { id: "quote-1", kind: "quote", text: "A clear model of a question regulators keep asking.", name: "Dr Jane Doe", role: "Supervisor" },
    { id: "reflection-1", kind: "reflection", text: text("Test the model against real partnership data from UK banks.") },
    { id: "link-1", kind: "link", href: "https://example.com/open-banking-code", label: "Model code", description: "The replicator equations in SymPy" },
  ],
};

/**
 * The gallery sample (decision 0024): a campaign shown by its pictures. Fictional. Pictures need
 * stored files owned by the user, so it is a function of file ids (app/dev/portfolio makes the
 * files). Mixed shapes on purpose: a tall poster, story frames, a banner, a square. Not in
 * sampleSeeds, which other specs loop over: app/dev/portfolio adds it with `with=gallery`.
 */
export const GALLERY_IMAGES = [
  { w: 1200, h: 1600, alt: "A tall poster: a bold question in white on green, with the Law Society crest at the bottom.", caption: "The main poster, in the union and library" },
  { w: 1080, h: 1920, alt: "A phone story frame asking a question in large type over a green background.", caption: "Story frame one: the question" },
  { w: 1080, h: 1920, alt: "A phone story frame giving the answer and a sign-up link on a pale background.", caption: "Story frame two: the answer" },
  { w: 1600, h: 1200, alt: "The poster pinned to a noticeboard beside other society notices.", caption: "Poster on the union noticeboard" },
  { w: 2400, h: 800, alt: "A wide stall banner with the society name and a short slogan.", caption: "Stall banner at the freshers' fair" },
  { w: 1600, h: 1200, alt: "Three rough pencil sketches of poster ideas on one sheet.", caption: "Early sketch of the three ideas" },
  { w: 1080, h: 1080, alt: "A square grid of nine Instagram posts in matching green and white.", caption: "Instagram grid after week one" },
  { w: 1200, h: 1700, alt: "A flyer with the question on the front and a map of the stall on the back.", caption: "Flyer handed out at halls" },
];

export function galleryDoc(fileIds: string[]): ExhbtDoc {
  return {
    schemaVersion: SCHEMA_VERSION,
    format: "gallery",
    title: "Freshers' Week campaign for the Law Society",
    context: "BA Marketing, Year 2 module",
    whereWhen: "University of Leeds, October 2026",
    summary: "A poster and Instagram campaign that nearly doubled sign-ups.",
    skills: ["Campaign planning", "Canva", "Instagram", "Copywriting"],
    gap: [{ t: "The Law Society asked for a Freshers' Week campaign to reach " }, { t: "first-years who don't study law", b: true }, { t: "." }],
    flow: [
      { step: "Read the brief and past sign-ups" },
      { step: "Sketched three poster ideas" },
      { step: "Tested two with 20 students" },
      { step: "Ran posters and stories", detail: "two weeks" },
    ],
    sections: [
      { id: "findings", kind: "findings", items: [text("Sign-ups rose from 64 last year to 112."), text("41 of the 112 were not law students.")] },
      ...GALLERY_IMAGES.map((im, i): Section => ({ id: `image-${i + 1}`, kind: "image", fileId: fileIds[i] ?? `missing-${i + 1}`, alt: im.alt, caption: text(im.caption), w: im.w, h: im.h })),
      { id: "link-1", kind: "link", href: "https://example.com/law-society-film", label: "Watch the 30-second film", description: "Posted on the society's Instagram" },
      { id: "link-2", kind: "link", href: "https://example.com/law-society-posters", label: "See every poster", description: "" },
    ],
    evidence: { kind: "link", href: "https://example.com/law-society-campaign-deck.pdf", label: "Campaign deck (PDF)" },
  };
}

/**
 * The research sample (decision 0024): a small experiment shown as a poster. Fictional. It is a
 * function of one file id (its one picture). Stored in an order that is not the page's on purpose
 * (the aim is stored late), so the tests prove the page sets where each kind goes while the list
 * still picks the key figure: the graph, the first figure. About 193 words with no quote.
 */
export const RESEARCH_IMAGE = { w: 1600, h: 1100, alt: "A map of the quad with the ten-minute walking route drawn as a loop.", caption: "The walking route, 10 minutes round the quad" };

export function researchDoc(imageFileId: string): ExhbtDoc {
  return {
    schemaVersion: SCHEMA_VERSION,
    format: "research",
    title: "Does a 10-minute walk before a test improve recall in first-year students?",
    context: "BSc Psychology final-year project",
    whereWhen: "University of Sheffield, March 2026",
    summary: "Walking first gave a small rise in recall.",
    skills: ["Experimental design", "R", "t-tests", "Literature review"],
    gap: [{ t: "Exercise is known to lift mood. " }, { t: "Whether a short walk helps recall straight after is less clear.", b: true }],
    flow: [
      { step: "Recruited 48 first-years", detail: "volunteers, two groups" },
      { step: "Walk or sit, 10 minutes" },
      { step: "Word-list recall test", detail: "40 words" },
      { step: "Compared groups in R", detail: "t-test" },
    ],
    sections: [
      {
        id: "findings",
        kind: "findings",
        items: [
          text("The walking group recalled 21.4 words on average; the sitting group 19.1."),
          text("The difference was significant, t(46) = 2.1, p = .04."),
          text("The gap was largest for words in the first half of the list."),
        ],
      },
      { id: "conclusion-1", kind: "conclusion", text: text("A short walk before a test gave a small rise in recall, so the hypothesis was supported.") },
      {
        id: "graph-1",
        kind: "graph",
        chart: {
          kind: "bar",
          title: "Words recalled (mean of 40)",
          yTitle: "Words",
          rows: [
            { label: "Walked", value: 21.4 },
            { label: "Sat", value: 19.1 },
          ],
        },
      },
      { id: "image-1", kind: "image", fileId: imageFileId, alt: RESEARCH_IMAGE.alt, caption: text(RESEARCH_IMAGE.caption), w: RESEARCH_IMAGE.w, h: RESEARCH_IMAGE.h },
      { id: "aim-1", kind: "aim", heading: "hypothesis", text: text("Students who walk for 10 minutes before a word-list test will recall more words than students who sit.") },
      { id: "reflection-1", kind: "reflection", text: text("One university and volunteers only, and the test came straight after. Next I'd test recall a day later.") },
      {
        id: "link-1",
        kind: "link",
        href: "https://example.com/smith-lee-2021",
        label: "Smith and Lee 2021, Journal of Cognitive Psychology",
        description: "The recall test I adapted",
      },
    ],
    evidence: { kind: "link", href: "https://example.com/walk-recall-report.pdf", label: "Final report (PDF)" },
  };
}

/** The samples as they're stored by app/dev/portfolio: the GP one in the old layout. */
export const sampleSeeds: unknown[] = [legacyGpDoc, libraryDoc];

/** The samples as the app reads them (normaliseDoc): what the pages and tests compare against. */
export const sampleDocs: ExhbtDoc[] = sampleSeeds.map(normaliseDoc);
