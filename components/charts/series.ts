/**
 * The only chart colours: one hue, two shades. Validated with the dataviz palette checker
 * (lightness band, chroma floor, CVD separation pass). The light shade sits below 3:1 on
 * white, so charts print every value in text ink beside the mark and never rely on colour
 * alone. Don't add a colour without re-running the validator (DESIGN.md, Charts).
 */
export const SERIES_LIGHT = "#6aa6ea";
export const SERIES_DARK = "#1a56b8";
