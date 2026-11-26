import { ArrowRight, FileText, Image as Picture, Link2, Presentation } from "lucide-react";
import type { Format } from "@/lib/exhbt/formats";
import { LayoutSketch } from "./layout-parts";

/*
 * The two pictures on "Add an exhbt": what you bring, an arrow, and the page you get. Both end on the same
 * sheet, the editor's own sketch of a case study: written in for the AI draft, empty with a cursor in its
 * title for building it yourself. They are pictures only (hidden from screen readers); the words beside
 * them say the same.
 */

const FILES = [FileText, Presentation, Picture, Link2];

/** Draft it with AI: a report, slides, pictures and a link go in, and a written page comes out. */
export function DraftedArt() {
  return (
    <div className="add-art" aria-hidden>
      <div className="add-art-from add-art-files">
        {FILES.map((Icon, i) => (
          <span key={i} className="add-art-file">
            <Icon size={20} strokeWidth={1.75} />
          </span>
        ))}
      </div>
      <ArrowRight size={20} strokeWidth={2} className="add-art-arrow" />
      <div className="add-art-sheet add-art-page add-art-written">
        <LayoutSketch format="case-study" className="add-sketch" />
        {/* What the draft writes in, over the same 56 by 40 box: the lines of the findings and the key figure's bars. */}
        <svg viewBox="0 0 56 40" fill="none" className="add-sketch add-art-over">
          <path d="M5 27.5h18M5 31h18M5 34.5h11" stroke="currentColor" />
          <rect x="33.5" y="31" width="3.5" height="5" />
          <rect x="38.75" y="29" width="3.5" height="7" />
          <rect x="44" y="30" width="3.5" height="6" />
          <rect x="49.25" y="26" width="3.5" height="10" data-key />
        </svg>
      </div>
    </div>
  );
}

/** Build it yourself: the layouts on offer go in, and an empty page comes out with the cursor in its title. */
export function LayoutsArt({ offered }: { offered: readonly Format[] }) {
  return (
    <div className="add-art" aria-hidden>
      <div className="add-art-from add-art-layouts" data-few={offered.length < 4 ? "" : undefined}>
        {offered.map((f) => (
          <span key={f} className="add-art-sheet">
            <LayoutSketch format={f} className="add-sketch" />
          </span>
        ))}
      </div>
      <ArrowRight size={20} strokeWidth={2} className="add-art-arrow" />
      <div className="add-art-sheet add-art-page add-art-empty">
        <LayoutSketch format="case-study" className="add-sketch" />
        {/* The cursor, at the start of the title's box. */}
        <svg viewBox="0 0 56 40" fill="none" className="add-sketch add-art-over">
          <path d="M4.5 3.25v2.5" />
        </svg>
      </div>
    </div>
  );
}
