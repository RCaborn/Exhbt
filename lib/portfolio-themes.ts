import { ENTITLEMENTS, type Plan } from "./entitlements";

/**
 * Portfolio looks (docs/decisions/0012-portfolio-themes.md). Each theme is a fixed, pre-checked
 * combination for the portfolio's header band: a ground, text colours, an accent, a heading face
 * and a photo shape. Nobody picks colours, so every combination can be checked once, here.
 *
 * Colours are DESIGN.md tokens, plus one darker jade (DEEP_JADE) used only as a band ground.
 * Every text pairing must reach WCAG AA (4.5:1); `e2e/phase2-themes.spec.ts` computes it for each
 * theme with `contrastRatio` below.
 *
 * Which plan unlocks which: the list is in order, and `portfolioThemes` in lib/entitlements.ts says
 * how many of the first themes a plan gets (Free the default only, Premium the next few, Max all).
 * Adding a theme at the end therefore never changes what Premium gets.
 */

// The brand tokens (DESIGN.md), as hex so the contrast maths can read them.
const INK = "#0e0f12";
const WHITE = "#ffffff";
const MINT = "#4fe9b4";
const JADE = "#00755d";
/** The one extra colour: a darker jade for a band ground. Documented in DESIGN.md and docs/brand.md. */
const DEEP_JADE = "#00513f";
const MIST = "#f6f7f8";
const WASH = "#e3fcf0";
const GRAPHITE = "#3e4044";
const ON_INK = "#c9cbcf";
const LINE = "#e5e6e8";

export type HeadingFace = "bricolage" | "inter-tight" | "space-grotesk" | "fraunces";
export type PhotoShape = "round" | "square";

/**
 * Heading faces. Bricolage Grotesque is the site's own display face; the other three are Google
 * fonts, loaded with next/font in components/portfolio/themeFonts.ts (kept out of here so this
 * file stays plain data the tests can import).
 */
export const HEADING_FACES: Record<HeadingFace, { label: string }> = {
  bricolage: { label: "Bricolage Grotesque" },
  "inter-tight": { label: "Inter Tight" },
  "space-grotesk": { label: "Space Grotesk" },
  fraunces: { label: "Fraunces" },
};

export type PortfolioTheme = {
  id: string;
  name: string;
  /** The band's ground. */
  bg: string;
  /** Name, bio and link text. */
  text: string;
  /** Headline and other secondary text. */
  soft: string;
  /** Small labels and link hovers on the band. */
  accent: string;
  /** Hairlines and chip outlines on the band (decorative; the text inside carries the meaning). */
  edge: string;
  /** The initials tile shown when there is no photo. */
  initials: { bg: string; text: string };
  face: HeadingFace;
  photo: PhotoShape;
};

const dark = (bg: string, soft: string, accent: string) => ({ bg, text: WHITE, soft, accent, edge: "#ffffff40", initials: { bg: MINT, text: INK } });
const light = (bg: string, edge: string) => ({ bg, text: INK, soft: GRAPHITE, accent: JADE, edge, initials: { bg: JADE, text: WHITE } });

/**
 * In order of who gets them: the first is the default (everyone), then the Premium set, then the
 * ones only Max has. Names are plain; the id is what is stored.
 */
export const PORTFOLIO_THEMES: readonly PortfolioTheme[] = [
  { id: "ink", name: "Ink", ...dark(INK, ON_INK, MINT), face: "bricolage", photo: "square" },
  { id: "jade", name: "Jade", ...dark(JADE, WASH, WASH), face: "bricolage", photo: "square" },
  { id: "mint", name: "Mint", bg: MINT, text: INK, soft: GRAPHITE, accent: INK, edge: "#0e0f1240", initials: { bg: INK, text: MINT }, face: "bricolage", photo: "round" },
  { id: "paper", name: "Paper", ...light(WHITE, LINE), face: "inter-tight", photo: "square" },
  { id: "mist", name: "Mist", ...light(MIST, LINE), face: "space-grotesk", photo: "round" },
  { id: "night", name: "Night", ...dark(INK, ON_INK, MINT), face: "space-grotesk", photo: "round" },
  // Max only from here.
  { id: "deep-jade", name: "Deep jade", ...dark(DEEP_JADE, WASH, MINT), face: "bricolage", photo: "square" },
  { id: "pine", name: "Pine", ...dark(DEEP_JADE, WASH, MINT), face: "inter-tight", photo: "round" },
  { id: "editorial", name: "Editorial", ...light(WHITE, LINE), face: "fraunces", photo: "square" },
  { id: "folio", name: "Folio", ...dark(INK, ON_INK, MINT), face: "fraunces", photo: "round" },
  { id: "meadow", name: "Meadow", bg: MINT, text: INK, soft: GRAPHITE, accent: INK, edge: "#0e0f1240", initials: { bg: INK, text: MINT }, face: "fraunces", photo: "round" },
  { id: "fresh", name: "Fresh", ...light(WASH, "#00755d40"), face: "inter-tight", photo: "round" },
  { id: "studio", name: "Studio", ...light(MIST, LINE), face: "bricolage", photo: "square" },
  { id: "circuit", name: "Circuit", ...dark(JADE, WASH, WASH), face: "space-grotesk", photo: "square" },
  { id: "drift", name: "Drift", ...dark(DEEP_JADE, WASH, MINT), face: "space-grotesk", photo: "round" },
  { id: "chalk", name: "Chalk", ...light(WHITE, LINE), face: "space-grotesk", photo: "round" },
];

export const DEFAULT_THEME: PortfolioTheme = PORTFOLIO_THEMES[0]!;

export function themeById(id: string | null | undefined): PortfolioTheme | undefined {
  return id ? PORTFOLIO_THEMES.find((t) => t.id === id) : undefined;
}

/** How many of the list a plan may use (`portfolioThemes` in lib/entitlements.ts). */
export function themeAllowance(plan: Plan): number {
  const n = ENTITLEMENTS[plan].portfolioThemes;
  return n === "all" ? PORTFOLIO_THEMES.length : Math.min(n, PORTFOLIO_THEMES.length);
}

export function themeAllowedOn(plan: Plan, theme: PortfolioTheme): boolean {
  return PORTFOLIO_THEMES.indexOf(theme) < themeAllowance(plan);
}

/** The cheapest plan that has this theme, for the upgrade offer. */
export function planForTheme(theme: PortfolioTheme): Exclude<Plan, "institutional"> {
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

/* WCAG 2.x contrast */

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

/** Every text pairing on a theme's band, with a label, for the contrast test. */
export function textPairs(t: PortfolioTheme): { label: string; fg: string; bg: string }[] {
  return [
    { label: "name and bio", fg: t.text, bg: t.bg },
    { label: "headline", fg: t.soft, bg: t.bg },
    { label: "labels and link hover", fg: t.accent, bg: t.bg },
    { label: "initials", fg: t.initials.text, bg: t.initials.bg },
  ];
}
