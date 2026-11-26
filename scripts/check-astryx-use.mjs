// Fails when something Astryx offers but the site has ruled out creeps in, and when hand-built form controls grow
// (decision 0033, the third of the six and the rule that every control is an Astryx component).
//
// 1. In app/ and components/: an import of Astryx's Carousel, ClickableCard or SelectableCard (from its own path, the barrel "@astryxdesign/core" or import()); an import of Badge
//    outside ALLOW_BADGE (empty: a count is the only use that would earn a place); and a colour-named variant
//    (blue, cyan, orange, pink, purple, red, teal, yellow) passed as a `color` or `variant` in a file that imports Astryx.
// 2. A ratchet: raw <input, <textarea, <select and <dialog in app/(app), app/(marketing) and components/, folder by
//    folder, leaving out the folders a person's own page is drawn from. The counts below are today's; a folder's
//    count may fall (lower it here) and may not rise.
// The design lab (app/lab, components/lab) is left out: it is not part of the product.
//
// Run it with `npm run check:astryx`. To count somewhere else: node scripts/check-astryx-use.mjs <folder>...
// (the ratchet is then skipped). `--print` prints the current counts, for lowering the baseline.
import { isLab, read, walk } from "./lib-walk.mjs";

/** Files that may import Badge. */
const ALLOW_BADGE = new Set([]);
const BANNED = ["Carousel", "ClickableCard", "SelectableCard"];
/** Any string that names one of these components' own entry point: a static import, import(), require() or a re-export. */
const SUBPATH = /["']@astryxdesign\/core\/(Carousel|ClickableCard|SelectableCard|Badge)["']/g;
/** import { A, B as C } from "@astryxdesign/core" (any number of lines), and export { A } from the same. */
const BARREL = /\b(?:import|export)\s+(?:type\s+)?\{([^}]*)\}\s*from\s*["']@astryxdesign\/core["']/g;
/** import("@astryxdesign/core"): the whole barrel at once, so no name can be checked. */
const DYNAMIC_BARREL = /\b(?:import|require)\s*\(\s*["']@astryxdesign\/core["']\s*\)/g;
/** import * as X from "@astryxdesign/core" */
const NAMESPACE = /\bimport\s+\*\s+as\s+\w+\s+from\s*["']@astryxdesign\/core["']/g;
const ASTRYX = /["']@astryxdesign\//;
const COLOUR_VARIANT = /\b(?:color|variant)=\{?\s*["'](blue|cyan|orange|pink|purple|red|teal|yellow)["']/;
// A hidden input carries a value, not a control: it is not counted.
const RAW = /<(?:input\b(?![^>]*\btype=["']hidden["'])|textarea\b|select\b|dialog\b)/g;

/** A person's own page is drawn from these: the look's variables, not the app's controls. */
const OWN_PAGE = new Set(["components/portfolio", "components/exhbt", "components/charts", "components/exhbt-editor", "components/portfolio-editor"]);

/** Raw controls today (26 Nov 2026), by folder, hidden inputs not counted. May fall; may not rise. */
const BASELINE = {
  "app/(app)": 52,
  "app/(marketing)": 3,
  "components/editor": 30,
  "components/home": 2,
  "components/roadmap": 5,
  "components/team": 2,
  "components/waitlist": 2,
};

const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const printing = process.argv.includes("--print");
const custom = args.length > 0;
const roots = custom ? args : ["app", "components"];
const problems = [];
const counts = {};

const folderOf = (f) => {
  if (f.startsWith("app/(app)/")) return "app/(app)";
  if (f.startsWith("app/(marketing)/")) return "app/(marketing)";
  const m = f.match(/^components\/([^/]+)\//);
  if (m) return `components/${m[1]}`;
  return f.startsWith("components/") ? "components" : null;
};

for (const root of roots) {
  for (const f of walk(root, isLab)) {
    const src = read(f);
    const lines = src.split("\n");
    const at = (index) => src.slice(0, index).split("\n").length;
    for (const m of src.matchAll(SUBPATH)) {
      const name = m[1];
      if (name === "Badge") {
        if (!ALLOW_BADGE.has(f)) problems.push(`${f}:${at(m.index)}: imports Badge; only a count earns it, and no file is allowed yet`);
      } else problems.push(`${f}:${at(m.index)}: imports ${name}, which the site does not use (0033)`);
    }
    for (const m of src.matchAll(BARREL)) {
      for (const part of m[1].split(",")) {
        const name = part.trim().replace(/^type\s+/, "").split(/\s+as\s+/)[0].trim();
        if (name === "Badge" && !ALLOW_BADGE.has(f)) problems.push(`${f}:${at(m.index)}: imports Badge from the barrel; only a count earns it, and no file is allowed yet`);
        else if (BANNED.includes(name)) problems.push(`${f}:${at(m.index)}: imports ${name} from the barrel, which the site does not use (0033)`);
      }
    }
    for (const m of src.matchAll(DYNAMIC_BARREL)) problems.push(`${f}:${at(m.index)}: a dynamic import of the whole Astryx barrel; import the component's own path so it can be checked`);
    for (const m of src.matchAll(NAMESPACE)) problems.push(`${f}:${at(m.index)}: a namespace import of the Astryx barrel; import the component's own path so it can be checked`);
    if (ASTRYX.test(src)) {
      lines.forEach((line, i) => {
        const m = line.match(COLOUR_VARIANT);
        if (m) problems.push(`${f}:${i + 1}: a colour-named variant "${m[1]}" on an Astryx component; colour comes from the theme`);
      });
    }
    const folder = folderOf(f);
    if (folder && !OWN_PAGE.has(folder)) {
      const n = (src.match(RAW) ?? []).length;
      if (n) counts[folder] = (counts[folder] ?? 0) + n;
    }
  }
}

if (printing) {
  console.log(JSON.stringify(Object.fromEntries(Object.entries(counts).sort()), null, 2));
  process.exit(0);
}
if (!custom) {
  for (const [folder, n] of Object.entries(counts)) {
    const allowed = BASELINE[folder] ?? 0;
    if (n > allowed) problems.push(`${folder}: ${n} raw <input>, <textarea>, <select> or <dialog> where the baseline allows ${allowed}; use components/ui/Field.tsx, Sheet.tsx or Confirm.tsx`);
  }
}

if (problems.length) {
  console.error("Astryx-use check failed:\n");
  for (const p of problems) console.error(`  ${p}`);
  process.exit(1);
}
const total = Object.values(counts).reduce((a, b) => a + b, 0);
console.log(`astryx-use check ok (${total} raw controls counted${custom ? "" : `; the baseline allows ${Object.values(BASELINE).reduce((a, b) => a + b, 0)}`})`);
