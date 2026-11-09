import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();
const skip = new Set(["node_modules", ".next", ".next-e2e", "design-references", ".claude", ".git"]);

function walk(dir, out) {
  for (const name of readdirSync(dir)) {
    if (skip.has(name)) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (/\.(tsx?|md)$/.test(name)) out.push(path);
  }
}

const files = [];
for (const dir of ["app", "components", "lib", "e2e"]) walk(join(root, dir), files);
for (const file of ["AGENTS.md", "HANDOFF.md", "PRODUCT.md", "README.md", "DESIGN.md", "docs/MAP.md"]) {
  files.push(join(root, file));
}

const bans = [
  [/evidence pack/i, 'retired name; say "exhbt"'],
  [/unlimited refreshes/i, "refreshes are capped in lib/entitlements.ts"],
  [/unlimited roadmap/i, "refreshes are capped in lib/entitlements.ts"],
  [/exhbt\.co\.uk\/(?:you|<username>|\{username\}|amara)\b/, "portfolio host is username.exhbt.co.uk (lib/hosts.ts)"],
  [/exhbt\.co\.uk\/</, "portfolio host is username.exhbt.co.uk (lib/hosts.ts)"],
];

// A handwritten plan count. Figures belong in lib/entitlements.ts, which is skipped.
const countRe = /\b\d+\s+(?:roadmap refreshes|roadmap refresh|exhbts|exhbt)\b/i;

// Haiku only (lib/ai/model.ts). Any other Claude model named in the app's code fails the check.
const ONLY_MODEL = "claude-haiku-5-5";
const modelRe = /claude-(?:opus|sonnet|haiku|fable|mythos)-[0-9][0-9a-z-]*/g;

const problems = [];
for (const file of files) {
  if (/^(app|components|lib)\//.test(relative(root, file))) {
    for (const id of readFileSync(file, "utf8").match(modelRe) ?? []) {
      if (id !== ONLY_MODEL) problems.push(`${relative(root, file)}: names ${id}; the app uses ${ONLY_MODEL} only (lib/ai/model.ts)`);
    }
  }
}
for (const file of files) {
  const rel = relative(root, file);
  if (rel === "lib/entitlements.ts") continue;
  const text = readFileSync(file, "utf8");
  for (const [re, why] of bans) {
    if (re.test(text)) problems.push(`${rel}: ${why}`);
  }
  if (countRe.test(text)) problems.push(`${rel}: plan count restated; read it from lib/entitlements.ts`);
}

for (const file of [
  "docs/MAP.md",
  "docs/decisions/0001-portfolio-subdomains.md",
  "docs/decisions/0002-plan-tiers.md",
  "lib/hosts.ts",
  "lib/entitlements.ts",
]) {
  try {
    statSync(join(root, file));
  } catch {
    problems.push(`missing ${file}`);
  }
}

for (const file of ["docs/decisions/0001-portfolio-subdomains.md", "docs/decisions/0002-plan-tiers.md"]) {
  const text = readFileSync(join(root, file), "utf8");
  if (!/^Status: (?:accepted|superseded)/m.test(text)) problems.push(`${file}: missing Status`);
}

if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}
console.log(`docs check ok (${files.length} files)`);
