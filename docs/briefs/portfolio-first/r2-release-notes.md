# Release 2 of portfolio first: the one-page portfolio editor, switched off

27 Nov 2026. This release puts the portfolio-first structure and the one-page portfolio editor on the live site with the switch **off** (`lib/portfolio-kind.ts`, `EXHBT_PORTFOLIO`, default `steps`). Everyone keeps the step builder. Admins can opt in with "Try the new portfolio" and go back with "Use the step builder". Decision 0031 says what was built and why. `trial-checklist.md` is what Rory and Alex try on a laptop and an iPhone before it goes on for everyone.

## What changes for a live user with the switch off

- `/portfolio` loads only what the step builder needs. The editor's load is skipped at `steps`, as the review asked.
- `/portfolio` has an error page. At `steps` it offers only "Load it again".
- After sign-in, a `next` that leaves the site is refused (`lib/safe-next.ts`). That closes an open redirect, `/\evil.com`, that was live before this release.
- The step builder's line rule: a line of education or experience is limited to 14 words, not counting its year, and to 100 characters. Every line that saved before still saves.
- The cookie policy names `exhbt_strip_hidden`. It is set only by the new editor's "Hide this".
- Visitors' pages are unchanged: portfolio-parity, layout-parity and portfolio-visitor all pass.

## Built by

E (the core and its second milestone), F (sections and tiles), G (the bar, sheets and first minute), H (the page flow round the portfolio), I (the phone and typing speed), J (the gates: safety, visitor, smoothness, structure, editor) and K (the docs and the trial checklist). Their reports are in the session's notes, and the briefs are in this folder.

## Review

An independent review ran on 43751d1: two Opus finders and two Sonnet sceptics, one pair for switch-off safety and one for the editor's data. Nothing was must-fix. Everything confirmed as should-fix was fixed before this PR:
- the editor's load at `steps`;
- the error page's wording;
- unsaved words kept when someone leaves during a refused save;
- a save wait that could spin;
- the back-forward cache after "Use the step builder";
- the open redirect;
- the work section always kept, so `sectionsOf` never reads an editor-saved layout as the defaults;
- Undo of an add keeps the words typed;
- the phone's Undo offered only for a change.

## Rolling back

- **The line rule is one-way.** Once this is live, main's earlier code would refuse a line of 15 words (14 plus its year). `normaliseLayout` would then drop that whole Education or Experience tile on read, and the next step-builder save would store the layout without it. A roll-back must keep the line rule, or change `normaliseLayout` to drop only the failing line.
- Turning the switch back to `steps` (an environment variable) is safe at any time. It does not touch stored layouts.

## Known and accepted

- `check:protected` does not guard `components/portfolio/PortfolioHome.tsx` or `lib/portfolio-layout.ts`, though visitors' pages render through both. The parity specs are the guard; a "needs a golden-copy run" list would be better.
- Undoing a line move can restore the wrong order when two lines have the same words, such as two blank lines. No words are lost.
- When the bar's menu opens as a sheet while an Undo toast is leaving, an invisible toast node can stay in the page. That is Astryx's behaviour.
- `maximum-scale=1` stops an iPhone zooming into the page's own fields, which follow the look's type sizes. It has not been tried on a real iPhone, which is why "nothing zooms" is on the checklist.
- Typing speed was measured in production on a Pixel 7 profile at 4x CPU: p95 is 52 to 77ms a key across name, headline and intro. It has not been measured on WebKit or on a real iPhone.
