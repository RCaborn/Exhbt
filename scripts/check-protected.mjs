// Fails when a change touches what visitors see (portfolio-first rule 10; docs/decisions/0031-portfolio-first.md).
//
// It lists the files this checkout has changed against origin/main (what is committed since the two branched,
// and what is changed or new in the working tree) and fails if any is:
//  - under app/(portfolio)/ (the visitors' pages), added, changed or deleted;
//  - lib/portfolio.ts or lib/plan-rules.ts;
//  - a file under e2e/golden/portfolio/ that already exists on origin/main and is changed or deleted
//    (the portfolio golden copies; ADDING one passes, because brief A writes them).
// It prints each file and why, then exits 1.
//
// Run it with `npm run check:protected`; CI runs it on pull requests. It fetches origin/main itself when the
// checkout is shallow or has no origin/main.
//
// The clean-up (brief L) is the one change allowed to edit a protected file, and it edits this script to say so:
// list the file it may change in ALLOWED below, with the reason.
import { execFileSync } from "node:child_process";

/** Files a named change may edit, with the reason. Brief L adds its named edits here. Empty until then. */
const ALLOWED = new Map(/** @type {[string, string][]} */ ([]));

const git = (...args) => execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const tryGit = (...args) => {
  try {
    return git(...args);
  } catch {
    return null;
  }
};

if (tryGit("rev-parse", "--is-shallow-repository") === "true" || tryGit("rev-parse", "--verify", "--quiet", "origin/main") === null) {
  console.log("Fetching origin/main (the checkout is shallow or has no origin/main)...");
  const shallow = tryGit("rev-parse", "--is-shallow-repository") === "true";
  git("fetch", "--no-tags", ...(shallow ? ["--unshallow"] : []), "origin", "+main:refs/remotes/origin/main");
}

const base = git("merge-base", "origin/main", "HEAD");
// Status and path for each change since the branch point: committed, staged or not. No rename detection, so a move is a delete and an add.
const changes = new Map();
for (const line of git("diff", "--name-status", "--no-renames", "-z", base).split("\0").reduce((out, part, i, all) => {
  if (i % 2 === 0 && part) out.push(`${part}\t${all[i + 1]}`);
  return out;
}, [])) {
  const [status, path] = line.split("\t");
  changes.set(path, status);
}
// New files not yet added to git.
for (const path of git("ls-files", "--others", "--exclude-standard", "-z").split("\0")) if (path) changes.set(path, "A");

const onMain = (path) => tryGit("cat-file", "-e", `origin/main:${path}`) !== null;

const problems = [];
for (const [path, status] of [...changes].sort()) {
  const allowed = ALLOWED.get(path);
  if (allowed) continue;
  if (path.startsWith("app/(portfolio)/")) problems.push([path, "visitors' pages (app/(portfolio)/) are not edited"]);
  else if (path === "lib/portfolio.ts" || path === "lib/plan-rules.ts") problems.push([path, "what visitors' pages are built from; not edited"]);
  else if (path.startsWith("e2e/golden/portfolio/") && status !== "A" && onMain(path)) {
    problems.push([path, `a portfolio golden copy already on origin/main is ${status === "D" ? "deleted" : "changed"}; only adding new ones is allowed`]);
  }
}

if (problems.length) {
  console.error("Protected files changed (visitors' pages must not change):");
  for (const [path, why] of problems) console.error(`  ${path}: ${why}`);
  process.exit(1);
}
console.log(`protected check ok (${changes.size} changed files, none protected)`);
