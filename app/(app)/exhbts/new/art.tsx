import { Center } from "@astryxdesign/core/Center";
import { Grid } from "@astryxdesign/core/Grid";
import { HStack } from "@astryxdesign/core/HStack";
import type { Format } from "@/lib/exhbt/formats";
import { Glyph, type GlyphName } from "./glyphs";
import { LayoutSketch } from "./layout-parts";

/*
 * The two pictures on "Add an exhbt": what you bring, an arrow, and the page you get. Both end on the same
 * sheet, the editor's own sketch of a case study: written in for the AI draft, empty with a cursor in its
 * title for building it yourself. They are pictures only (hidden from screen readers); the words beside
 * them say the same. Astryx lays them out; add-exhbt.css paints them, from Astryx's tokens.
 */

const FILES: GlyphName[] = ["report", "slides", "picture", "link"];

/** Draft it with AI: a report, slides, pictures and a link go in, and a written page comes out. */
export function DraftedArt() {
  return (
    <HStack hAlign="center" vAlign="center" className="add-art" aria-hidden>
      <Grid columns={2} gap={2} className="add-art-from add-art-files">
        {FILES.map((name) => (
          <Center key={name} className="add-art-file">
            <Glyph name={name} size="md" />
          </Center>
        ))}
      </Grid>
      <Glyph name="go" size="md" color="primary" className="shrink-0" />
      <Center className="add-art-sheet add-art-page add-art-written">
        <LayoutSketch format="case-study" className="add-sketch" />
        {/* What the draft writes in, over the same 56 by 40 box: the lines of the findings and the key figure's bars. */}
        <svg viewBox="0 0 56 40" fill="none" className="add-sketch add-art-over">
          <path d="M5 27.5h18M5 31h18M5 34.5h11" stroke="currentColor" />
          <rect x="33.5" y="31" width="3.5" height="5" />
          <rect x="38.75" y="29" width="3.5" height="7" />
          <rect x="44" y="30" width="3.5" height="6" />
          <rect x="49.25" y="26" width="3.5" height="10" data-key />
        </svg>
      </Center>
    </HStack>
  );
}

/** Build it yourself: the layouts on offer go in, and an empty page comes out with the cursor in its title. */
export function LayoutsArt({ offered }: { offered: readonly Format[] }) {
  return (
    <HStack hAlign="center" vAlign="center" className="add-art" aria-hidden>
      <Grid columns={2} gap={2} className="add-art-from add-art-layouts" data-offered data-few={offered.length < 4 ? "" : undefined}>
        {offered.map((f) => (
          <Center key={f} className="add-art-sheet">
            <LayoutSketch format={f} className="add-sketch" />
          </Center>
        ))}
      </Grid>
      <Glyph name="go" size="md" color="primary" className="shrink-0" />
      <Center className="add-art-sheet add-art-page add-art-empty">
        <LayoutSketch format="case-study" className="add-sketch" />
        {/* The cursor, at the start of the title's box. */}
        <svg viewBox="0 0 56 40" fill="none" className="add-sketch add-art-over">
          <path d="M4.5 3.25v2.5" />
        </svg>
      </Center>
    </HStack>
  );
}
