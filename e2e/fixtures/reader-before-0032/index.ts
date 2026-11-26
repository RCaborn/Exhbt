/**
 * The reader before decision 0032: lib/exhbt's blocks, formats, layouts and sections exactly as they are
 * on origin/main at d277be7 (26 Nov 2026), the build that was live when 0032 was written and the one a
 * step back would put live again. Each file is a copy under a two-line header; only the imports of
 * ./charts and ./verify were changed, to point at lib/.
 *
 * Why it is here. Decision 0032 lets a quote, a pull quote and a link's description hold bold and italic,
 * lets a section's title be the person's own, lets the flowchart be taken off any layout, and lets a page
 * go live with parts left empty. Every doc written under it must still read on the build before it:
 * decision 0015 has the store read each doc into the current shape with normaliseDoc, and every save
 * runs the doc through ExhbtDocSchema, which keeps only the keys it knows. e2e/step-back.spec.ts feeds
 * docs as this code saves and publishes them to this reader and checks what it makes of them.
 *
 * Do not edit these copies, and never import them from product code.
 */
export * as old from "./blocks";
export * as oldFormats from "./formats";
export * as oldLayouts from "./layouts";
export * as oldSections from "./sections";
