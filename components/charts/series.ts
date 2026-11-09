/**
 * The only chart colours: the brand's one hue in two shades, mint and jade (docs/brand.md).
 * They differ strongly in lightness (3.7:1 against each other), so they stay apart for
 * colour-blind readers. Mint is faint on white (1.5:1), so charts never rely on it alone:
 * values are printed or listed in text ink, and a hidden table carries the data.
 * Checked by contrast maths on 9 Nov 2026, not re-run through the dataviz palette validator.
 */
export const SERIES_LIGHT = "#4fe9b4";
export const SERIES_DARK = "#00755d";
