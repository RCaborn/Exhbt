// Fails when the brand's colours differ between the Astryx theme and the site's stylesheet (decision 0033).
//
// The values are declared twice: in themes/exhbt/exhbtTheme.ts (what Astryx components paint with) and in the
// @theme block of app/globals.css (what Tailwind classes and the hand-built parts paint with). Nothing else keeps
// them equal. This reads both (the stylesheet's @theme block only) and compares them, case-insensitively.
//
// Run it with `npm run check:tokens`. To try a changed copy of either file: node scripts/check-tokens.mjs [theme.ts] [globals.css]
import { readFileSync } from "node:fs";

const themePath = process.argv[2] ?? "themes/exhbt/exhbtTheme.ts";
const cssPath = process.argv[3] ?? "app/globals.css";

/** The theme's constant, the stylesheet's variable, and the name to print. */
const PAIRS = [
  ["MINT", "--color-mint", "mint"],
  ["MINT_PRESS", "--color-mint-press", "mint press"],
  ["JADE", "--color-jade", "jade"],
  ["INK", "--color-ink", "ink"],
  ["GRAPHITE", "--color-graphite", "graphite"],
  ["SLATE", "--color-slate", "slate"],
  ["LINE", "--color-line", "line"],
  ["MIST", "--color-mist", "mist"],
  ["WASH", "--color-wash", "wash"],
  ["ERROR", "--color-error", "the error red"],
  ["WHITE", "--color-surface", "white"],
];

const theme = readFileSync(themePath, "utf8");
const cssAll = readFileSync(cssPath, "utf8");

/** The text inside each `@theme { ... }` block, braces matched, so a same-named variable elsewhere is not read. */
function themeBlocks(src) {
  const out = [];
  for (const m of src.matchAll(/@theme\b[^{]*\{/g)) {
    let depth = 1;
    let i = m.index + m[0].length;
    const start = i;
    for (; i < src.length && depth > 0; i++) {
      if (src[i] === "{") depth++;
      else if (src[i] === "}") depth--;
    }
    out.push(src.slice(start, i - 1));
  }
  return out.join("\n");
}
const css = themeBlocks(cssAll);
if (!css) {
  console.error(`Token check failed: no @theme block in ${cssPath}.`);
  process.exit(1);
}
const problems = [];
for (const [constant, variable, name] of PAIRS) {
  const a = theme.match(new RegExp(`const ${constant}\\s*=\\s*"(#[0-9a-fA-F]{3,8})"`))?.[1];
  const b = css.match(new RegExp(`${variable}\\s*:\\s*(#[0-9a-fA-F]{3,8})\\s*;`))?.[1];
  if (!a) problems.push(`${name}: no \`const ${constant} = "#..."\` in ${themePath}`);
  else if (!b) problems.push(`${name}: no \`${variable}: #...;\` in ${cssPath}`);
  else if (a.toLowerCase() !== b.toLowerCase()) problems.push(`${name}: ${themePath} says ${a}, ${cssPath} says ${b} (${variable})`);
}

if (problems.length) {
  console.error("Token check failed: the palette has two sets of values.\n");
  for (const p of problems) console.error(`  ${p}`);
  console.error("\nChange both files to the same value (themes/exhbt/exhbtTheme.ts, then `npm run theme`; and the @theme block of app/globals.css).");
  process.exit(1);
}
console.log(`token check ok (${PAIRS.length} colours match)`);
