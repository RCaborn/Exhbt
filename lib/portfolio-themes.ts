import { ENTITLEMENTS, type Plan } from "./entitlements";

/**
 * Portfolio looks (docs/decisions/0018-portfolio-looks.md, from Rory's spec,
 * docs/design/portfolio-and-exhbt-layouts.pdf pages 3 and 4). Eight looks, each a fixed and
 * pre-checked set of colours, faces, corners and a few layout treatments. A look styles the whole
 * portfolio: the home page (components/portfolio/PortfolioHome.tsx) and every exhbt page
 * (components/portfolio/ProjectView.tsx), through one set of CSS variables (`themeStyle` in
 * components/portfolio/themeFonts.ts). Three looks come in a few colourways, picked from swatches.
 *
 * Plain data, safe in the browser and in tests. Every colour is an opaque #rrggbb so the contrast
 * maths (`contrastPairs`, checked in e2e/phase2-looks.spec.ts) reads exactly what is drawn.
 *
 * Who gets which: the looks are in order, and `portfolioThemes` in lib/entitlements.ts says how
 * many from the start of the list a plan has. The order is the plan split, so don't reorder it.
 */

/* ---------- Colours ---------- */

// The brand tokens (DESIGN.md).
const INK = "#0e0f12";
const WHITE = "#ffffff";
const MINT = "#4fe9b4";
const MINT_PRESS = "#36dda4";
const JADE = "#00755d";
const MIST = "#f6f7f8";
const WASH = "#e3fcf0";
const GRAPHITE = "#3e4044";
/** Captions and years. A shade darker than the brand's slate (#6f7278), so they also pass on the grey wells. */
const FAINT = "#686b71";
const LINE = "#e5e6e8";
const ON_INK = "#c9cbcf";

const hex2 = (n: number) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, "0");
const rgbOf = (hex: string) => [0, 1, 2].map((i) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16)) as [number, number, number];

/** `a` mixed with `b`: t = 0 is a, 1 is b (sRGB, like CSS color-mix). Always an opaque #rrggbb. */
export function mix(a: string, b: string, t: number): string {
  const [x, y] = [rgbOf(a), rgbOf(b)];
  return `#${x.map((v, i) => hex2(v + (y[i]! - v) * t)).join("")}`;
}

/** Ink or white, whichever reads better on `bg`. */
const textOn = (bg: string) => (contrastRatio(INK, bg) >= contrastRatio(WHITE, bg) ? INK : WHITE);

/** Secondary text on a coloured `bg`: `on` (ink or white) toned towards `bg` as far as it still reads (4.6:1). */
function softOn(bg: string, on: string): string {
  for (let t = 0.3; t > 0; t -= 0.02) {
    const c = mix(on, bg, t);
    if (contrastRatio(c, bg) >= 4.6) return c;
  }
  return on;
}

/* ---------- What a look is ---------- */

export type LookId = "exhbt" | "classic" | "notebook" | "mono" | "night" | "studio" | "ledger" | "bloom";

/**
 * Faces a look can use. Bricolage Grotesque and Inter are the site's own (self-hosted); the rest
 * load with next/font in components/portfolio/themeFonts.ts, and a browser downloads one only when
 * text on the page uses it, so a portfolio fetches its own look's faces and nothing else.
 */
export type FontKey = "bricolage" | "inter" | "inter-tight" | "newsreader" | "jetbrains-mono" | "plex-sans" | "nunito";
export const FONTS: Record<FontKey, { label: string }> = {
  bricolage: { label: "Bricolage Grotesque" },
  inter: { label: "Inter" },
  "inter-tight": { label: "Inter Tight" },
  newsreader: { label: "Newsreader" },
  "jetbrains-mono": { label: "JetBrains Mono" },
  "plex-sans": { label: "IBM Plex Sans" },
  nunito: { label: "Nunito" },
};

export type PhotoShape = "round" | "square";

/** Every colour a look sets. Each becomes a `--pf-*` (or `--band-*`, `--chart-*`) variable; see `themeStyle`. */
export type Palette = {
  /** The page's ground, behind everything (both pages). */
  ground: string;
  /** Body text. */
  ink: string;
  /** The name, titles and section headings. */
  heading: string;
  /** Secondary text: the intro, summaries, labels. */
  soft: string;
  /** Captions, years, small print. */
  faint: string;
  /** Hairlines between rows and facts (decorative). */
  line: string;
  /** The strong rule: under "What I found", above a masthead, round a ledger. */
  rule: string;
  /** Card and box edges. */
  edge: string;
  /** Cards: project cards, flowchart boxes. */
  card: string;
  /** The quiet fill: the sidebar's person card, the link card, a key figure's well. */
  well: string;
  /** The well's edge (the well's own colour when it has none). */
  wellEdge: string;
  /** The card a graph or image sits in. Charts colour themselves for it. */
  figure: string;
  /** Links on the ground (`--pf-accent`, its name from decision 0016). */
  link: string;
  /** Small buttons: the top bar's "Get in touch". */
  button: string;
  buttonInk: string;
  /** The one main action: "See the work". */
  action: string;
  actionInk: string;
  actionHover: string;
  /** The highlighted gap in an exhbt's context line. */
  highlight: string;
  highlightInk: string;
  /** Filled ticks (and the quote's rule). */
  tick: string;
  tickInk: string;
  /** Skill pills. */
  pill: string;
  pillInk: string;
  pillEdge: string;
  /** The flowchart's last box, and its detail line. */
  flowEnd: string;
  flowEndInk: string;
  flowEndSoft: string;
  /** Initials when there's no photo. */
  avatar: string;
  avatarInk: string;
  /** The one coloured surface: the best-work band. Its button is bandInk on band. */
  band: string;
  bandInk: string;
  bandSoft: string;
  bandAccent: string;
  bandEdge: string;
  /** Graphs: one hue in two shades. Strong is the highlighted series and "after"; soft is "before". */
  chartStrong: string;
  chartSoft: string;
  /** Four steps of the same hue, strongest first, for graphs with several series. */
  chartRamp: readonly [string, string, string, string];
};

/** Corners and lines. */
export type Shape = {
  /** Cards. */
  radius: string;
  /** Panels: the band's figure card, the sidebar card. */
  radiusLarge: string;
  /** Flowchart boxes and the highlight. */
  radiusBox: string;
  radiusPill: string;
  radiusButton: string;
  /** Card and box edges. */
  edgeWidth: string;
  /** Hairlines between rows: solid, or dashed (Mono). */
  ruleStyle: "solid" | "dashed";
};

export type TypeSet = {
  /** The name, titles and headings. */
  display: FontKey;
  /** Everything else. */
  body: FontKey;
  /** The intro under the name and the exhbt's context line: in the body face, or the display face (Classic's serif). */
  lead: "display" | "body";
  displayWeight: number;
  /** Tracking of large display text. */
  tracking: string;
};

/**
 * The layout treatments: how a look arranges the same content (the words never change).
 * - hero: the top of the home page. "portrait" (photo beside the name), "masthead" (a rule over a
 *   serif name), "notes" (the name over property rows), "terminal" (the address as a path),
 *   "block" (one loud block with the photo or initials), "ledger" (ruled rows with figures),
 *   "greeting" (a friendly "Hi, I'm" beside a ringed photo).
 * - band: the best-work band runs edge to edge ("bleed"), sits inside the page as a panel
 *   ("inset"), or is white between rules ("ruled").
 * - work: more of the work as cards with key figures, as a list of links, or as a numbered index.
 * - cta: the band's "See how I did it": a button in the band's own colours turned round ("inverse"), the look's main
 *   button ("action"), or an underlined link ("link").
 */
export type Treatment = {
  hero: "portrait" | "masthead" | "notes" | "terminal" | "block" | "ledger" | "greeting";
  band: "bleed" | "inset" | "ruled";
  work: "cards" | "list" | "index";
  cta: "inverse" | "action" | "link";
};

/** One concrete look: a look in one of its colourways. This is what a page draws. */
export type PortfolioTheme = {
  /** What is stored (`profiles.portfolio_theme`): the look's id, or `<look>-<colourway>`. */
  id: string;
  look: LookId;
  /** The look's name ("Classic professional"). */
  name: string;
  /** The PDF's one-line description, for the picker. */
  blurb: string;
  /** Who it suits, for the picker. */
  suits: string;
  /** The colourway, when the look has several. */
  variant?: { id: string; name: string; swatch: string };
  photo: PhotoShape;
  palette: Palette;
  shape: Shape;
  type: TypeSet;
  treatment: Treatment;
  // The look in brief, as small swatches show it (the marketing home, the demo band, the tab icon):
  /** The look's signature surface. */
  bg: string;
  /** Text on it. */
  text: string;
  /** Secondary text on it. */
  soft: string;
  /** A small label on it. */
  accent: string;
  edge: string;
  initials: { bg: string; text: string };
  /** The display face. */
  face: FontKey;
};

/* ---------- The looks ---------- */

type Base = Omit<PortfolioTheme, "id" | "variant" | "bg" | "text" | "soft" | "accent" | "edge" | "initials" | "face">;

/** A ramp of four steps from the strong shade towards the soft one, for multi-series graphs. */
const ramp = (strong: string, soft: string, end = 0.82): Palette["chartRamp"] =>
  [strong, mix(strong, soft, end / 3), mix(strong, soft, (2 * end) / 3), mix(strong, soft, end)] as const;

/** A light page in one deep colour: shared by Classic, Ledger and the light Studio colourways. */
function lightPalette(p: Partial<Palette> & { deep: string }): Palette {
  const { deep, ...rest } = p;
  const soft = mix(deep, WHITE, 0.62);
  return {
    ground: WHITE,
    ink: INK,
    heading: INK,
    soft: GRAPHITE,
    faint: FAINT,
    line: LINE,
    rule: INK,
    edge: LINE,
    card: WHITE,
    well: MIST,
    wellEdge: MIST,
    figure: WHITE,
    link: deep,
    button: INK,
    buttonInk: WHITE,
    action: deep,
    actionInk: textOn(deep),
    actionHover: mix(deep, INK, 0.25),
    highlight: mix(deep, WHITE, 0.86),
    highlightInk: INK,
    tick: deep,
    tickInk: textOn(deep),
    pill: MIST,
    pillInk: INK,
    pillEdge: MIST,
    flowEnd: INK,
    flowEndInk: WHITE,
    flowEndSoft: ON_INK,
    avatar: deep,
    avatarInk: textOn(deep),
    band: WHITE,
    bandInk: INK,
    bandSoft: GRAPHITE,
    bandAccent: deep,
    bandEdge: INK,
    chartStrong: deep,
    chartSoft: soft,
    chartRamp: ramp(deep, soft),
    ...rest,
  };
}

const EXHBT: Base = {
  look: "exhbt",
  name: "Exhbt",
  blurb: "White, mint and rounded. Matches the exhbt site.",
  suits: "Any role",
  photo: "round",
  palette: {
    ground: WHITE,
    ink: INK,
    heading: INK,
    soft: GRAPHITE,
    faint: FAINT,
    line: LINE,
    rule: INK,
    edge: LINE,
    card: WHITE,
    well: MIST,
    wellEdge: MIST,
    figure: WHITE,
    link: JADE,
    button: INK,
    buttonInk: WHITE,
    action: MINT,
    actionInk: INK,
    actionHover: MINT_PRESS,
    highlight: mix(MINT, WHITE, 0.58),
    highlightInk: INK,
    tick: JADE,
    tickInk: WHITE,
    pill: MIST,
    pillInk: INK,
    pillEdge: MIST,
    flowEnd: INK,
    flowEndInk: WHITE,
    flowEndSoft: ON_INK,
    avatar: MINT,
    avatarInk: INK,
    band: WASH,
    bandInk: INK,
    bandSoft: GRAPHITE,
    bandAccent: JADE,
    bandEdge: WASH,
    // The brand's own pair and ramp (components/charts/series.ts, decision 0011).
    chartStrong: JADE,
    chartSoft: MINT,
    chartRamp: ["#00755d", "#179274", "#2aaf89", "#3dcc9f"],
  },
  shape: { radius: "16px", radiusLarge: "24px", radiusBox: "12px", radiusPill: "8px", radiusButton: "999px", edgeWidth: "1px", ruleStyle: "solid" },
  type: { display: "bricolage", body: "inter", lead: "body", displayWeight: 600, tracking: "-0.035em" },
  treatment: { hero: "portrait", band: "bleed", work: "cards", cta: "inverse" },
};

const CLASSIC: Base = {
  look: "classic",
  name: "Classic professional",
  blurb: "Serif name, sharp corners, mostly black and white, one deep accent.",
  suits: "Law, policy, finance and research",
  photo: "square",
  palette: lightPalette({ deep: "#14463a" }),
  shape: { radius: "0px", radiusLarge: "0px", radiusBox: "0px", radiusPill: "0px", radiusButton: "0px", edgeWidth: "1px", ruleStyle: "solid" },
  type: { display: "newsreader", body: "inter", lead: "display", displayWeight: 600, tracking: "-0.015em" },
  treatment: { hero: "masthead", band: "ruled", work: "cards", cta: "link" },
};

const NOTEBOOK: Base = {
  look: "notebook",
  name: "Notebook",
  blurb: "A plain page, property rows and the work as a list of links, like a personal notes page.",
  suits: "Product, operations and generalist roles",
  photo: "round",
  palette: {
    ...lightPalette({ deep: INK }),
    soft: "#37383c",
    faint: "#686b71",
    link: INK,
    action: INK,
    actionInk: WHITE,
    actionHover: GRAPHITE,
    highlight: "#fbf0c4",
    tick: INK,
    tickInk: WHITE,
    pill: "#edeef0",
    pillEdge: "#edeef0",
    avatar: "#edeef0",
    avatarInk: INK,
    band: MIST,
    bandEdge: MIST,
    bandAccent: "#61646a",
    rule: "#d7d8db",
    chartStrong: "#2f3237",
    chartSoft: "#a9acb2",
    chartRamp: ramp("#2f3237", "#a9acb2", 0.85),
  },
  shape: { radius: "10px", radiusLarge: "12px", radiusBox: "8px", radiusPill: "5px", radiusButton: "8px", edgeWidth: "1px", ruleStyle: "solid" },
  type: { display: "inter", body: "inter", lead: "body", displayWeight: 600, tracking: "-0.03em" },
  treatment: { hero: "notes", band: "inset", work: "list", cta: "inverse" },
};

const MONO: Base = {
  look: "mono",
  name: "Mono",
  blurb: "Monospace type, hairline boxes, no colour.",
  suits: "Engineering, data and quant roles",
  photo: "square",
  palette: {
    ...lightPalette({ deep: INK }),
    faint: "#62656b",
    edge: INK,
    rule: INK,
    line: "#b9bbc0",
    well: WHITE,
    wellEdge: INK,
    pill: WHITE,
    pillEdge: INK,
    link: INK,
    action: INK,
    actionInk: WHITE,
    actionHover: GRAPHITE,
    highlight: INK,
    highlightInk: WHITE,
    tick: INK,
    tickInk: WHITE,
    avatar: WHITE,
    avatarInk: INK,
    band: WHITE,
    bandEdge: INK,
    bandAccent: GRAPHITE,
    chartStrong: INK,
    chartSoft: "#a7aab0",
    chartRamp: ramp(INK, "#a7aab0", 0.8),
  },
  shape: { radius: "0px", radiusLarge: "0px", radiusBox: "0px", radiusPill: "0px", radiusButton: "0px", edgeWidth: "1px", ruleStyle: "dashed" },
  type: { display: "jetbrains-mono", body: "jetbrains-mono", lead: "body", displayWeight: 700, tracking: "-0.02em" },
  treatment: { hero: "terminal", band: "inset", work: "index", cta: "inverse" },
};

// Night: the dark look. Its graphs are drawn on its own dark figure card, mint as the strong shade.
const N_GROUND = INK;
const N_CARD = "#17191d";
const N_RAISED = "#1d2025";
const N_LINE = "#2c2f35";
const NIGHT: Base = {
  look: "night",
  name: "Night",
  blurb: "A dark ground and white type.",
  suits: "Design, tech and media roles",
  photo: "round",
  palette: {
    ground: N_GROUND,
    ink: WHITE,
    heading: WHITE,
    soft: ON_INK,
    faint: "#9da0a7",
    line: N_LINE,
    rule: WHITE,
    edge: N_LINE,
    card: N_CARD,
    well: N_RAISED,
    wellEdge: N_RAISED,
    figure: N_CARD,
    link: MINT,
    button: WHITE,
    buttonInk: INK,
    action: WHITE,
    actionInk: INK,
    actionHover: LINE,
    highlight: "#0f5544",
    highlightInk: WHITE,
    tick: MINT,
    tickInk: INK,
    pill: N_RAISED,
    pillInk: WHITE,
    pillEdge: N_RAISED,
    flowEnd: MINT,
    flowEndInk: INK,
    flowEndSoft: "#14382d",
    avatar: MINT,
    avatarInk: INK,
    band: N_CARD,
    bandInk: WHITE,
    bandSoft: ON_INK,
    bandAccent: MINT,
    bandEdge: N_LINE,
    // On a dark ground the highlighted series is the light shade.
    chartStrong: MINT,
    chartSoft: "#2a8a6d",
    chartRamp: [MINT, "#3cbf93", "#2e9675", "#237158"],
  },
  shape: { radius: "16px", radiusLarge: "24px", radiusBox: "12px", radiusPill: "8px", radiusButton: "999px", edgeWidth: "1px", ruleStyle: "solid" },
  type: { display: "inter-tight", body: "inter", lead: "body", displayWeight: 700, tracking: "-0.04em" },
  treatment: { hero: "portrait", band: "bleed", work: "cards", cta: "inverse" },
};

const STUDIO_BASE = {
  look: "studio",
  name: "Studio",
  blurb: "One loud block of your colour, very heavy type, square corners.",
  suits: "Creative and marketing roles",
  photo: "square",
  shape: { radius: "0px", radiusLarge: "0px", radiusBox: "0px", radiusPill: "0px", radiusButton: "0px", edgeWidth: "2px", ruleStyle: "solid" },
  type: { display: "inter-tight", body: "inter", lead: "body", displayWeight: 900, tracking: "-0.05em" },
  treatment: { hero: "block", band: "bleed", work: "cards", cta: "inverse" },
} as const satisfies Omit<Base, "palette">;

/** Studio in one colour: the block, the band and the flowchart's last box take it; buttons stay black. */
function studio(colour: string, strong = colour): Palette {
  const on = textOn(colour);
  const soft = mix(strong, WHITE, 0.6);
  return {
    ...lightPalette({ deep: strong }),
    edge: INK,
    rule: INK,
    pill: "#f1f1ef",
    pillEdge: "#f1f1ef",
    well: "#f4f4f2",
    wellEdge: "#f4f4f2",
    link: INK,
    action: INK,
    actionInk: WHITE,
    actionHover: GRAPHITE,
    highlight: mix(colour, WHITE, 0.7),
    tick: contrastRatio(colour, WHITE) >= 3 ? colour : INK,
    tickInk: contrastRatio(colour, WHITE) >= 3 ? on : WHITE,
    flowEnd: colour,
    flowEndInk: on,
    flowEndSoft: softOn(colour, on),
    avatar: colour,
    avatarInk: on,
    band: colour,
    bandInk: on,
    bandSoft: softOn(colour, on),
    bandAccent: on,
    bandEdge: colour,
    chartStrong: strong,
    chartSoft: soft,
    chartRamp: ramp(strong, soft),
  };
}

const LEDGER_GREEN = "#0c3b2e";
const LEDGER: Base = {
  look: "ledger",
  name: "Ledger",
  blurb: "Ruled rows, aligned figures, deep green.",
  suits: "Finance, accounting and consulting roles",
  photo: "square",
  palette: lightPalette({
    deep: LEDGER_GREEN,
    heading: LEDGER_GREEN,
    faint: "#5f6266",
    rule: LEDGER_GREEN,
    well: "#f3f6f4",
    wellEdge: "#f3f6f4",
    pill: "#eaf0ed",
    pillInk: LEDGER_GREEN,
    pillEdge: "#eaf0ed",
    flowEnd: LEDGER_GREEN,
    flowEndSoft: "#bcd2c9",
    bandEdge: LEDGER_GREEN,
    link: "#14614a",
    chartStrong: "#14614a",
    chartSoft: "#9cc4b5",
    chartRamp: ramp("#14614a", "#9cc4b5", 0.9),
  }),
  shape: { radius: "2px", radiusLarge: "2px", radiusBox: "2px", radiusPill: "2px", radiusButton: "2px", edgeWidth: "1px", ruleStyle: "solid" },
  type: { display: "plex-sans", body: "plex-sans", lead: "body", displayWeight: 600, tracking: "-0.02em" },
  treatment: { hero: "ledger", band: "ruled", work: "cards", cta: "action" },
};

const BLOOM_BASE = {
  look: "bloom",
  name: "Bloom",
  blurb: "A soft pastel ground in a choice of four, round shapes and a friendly greeting.",
  suits: "Teaching, healthcare and people roles",
  photo: "round",
  shape: { radius: "22px", radiusLarge: "28px", radiusBox: "16px", radiusPill: "999px", radiusButton: "999px", edgeWidth: "1px", ruleStyle: "solid" },
  type: { display: "nunito", body: "nunito", lead: "body", displayWeight: 800, tracking: "-0.015em" },
  treatment: { hero: "greeting", band: "inset", work: "cards", cta: "action" },
} as const satisfies Omit<Base, "palette">;

/** Bloom on one pastel: the ground is the pastel, cards are white, the deep partner colour does the work. */
function bloom(ground: string, swatch: string, deep: string): Palette {
  const soft = mix(deep, WHITE, 0.55);
  return {
    ground,
    ink: INK,
    heading: INK,
    soft: GRAPHITE,
    faint: "#5c5e64",
    line: mix(swatch, deep, 0.12),
    rule: deep,
    edge: mix(swatch, ground, 0.3),
    card: WHITE,
    well: mix(ground, WHITE, 0.55),
    wellEdge: mix(swatch, ground, 0.3),
    figure: WHITE,
    link: deep,
    button: deep,
    buttonInk: WHITE,
    action: deep,
    actionInk: WHITE,
    actionHover: mix(deep, INK, 0.25),
    highlight: swatch,
    highlightInk: INK,
    tick: deep,
    tickInk: WHITE,
    pill: WHITE,
    pillInk: INK,
    pillEdge: mix(swatch, ground, 0.3),
    flowEnd: deep,
    flowEndInk: WHITE,
    flowEndSoft: softOn(deep, WHITE),
    avatar: WHITE,
    avatarInk: deep,
    band: WHITE,
    bandInk: INK,
    bandSoft: GRAPHITE,
    bandAccent: deep,
    bandEdge: WHITE,
    chartStrong: deep,
    chartSoft: soft,
    chartRamp: ramp(deep, soft),
  };
}

type VariantDef = { id: string; name: string; swatch: string; palette: Palette };

/** The looks in plan order (Free: the first; Premium: the first few; Max: all), each with its colourways (the first is the default). */
export const LOOKS: readonly { base: Omit<Base, "palette">; variants: readonly VariantDef[] }[] = [
  { base: EXHBT, variants: [{ id: "", name: "", swatch: MINT, palette: EXHBT.palette }] },
  {
    base: CLASSIC,
    variants: [
      { id: "", name: "Deep green", swatch: "#14463a", palette: CLASSIC.palette },
      { id: "burgundy", name: "Burgundy", swatch: "#7b1f2c", palette: lightPalette({ deep: "#7b1f2c" }) },
      { id: "black", name: "Black", swatch: INK, palette: lightPalette({ deep: INK, chartSoft: "#a3a6ac", chartRamp: ramp(INK, "#a3a6ac", 0.85) }) },
      { id: "ochre", name: "Ochre", swatch: "#8a6a1f", palette: lightPalette({ deep: "#80621a", chartStrong: "#80621a", chartSoft: "#d8c28c", chartRamp: ramp("#80621a", "#d8c28c", 0.8) }) },
    ],
  },
  { base: NOTEBOOK, variants: [{ id: "", name: "", swatch: "#edeef0", palette: NOTEBOOK.palette }] },
  { base: MONO, variants: [{ id: "", name: "", swatch: INK, palette: MONO.palette }] },
  { base: NIGHT, variants: [{ id: "", name: "", swatch: INK, palette: NIGHT.palette }] },
  {
    base: STUDIO_BASE,
    variants: [
      { id: "", name: "Vermilion", swatch: "#d3381c", palette: studio("#d3381c") },
      { id: "green", name: "Green", swatch: "#087a56", palette: studio("#087a56") },
      { id: "pink", name: "Pink", swatch: "#fb4a98", palette: studio("#fb4a98", "#c81f6c") },
      { id: "mint", name: "Mint", swatch: MINT, palette: studio(MINT, JADE) },
      { id: "black", name: "Black", swatch: INK, palette: { ...studio(INK), chartSoft: "#a3a6ac", chartRamp: ramp(INK, "#a3a6ac", 0.85) } },
    ],
  },
  { base: LEDGER, variants: [{ id: "", name: "", swatch: LEDGER_GREEN, palette: LEDGER.palette }] },
  {
    base: BLOOM_BASE,
    variants: [
      { id: "", name: "Pink", swatch: "#fed3e2", palette: bloom("#ffedf3", "#fed3e2", "#c6146a") },
      { id: "mint", name: "Mint", swatch: "#caf5e1", palette: bloom("#e9f9f1", "#caf5e1", "#00704f") },
      { id: "lavender", name: "Lavender", swatch: "#e0d8ff", palette: bloom("#f3f0ff", "#e0d8ff", "#5a3dc0") },
      { id: "blue", name: "Blue", swatch: "#d2e6ff", palette: bloom("#ecf4ff", "#d2e6ff", "#1c5bb3") },
    ],
  },
];

function resolve(base: Omit<Base, "palette">, v: VariantDef, multi: boolean): PortfolioTheme {
  const p = v.palette;
  // The look in brief: its signature surface (Studio's block, Night's ground, Bloom's pastel, else its band).
  const sig =
    base.look === "studio" ? { bg: p.band, text: p.bandInk, soft: p.bandSoft, accent: p.bandAccent }
    : base.look === "bloom" || base.look === "night" ? { bg: p.ground, text: p.heading, soft: p.soft, accent: p.link }
    : base.treatment.band === "bleed" ? { bg: p.band, text: p.bandInk, soft: p.bandSoft, accent: p.bandAccent }
    : { bg: p.ground, text: p.heading, soft: p.soft, accent: p.link };
  return {
    ...base,
    id: v.id ? `${base.look}-${v.id}` : base.look,
    ...(multi ? { variant: { id: v.id || "default", name: v.name, swatch: v.swatch } } : {}),
    palette: p,
    ...sig,
    edge: p.line,
    initials: { bg: p.avatar, text: p.avatarInk },
    face: base.type.display,
  };
}

/** Every look in every colourway, by look in plan order. */
export const ALL_THEMES: readonly PortfolioTheme[] = LOOKS.flatMap((l) => l.variants.map((v) => resolve(l.base, v, l.variants.length > 1)));

/** The eight looks, each in its default colourway, in plan order: what a picker lists. */
export const PORTFOLIO_THEMES: readonly PortfolioTheme[] = LOOKS.map((l) => resolve(l.base, l.variants[0]!, l.variants.length > 1));

export const DEFAULT_THEME: PortfolioTheme = PORTFOLIO_THEMES[0]!;

/** A look's colourways (one entry for a look with none). */
export function variantsOf(look: LookId): PortfolioTheme[] {
  return ALL_THEMES.filter((t) => t.look === look);
}

/**
 * Ids saved before the eight looks (decision 0012's sixteen, 13 Nov 2026) and the look each now
 * shows, chosen by what it looked like. "night" and "studio" kept their ids, so a saved "studio"
 * (then a quiet grey band) is now the loud Studio; nothing live used it (decision 0018).
 */
export const LEGACY_IDS: Readonly<Record<string, string>> = {
  ink: "night",
  jade: "studio-green",
  mint: "exhbt",
  paper: "notebook",
  mist: "notebook",
  "deep-jade": "ledger",
  pine: "ledger",
  editorial: "classic",
  folio: "classic-black",
  meadow: "bloom-mint",
  fresh: "exhbt",
  circuit: "mono",
  drift: "ledger",
  chalk: "notebook",
};

/** The look a stored id means: a current id, an old id through LEGACY_IDS, else nothing. */
export function themeById(id: string | null | undefined): PortfolioTheme | undefined {
  if (!id) return undefined;
  const target = LEGACY_IDS[id] ?? id;
  return ALL_THEMES.find((t) => t.id === target);
}

/** Where a look sits in the plan order (0 is the default). */
const lookIndex = (t: Pick<PortfolioTheme, "look">) => LOOKS.findIndex((l) => l.base.look === t.look);

/** How many of the looks a plan may use (`portfolioThemes` in lib/entitlements.ts). */
export function themeAllowance(plan: Plan): number {
  const n = ENTITLEMENTS[plan].portfolioThemes;
  return n === "all" ? LOOKS.length : Math.min(n, LOOKS.length);
}

/** A look's colourways all come with the look. */
export function themeAllowedOn(plan: Plan, theme: Pick<PortfolioTheme, "look">): boolean {
  const i = lookIndex(theme);
  return i >= 0 && i < themeAllowance(plan);
}

/** The cheapest plan that has this look, for the upgrade offer. */
export function planForTheme(theme: Pick<PortfolioTheme, "look">): Exclude<Plan, "institutional"> {
  return (["free", "premium", "max"] as const).find((p) => themeAllowedOn(p, theme)) ?? "max";
}

/**
 * The look a portfolio shows: the one the person chose if their plan has it, else the default.
 * The stored choice is never changed here, so a person who upgrades again gets their look back.
 */
export function themeFor(profile: { themeId?: string | null }, plan: Plan): PortfolioTheme {
  const chosen = themeById(profile.themeId);
  return chosen && themeAllowedOn(plan, chosen) ? chosen : DEFAULT_THEME;
}

/* ---------- WCAG 2.x contrast ---------- */

function channel(hex: string, i: number): number {
  const v = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}
function luminance(hex: string): number {
  return 0.2126 * channel(hex, 0) + 0.7152 * channel(hex, 1) + 0.0722 * channel(hex, 2);
}
/** The WCAG contrast ratio of two #rrggbb colours, from 1 to 21. */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Every pairing a look puts on screen, by what actually sits on what, with the ratio it must
 * reach: 4.5 for text (WCAG AA; there is no large-text discount here), 3 for ticks and the strong
 * graph shade (non-text contrast), and the graph rules from DESIGN.md (the soft shade at least as
 * visible as the brand's mint on white, the two shades well apart, the ramp's lightest step at 2:1).
 */
export function contrastPairs(t: PortfolioTheme): { label: string; fg: string; bg: string; min: number }[] {
  const p = t.palette;
  const text = (label: string, fg: string, bg: string) => ({ label, fg, bg, min: 4.5 });
  const graphic = (label: string, fg: string, bg: string, min = 3) => ({ label, fg, bg, min });
  return [
    // Both pages, on the ground.
    text("body text on the ground", p.ink, p.ground),
    text("name and headings on the ground", p.heading, p.ground),
    text("secondary text on the ground", p.soft, p.ground),
    text("captions and years on the ground", p.faint, p.ground),
    text("links on the ground", p.link, p.ground),
    // Cards (project cards, flowchart boxes, the pager, the sign-off).
    text("text on cards", p.ink, p.card),
    text("headings on cards", p.heading, p.card),
    text("secondary text on cards", p.soft, p.card),
    text("captions on cards", p.faint, p.card),
    // The well (sidebar person card, link card, facts, the nav's hover).
    text("text on the well", p.ink, p.well),
    text("secondary text on the well", p.soft, p.well),
    text("captions on the well", p.faint, p.well),
    // Graph and image cards, chart labels included.
    text("chart labels and values", p.ink, p.figure),
    text("chart axis titles and captions", p.soft, p.figure),
    text("chart ticks", p.faint, p.figure),
    // Controls.
    text("small buttons", p.buttonInk, p.button),
    text("the main button (See the work)", p.actionInk, p.action),
    text("the main button on hover", p.actionInk, p.actionHover),
    text("skill pills", p.pillInk, p.pill),
    text("the highlighted gap", p.highlightInk, p.highlight),
    graphic("a filled tick on the ground", p.tick, p.ground),
    graphic("the check inside a tick", p.tickInk, p.tick),
    // The flowchart's last box.
    text("the last flowchart box", p.flowEndInk, p.flowEnd),
    text("the last box's detail line", p.flowEndSoft, p.flowEnd),
    // Initials.
    text("initials", p.avatarInk, p.avatar),
    // The best-work band.
    text("text on the band", p.bandInk, p.band),
    text("secondary text on the band", p.bandSoft, p.band),
    text("the band's label and badge", p.bandAccent, p.band),
    text("the band's button", p.band, p.bandInk),
    // Graphs (one hue, two shades), on their card.
    graphic("the strong graph shade", p.chartStrong, p.figure),
    graphic("the soft graph shade", p.chartSoft, p.figure, 1.4),
    graphic("the two graph shades apart", p.chartStrong, p.chartSoft, 2.5),
    graphic("the ramp's lightest step", p.chartRamp[3], p.figure, 2),
    text("a highlighted row or tile in a graph", p.ink, chartWash(p)),
  ];
}

/** The tint behind a table graph's highlighted row and a highlighted number tile: the strong shade, faintly, on the graph's card. */
export const chartWash = (p: Pick<Palette, "figure" | "chartStrong">) => mix(p.figure, p.chartStrong, 0.12);
