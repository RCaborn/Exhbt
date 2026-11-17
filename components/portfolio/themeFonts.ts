import { IBM_Plex_Sans, Inter_Tight, JetBrains_Mono, Newsreader, Nunito } from "next/font/google";
import { chartWash, contrastRatio, DEFAULT_THEME, type FontKey, type PortfolioTheme } from "@/lib/portfolio-themes";

/*
 * The faces a portfolio look can use besides the site's own Bricolage Grotesque and Inter
 * (decision 0018). Variable fonts, latin and latin-ext (names with accents), no preload: each is an
 * @font-face rule, and a browser downloads a file only when text on the page uses that face, so a
 * portfolio fetches its own look's faces and no others. The builder's look step shows every look,
 * so it fetches them all.
 */
// (next/font reads these options at build time, so each call spells them out.)
const interTight = Inter_Tight({ subsets: ["latin", "latin-ext"], display: "swap", preload: false });
const newsreader = Newsreader({ subsets: ["latin", "latin-ext"], style: ["normal"], axes: ["opsz"], display: "swap", preload: false });
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin", "latin-ext"], display: "swap", preload: false });
const plexSans = IBM_Plex_Sans({ subsets: ["latin", "latin-ext"], display: "swap", preload: false });
const nunito = Nunito({ subsets: ["latin", "latin-ext"], display: "swap", preload: false });

const SANS = '"Inter", system-ui, sans-serif';
const FAMILY: Record<FontKey, string> = {
  bricolage: `"Bricolage Grotesque Variable", ${SANS}`,
  inter: SANS,
  "inter-tight": `${interTight.style.fontFamily}, ${SANS}`,
  newsreader: `${newsreader.style.fontFamily}, Georgia, "Times New Roman", serif`,
  "jetbrains-mono": `${jetbrainsMono.style.fontFamily}, ui-monospace, Menlo, Consolas, monospace`,
  "plex-sans": `${plexSans.style.fontFamily}, ${SANS}`,
  nunito: `${nunito.style.fontFamily}, ${SANS}`,
};

/** The CSS font-family for a face. */
export const fontFamily = (key: FontKey) => FAMILY[key];

/** The CSS font-family for a look's headings. */
export const headingFamily = (t: Pick<PortfolioTheme, "type">) => FAMILY[t.type.display];

/**
 * Everything a look sets, as CSS custom properties on the wrapper of a portfolio page (the home
 * page's root, the exhbt page's frame). One set, decision 0018:
 *   --pf-*      the page: ground, text, rules, cards, wells, buttons, ticks, pills, the highlight,
 *               the flowchart's last box, initials, corners, faces (the names of decision 0016 kept)
 *   --band-*    the best-work band
 *   --chart-*   the graphs' two shades and their ramp
 *   --font-display  the heading face (the site's own variable, so every heading inside follows)
 * The exhbt page's --xp-* names (decision 0022) and the graphs' text colours are read from these
 * in globals.css (`[data-look]`), so a look defines each colour once.
 */
export function themeStyle(t: PortfolioTheme): React.CSSProperties {
  const p = t.palette;
  const s = t.shape;
  return {
    "--pf-ground": p.ground,
    "--pf-ink": p.ink,
    "--pf-heading": p.heading,
    "--pf-soft": p.soft,
    "--pf-faint": p.faint,
    "--pf-line": p.line,
    "--pf-rule": p.rule,
    "--pf-edge": p.edge,
    "--pf-card": p.card,
    "--pf-well": p.well,
    "--pf-well-edge": p.wellEdge,
    "--pf-figure": p.figure,
    "--pf-accent": p.link,
    "--pf-button-bg": p.button,
    "--pf-button-text": p.buttonInk,
    "--pf-action": p.action,
    "--pf-action-ink": p.actionInk,
    "--pf-action-hover": p.actionHover,
    "--pf-highlight": p.highlight,
    "--pf-highlight-ink": p.highlightInk,
    "--pf-tick": p.tick,
    "--pf-tick-ink": p.tickInk,
    "--pf-pill": p.pill,
    "--pf-pill-ink": p.pillInk,
    "--pf-pill-edge": p.pillEdge,
    "--pf-flow-end": p.flowEnd,
    "--pf-flow-end-ink": p.flowEndInk,
    "--pf-flow-end-soft": p.flowEndSoft,
    "--pf-avatar": p.avatar,
    "--pf-avatar-ink": p.avatarInk,
    "--pf-radius": s.radius,
    "--pf-radius-lg": s.radiusLarge,
    "--pf-radius-box": s.radiusBox,
    "--pf-radius-pill": s.radiusPill,
    "--pf-radius-button": s.radiusButton,
    "--pf-edge-width": s.edgeWidth,
    "--pf-rule-style": s.ruleStyle,
    "--font-display": FAMILY[t.type.display],
    "--pf-font-body": FAMILY[t.type.body],
    "--pf-font-lead": FAMILY[t.type[t.type.lead]],
    "--pf-display-weight": String(t.type.displayWeight),
    "--pf-tracking": t.type.tracking,
    "--band-bg": p.band,
    "--band-text": p.bandInk,
    "--band-soft": p.bandSoft,
    "--band-accent": p.bandAccent,
    "--band-edge": p.bandEdge,
    // The band's photo stand-in (PortfolioHeader on the demo reads these names).
    "--band-initials-bg": p.avatar,
    "--band-initials-text": p.avatarInk,
    "--chart-strong": p.chartStrong,
    "--chart-soft": p.chartSoft,
    "--chart-1": p.chartRamp[0],
    "--chart-2": p.chartRamp[1],
    "--chart-3": p.chartRamp[2],
    "--chart-4": p.chartRamp[3],
    "--chart-wash": chartWash(p),
  } as React.CSSProperties;
}

/**
 * The attributes that go with themeStyle: which look (and colourway) it is, whether its ground is
 * dark (print resets it to paper), and its layout treatments, which globals.css and the components
 * read. `data-theme` keeps the stored id for tests and for decision 0022's selectors.
 */
export function lookAttrs(t: PortfolioTheme): Record<string, string> {
  return {
    "data-look": t.look,
    "data-theme": t.id,
    "data-hero": t.treatment.hero,
    "data-band": t.treatment.band,
    "data-work": t.treatment.work,
    ...(isDark(t) ? { "data-dark": "true" } : {}),
  };
}

const isDark = (t: PortfolioTheme) => contrastRatio(t.palette.ground, "#ffffff") > 3;

/**
 * Paper for a dark look: in print (and Save as PDF) its colours become the default look's, so a
 * printout isn't a page of black ink. The look's values are inline, so this needs !important, and
 * it is written from the default look's own values rather than by hand. Null for a light look.
 */
export function printStyle(t: PortfolioTheme): string | null {
  if (!isDark(t)) return null;
  const light = Object.entries(themeStyle(DEFAULT_THEME))
    .filter(([k]) => k.startsWith("--pf-") || k.startsWith("--band-") || k.startsWith("--chart-"))
    .filter(([k]) => !/radius|font|weight|tracking|edge-width|rule-style/.test(k))
    .map(([k, v]) => `${k}:${v} !important`)
    .join(";");
  return `@media print{[data-look][data-dark]{${light}}}`;
}
