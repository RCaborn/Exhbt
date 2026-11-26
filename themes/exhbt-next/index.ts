import type { DefinedTheme } from "@astryxdesign/core/theme";
import { exhbtNextTheme as built } from "./exhbt-next.js";

/**
 * The proposed Exhbt theme, built, for Astryx's `Theme` (components/lab/LabFrame.tsx). Load its
 * stylesheet with it: `import "@/themes/exhbt-next/exhbt-next.css"` (app/lab/design/layout.tsx does).
 *
 * The source is exhbtNextTheme.ts; README.md beside it says how to rebuild. The build also writes
 * exhbt-next.d.ts, which says no more than the line below and isn't kept (README.md, "Rebuild").
 */
export const exhbtNextTheme = built as unknown as DefinedTheme;
