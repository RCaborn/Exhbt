// Fails when a new file raises something with a shadow (decision 0033, the second of the six: nothing is raised
// but what floats or what is the work).
//
// A file counts when it uses `shadow-pack` or passes elevation="low", "med" or "high" to anything. The files that did
// so when this check was written are listed below. The list only ever gets shorter: a job that flattens a screen
// takes its files off it. A file that is not on the list and raises something fails the check.
// The design lab (app/lab, components/lab) is left out: it is not part of the product.
//
// Run it with `npm run check:raised`. To count a different place: node scripts/check-raised.mjs <folder>...
import { readFileSync } from "node:fs";
import { isLab, walk } from "./lib-walk.mjs";

/** Files that raise something today (26 Nov 2026). Take a file off when it is flattened; never add one. */
const BASELINE = new Set([
  "app/(app)/exhbts/new/page.tsx",
  "app/(app)/job-links/new/page.tsx",
  "app/(app)/portfolio/Builder.tsx",
  "app/(app)/portfolio/Preview.tsx",
  "app/(app)/portfolio/StepProjects.tsx",
  "app/(app)/portfolio/TileEditor.tsx",
  "app/(app)/roadmap/new/page.tsx",
  "app/(app)/roadmap/page.tsx",
  "app/(app)/team/accept/page.tsx",
  "app/(marketing)/what-is-an-exhbt/page.tsx",
  "app/globals.css",
  "components/editor/BlockTools.tsx",
  "components/editor/PreviewArrange.tsx",
  "components/editor/Sections.tsx",
  "components/exhbt-editor/css/core.css",
  "components/exhbt-editor/css/draft-tools.css",
  "components/exhbt-editor/css/drag.css",
  "components/exhbt-editor/css/figures.css",
  "components/exhbt-editor/css/flow.css",
  "components/exhbt-editor/css/phone.css",
  "components/exhbt-editor/css/topbar.css",
  "components/exhbt/Exhbt.tsx",
  "components/exhbt/ExhbtTile.tsx",
  "components/exhbt/PortfolioHeader.tsx",
  "components/home/BrowserFrame.tsx",
  "components/home/HowItWorks.tsx",
  "components/home/JobLinks.tsx",
  "components/portfolio/ExtraTiles.tsx",
  "components/portfolio/PortfolioHome.tsx",
  "components/roadmap/Generating.tsx",
  "components/roadmap/RoadmapViews.tsx",
  "components/team/MatchPrompt.tsx",
]);

/**
 * Files allowed to raise something because it floats over the page for a moment (decision 0033, the second: "nothing
 * is raised but what floats or what is the work"). Unlike the baseline, these stay: add one only when it truly floats.
 */
const FLOATS = new Set([
  // The bar that comes to the words selected in the exhbt editor (decision 0032), in the browser's top layer.
  "components/exhbt-editor/fields/SelectionBar.tsx",
]);

const RAISED = /shadow-pack|elevation=\{?["'](?:low|med|high)/;
const roots = process.argv.length > 2 ? process.argv.slice(2) : ["app", "components"];
const found = [];
for (const root of roots) for (const f of walk(root, isLab, /\.(ts|tsx|css|mdx)$/)) if (RAISED.test(readFileSync(f, "utf8"))) found.push(f);

const fresh = found.filter((f) => !BASELINE.has(f) && !FLOATS.has(f));
const gone = [...BASELINE].filter((f) => !found.includes(f));
if (fresh.length) {
  console.error("Raised check failed: these files raise something and are not on the baseline (shadow-pack, or elevation low, med or high):\n");
  for (const f of fresh) console.error(`  ${f}`);
  console.error("\nFlat is the rule (decision 0033, the second). If it truly floats (a menu, a dialog, a toast), say so in your report and ask for it to be allowed.");
  process.exit(1);
}
if (gone.length && process.argv.length <= 2) {
  console.log(`Flattened, so they can come off the baseline in scripts/check-raised.mjs:\n${gone.map((f) => `  ${f}`).join("\n")}`);
}
console.log(`raised check ok (${found.length} files still raise something; the baseline holds ${BASELINE.size})`);
