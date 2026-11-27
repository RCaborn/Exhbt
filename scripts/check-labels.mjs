// Fails when a retired label comes back (decision 0033, "One label for one action"): eight labels used to start an
// exhbt and seven names stood for the place it goes. The table says which word replaces each.
//
// It searches app/, components/ and lib/ (not the design lab, not app/dev), ignoring case, and skips lines that are
// only a comment: a comment may say "a new exhbt". On a hit outside ALLOW it names the file, the line and the word
// to use, and exits 1.
//
// ALLOW holds one entry for each place a retired phrase is left on purpose: the file, the phrase, why, and the job that
// removes it ("main session" is a file this job may not touch). Remove an entry when its job lands.
//
// Run it with `npm run check:labels`. To search somewhere else: node scripts/check-labels.mjs <folder>...
// (the allowlist is then skipped, so a plant can be proved in a scratch folder).
import { isLab, read, walk } from "./lib-walk.mjs";

/** Retired phrase, the word to use, and (where it needs one) how a hit counts as a label and not as running text. */
const RETIRED = [
  { re: /build your exhbt/i, use: '"Add an exhbt" ("Start your portfolio" on the hero, in job 6a)' },
  { re: /draft an exhbt/i, use: '"Add an exhbt" to start one, or "Draft it from your files" for the upload step' },
  { re: /make an exhbt/i, use: '"Add an exhbt"' },
  { re: /start an exhbt/i, use: '"Add an exhbt"' },
  // "new exhbt" is running text in many comments and sentences; only the label, the whole string, is retired.
  { re: /(["'`>])new exhbt\1?(?=["'`<])/i, use: '"Add an exhbt"' },
  { re: /upload your project/i, use: '"Add an exhbt"' },
  { re: /start from scratch/i, use: '"Write it myself" (the chooser) or "Add an exhbt"' },
  { re: /your own link/i, use: '"its link" for one exhbt, "your address" for name.exhbt.co.uk' },
  { re: /your own address/i, use: '"your address"' },
  { re: /portfolio site/i, use: '"your portfolio"' },
  { re: /make it count/i, use: '"Add an exhbt" (the roadmap\'s last view says "Already finished a project?")' },
];

/** file, phrase (lower case, must be in the hit's line), reason, the job that removes it. */
const ALLOW = [
  { file: "app/(marketing)/page.tsx", phrase: "build your exhbt", why: "Home's hero button, which stays until the portfolio is on for everyone (question 7)", job: "6a" },
  { file: "app/(marketing)/page.tsx", phrase: "your own address", why: "Home's own sentences, which 6a rewrites", job: "6a" },
  { file: "components/home/HowItWorks.tsx", phrase: "upload your project", why: "Home's first beat, which 6a rewrites", job: "6a" },
  { file: "components/site/SiteFooter.tsx", phrase: "your own portfolio site", why: "the footer's line, in 2a's milestone 2", job: "2a" },
  { file: "app/layout.tsx", phrase: "your own portfolio site", why: "frozen: the site's description. Use \"your own portfolio at name.exhbt.co.uk\"", job: "main session" },
  { file: "lib/plan-rules.ts", phrase: "your own link", why: "protected (check:protected): the refusal shown when a publish is refused. Use \"Publishing to your address comes with ...\"", job: "main session" },
  { file: "lib/team.ts", phrase: "your own address", why: "means an email address, not a label", job: "none" },
  { file: "app/api/exhbts/draft/route.ts", phrase: "draft an exhbt", why: "an API error for the AI draft, where drafting is the action; outside 3a's files", job: "main session" },
  { file: "app/(app)/portfolio/actions.ts", phrase: "start an exhbt", why: "a sentence in the step builder's AI error; outside 3a's files. Use \"add an exhbt\"", job: "main session" },
];

const isComment = (line) => /^\s*(\/\/|\/\*|\*|\{\/\*)/.test(line);
const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const custom = args.length > 0;
const roots = custom ? args : ["app", "components", "lib"];
const skip = (p) => isLab(p) || p === "app/dev" || p.startsWith("app/dev/");
const problems = [];
const used = new Set();

for (const root of roots) {
  for (const f of walk(root, skip)) {
    read(f).split("\n").forEach((line, i) => {
      if (isComment(line)) return;
      const low = line.toLowerCase();
      for (const { re, use } of RETIRED) {
        const m = line.match(re);
        if (!m) continue;
        const allowed = custom ? -1 : ALLOW.findIndex((a) => a.file === f && low.includes(a.phrase) && re.test(a.phrase));
        if (allowed >= 0) {
          used.add(allowed);
          continue;
        }
        problems.push(`${f}:${i + 1}: "${m[0].replace(/^["'`>]/, "")}" is a retired label; use ${use}`);
      }
    });
  }
}

if (!custom) {
  ALLOW.forEach((a, i) => {
    if (!used.has(i) && !problems.length) problems.push(`allowlist: ${a.file} no longer holds "${a.phrase}"; remove the entry (${a.job})`);
  });
}

if (problems.length) {
  console.error("Label check failed (decision 0033):\n");
  for (const p of problems) console.error(`  ${p}`);
  process.exit(1);
}
console.log(`label check ok${custom ? "" : ` (${ALLOW.length} allowed on purpose: ${[...new Set(ALLOW.map((a) => a.job))].join(", ")})`}`);
