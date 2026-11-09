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
  },
});

export { MINT, MINT_PRESS, JADE, INK };
