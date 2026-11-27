import { defineTheme } from "@astryxdesign/core/theme";
import { neutralTheme } from "@astryxdesign/theme-neutral";

/**
 * The Exhbt theme for Astryx components (docs/brand.md, brand kit v1, 9 Nov 2026).
 * Mint leads, jade is mint's text-safe partner, ink is the text, the canvas is white.
 * The same values are the site's Tailwind tokens in app/globals.css: change both together.
 *
 * Build after any change:  npm run theme
 * (writes exhbt.css, exhbt.js and the .d.ts files beside this file; they are committed.)
 */
const MINT = "#4FE9B4";
const MINT_PRESS = "#36DDA4";
const JADE = "#00755D";
const INK = "#0E0F12";
const GRAPHITE = "#3E4044";
const SLATE = "#6F7278";
const LINE = "#E5E6E8";
const MIST = "#F6F7F8";

/** The site's heading scale for Astryx's Heading, h1 to h3 (app/globals.css): set in the tokens, and again under the touch rule. */
const HEADINGS = {
  "--text-heading-1-size": "3rem",
  "--text-heading-1-leading": "1.05",
  "--text-heading-2-size": "2rem",
  "--text-heading-2-leading": "1.1",
  "--text-heading-3-size": "1.375rem",
  "--text-heading-3-leading": "1.15",
};
const WASH = "#E3FCF0";
const ERROR = "#C92324";
const WHITE = "#FFFFFF";

export const exhbtTheme = defineTheme({
  name: "exhbt",
  extends: neutralTheme,
  typography: {
    scale: { base: 16, ratio: 1.2 },
    body: { family: "Inter", fallbacks: "system-ui, sans-serif" },
    heading: { family: "Bricolage Grotesque Variable", fallbacks: "Inter, system-ui, sans-serif" },
    code: { family: "Inter", fallbacks: "system-ui, sans-serif" },
  },
  radius: { base: 8, multiplier: 1 },
  // The site is light only, so both halves of each pair are the light value.
  tokens: {
    "--color-accent": [MINT, MINT],
    "--color-on-accent": [INK, INK],
    "--color-accent-muted": [WASH, WASH],
    "--color-text-accent": [JADE, JADE],
    "--color-icon-accent": [JADE, JADE],
    "--color-text-primary": [INK, INK],
    "--color-text-secondary": [GRAPHITE, GRAPHITE],
    "--color-text-disabled": [SLATE, SLATE],
    "--color-icon-primary": [INK, INK],
    "--color-icon-secondary": [GRAPHITE, GRAPHITE],
    "--color-background-body": [WHITE, WHITE],
    "--color-background-surface": [WHITE, WHITE],
    "--color-background-card": [WHITE, WHITE],
    "--color-background-muted": [MIST, MIST],
    "--color-border": [LINE, LINE],
    "--color-border-emphasized": [INK, INK],
    "--color-error": [ERROR, ERROR],
    "--color-text-error": [ERROR, ERROR],
    "--color-border-error": [ERROR, ERROR],
    // Touch-friendly control heights: 44px is the default button and field.
    "--size-element-sm": "36px",
    "--size-element-md": "44px",
    "--size-element-lg": "48px",
    // Astryx's Heading takes the site's one heading scale (h1 to h3 in app/globals.css: 48, 32 and 22px),
    // so a page built from <Heading> reads the same as a page of plain headings. Phones step down below.
    ...HEADINGS,
  },
  adaptations: {
    rules: [
      // The base theme's touch rule (a coarse pointer, under 1024px) sets the type scale again, headings with it: on
      // an iPad in portrait <Heading> drew 26, 22 and 19px with loose leadings, where the site's h1 to h3 are 48, 32
      // and 22px. The site's own heading scale is set again under the same condition, so it holds there too.
      { when: { pointer: "coarse", width: { below: "lg" } }, value: { tokens: HEADINGS } },
      // The same step the site's headings take below 640px: h1 to 36px and h2 to 28px. After the touch rule, so a phone takes it.
      { when: { width: { below: "sm" } }, value: { tokens: { "--text-heading-1-size": "2.25rem", "--text-heading-2-size": "1.75rem" } } },
    ],
  },
  components: {
    button: {
      // One pill shape for every button; ink text on mint (12.4:1), never white on mint.
      base: { borderRadius: "9999px", fontWeight: "600" },
      "variant:primary": { backgroundColor: MINT, color: INK },
      "variant:secondary": { backgroundColor: WHITE, color: INK, borderColor: INK, borderWidth: "1.5px", borderStyle: "solid" },
      // For mint and wash bands, where a mint button would disappear.
      "variant:ink": { backgroundColor: INK, color: WHITE },
    },
    // The display face's tracking, as the site's h1 to h3 have it.
    heading: {
      "level:1": { letterSpacing: "-0.03em" },
      "level:2": { letterSpacing: "-0.03em" },
      "level:3": { letterSpacing: "-0.02em" },
    },
  },
});

export { MINT, MINT_PRESS, JADE, INK };
