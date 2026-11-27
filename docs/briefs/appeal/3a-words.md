# Brief 3a: one word for each thing, and every step saying what happens next

| | |
|---|---|
| Phase | 3, forms, feedback and empty states |
| Model | Sonnet |
| Branch | `phase-2-appeal-3a-words`, made from `phase-2-appeal` |
| Port | 3355 |
| Starts when | Now. `phase-2-appeal` has add-exhbt (release b2) and brief H (portfolio release 2), which are what the plan's row waits for |
| Hours | About 5 |

## Why this starts before Rory has chosen a level

This folder's README holds later phases until Rory picks a level in the design lab. That rule is about the look. This job changes words, and the words are the same at every level (decision 0033, "Clarity is a goal of its own"). Nothing here changes a colour, a size, a layout, a link's destination or a motion.

## Goal

The clarity review (`/tmp/claude-0/-home-user-Exhbt/8f68944d-9b6a-5167-8a40-0d82c10fe3df/scratchpad/appeal/review-clarity-final.md`, findings 3 and 4) found eight labels that start an exhbt and seven names for the place it goes. Make the app use 0033's table, add a check that keeps it that way, and make three steps say what happens next:

1. **Sign-up** says "Next: your page, then your first project."
2. **"Add an exhbt"** (`/exhbts/new`) says, before anyone starts, that on Free an exhbt stays private: only they can see it until they pay to put it online. Plan names come from `PLAN_NAMES` in `lib/entitlements.ts`. No price or count in the string.
3. **The roadmap's last view** (today "When a project is done, make it count", `components/roadmap/RoadmapViews.tsx`) **and its email** (`lib/email/templates/roadmap-ready.ts`) say: "Already finished a project? A dissertation, a module project or placement work counts. Add it as your first exhbt; these ideas can be your second and third." It is followed by an "Add an exhbt" link to `/exhbts/new`.

## The table (decision 0033)

| The thing | The word |
|---|---|
| Starting an exhbt, anywhere | "Add an exhbt" ("Add as an exhbt" on a roadmap idea; "Add an exhbt to your portfolio" as `/exhbts/new`'s heading) |
| The place | "your portfolio" |
| `name.exhbt.co.uk` | "your address" |
| One exhbt's own address | "its link" |
| The editor's publish step | "Review and publish" |
| The roadmap | "Build your roadmap" |

**One exception that stays:** "Build your exhbt" on Home's hero button and the header's button. It changes to "Start your portfolio" only when the new portfolio is on for everyone (question 7 on Rory's design page), and job 6a makes that change. Leave both as they are, and let the check allow them.

The place's other names ("website", "site", "page", "your own link", "your own address", "portfolio site") are retired **as labels**. A sentence on a marketing page that describes the product ("A website of your own, built from your projects" is 0033's own headline) is not a label and stays. Read each hit and judge. Where you are unsure, keep the words and list the case in your report.

## Step 1 is a search on your own base

The main session's count on 27 Nov, on portfolio release 2's head, found about 25 strings in `app/`, `components/` and `lib/`, and about 20 in `e2e/`. Run the search yourself on your branch and work from what you find:

```bash
git grep -n -F -e "Build your exhbt" -e "New exhbt" -e "Upload your project" -e "Start from scratch" -e "Draft an exhbt" -e "Make an exhbt" -e "Start an exhbt" -e "your own link" -e "your own address" -e "portfolio site" -e "make it count" -- app components lib e2e
```

Expect these, and change them:

- `app/(app)/exhbts/new/page.tsx`: the draft step's title and heading ("Draft an exhbt"). The chooser's two ways in were named by the add-exhbt build; keep them.
- `app/(app)/exhbts/page.tsx`: "your own link" (twice).
- `app/(app)/portfolio/StepProjects.tsx`: "Start an exhbt" (three times). This is the live step builder. Change the strings only.
- `app/(marketing)/pricing/page.tsx`, `app/(marketing)/what-is-an-exhbt/page.tsx` (its two "Build your exhbt" buttons are not the hero's; they become "Add an exhbt"), `app/(marketing)/demo/page.tsx`.
- `components/portfolio-editor/sheets/AddressSheet.tsx`, `components/roadmap/RoadmapViews.tsx`, `components/roadmap/BuildThis.tsx` (an idea's button: "Add as an exhbt").
- `lib/marketing-features.ts`, `lib/seo.ts` (page descriptions: `e2e/seo.spec.ts` reads some of them).

Leave these, and put each in the check's allowlist with its reason and the job that removes it:

- `app/(marketing)/page.tsx` and `components/home/`: Home, which 6a rewrites.
- `components/site/SiteFooter.tsx`: 2a's footer, its milestone 2.
- `app/layout.tsx`: frozen. It holds the site's description. Put the words you would use in your report.
- `lib/plan-rules.ts`: protected (`npm run check:protected`). Its "Publishing to your own link comes with ..." is shown when a publish is refused. Put the words you would use in your report.
- `lib/team.ts`: "That's your own address" means an email address. It is not a label.

## You own

- **Words only** in: `app/(app)/exhbts/new/**`, `app/(app)/exhbts/page.tsx`, `app/(app)/portfolio/StepProjects.tsx`, `app/(app)/login/new/**` (see step 5), `app/(marketing)/pricing/page.tsx`, `app/(marketing)/what-is-an-exhbt/page.tsx`, `app/(marketing)/demo/page.tsx`, `components/roadmap/RoadmapViews.tsx`, `components/roadmap/BuildThis.tsx`, `components/portfolio-editor/sheets/AddressSheet.tsx`, `lib/email/templates/roadmap-ready.ts`, `lib/marketing-features.ts`, `lib/seo.ts`.
  - "Words only" means text, `aria-label`s and the `label` props that name a button.
  - It does not mean structure, props, classes, links' destinations, or what a form posts.
  - The three next-step lines may each add one element (a paragraph or a link), drawn with the classes or kit components its neighbours already use.
- **New:** `scripts/check-labels.mjs`; `"check:labels"` in `package.json`, added to the `check` script beside `check:astryx`; and `npm run check:labels` added to the line in `.github/workflows/ci.yml` that runs `check:tokens`, `check:raised` and `check:astryx`.
- **In `e2e/`:** only the selectors and expected text that name a label you changed. A test that checked the old word now checks the new one, and checks nothing less. The page object `e2e/editor.ts` is yours for renamed labels only; job 5b runs beside you in the editor's specs and does not touch it.

## You must not touch

Home (`app/(marketing)/page.tsx`, `components/home/`). `components/site/` (2a). `components/exhbt-editor/`, `components/editor/` and `app/(app)/exhbts/[id]/` (5b works there now). `components/team/` (5b). Visitors' pages: `app/(portfolio)/**`, `components/portfolio/`, `components/exhbt/`, `lib/portfolio.ts`, `lib/plan-rules.ts`. `app/layout.tsx`, `lib/entitlements.ts`, the theme, and everything else in this folder's README's frozen list that is not named under "You own".

## The check

`scripts/check-labels.mjs`, in the style of 1b's three checks:
- It searches `app/`, `components/` and `lib/` for each retired label, ignoring case.
- On a hit outside its allowlist, it names the file, the line and the word to use, and it exits 1.
- Each allowlist entry is a file and a phrase, with a one-line reason and the job that removes it (6a, 2a, or "main session").
- Prove it: it passes on your branch and fails on a planted label, which you then take out. Say in your report that you did.

## Steps

Commit and push after each. End the first line of every commit with `[skip ci]`; full CI runs only on the release pull request.

1. **The search**, then `scripts/check-labels.mjs` with its retired list and allowlist. It fails on your base: that is expected until step 3.
2. **"Add an exhbt"**: the heading "Add an exhbt to your portfolio", the draft step's new title, and the Free line, before anyone starts. Give the draft step a name in the table's spirit; "Draft it from your files" is the clarity review's suggestion.
3. **The rest of the app's strings** in the list above, and **the roadmap's What next and its email**.
4. **The tests:** every spec whose text names a label you changed.
5. **Sign-up's "Next: your page, then your first project."** The login pages are Alex's. Make this its own commit, last, so the main session can hold it back until he has seen it.
6. **Photograph** at 1440 and 390, before and after: `/exhbts/new` (the chooser and the draft step), the roadmap's What next, the step builder's projects step, `/exhbts`, pricing, `/what-is-an-exhbt`, and sign-up. Read them: one name for each thing on every screen, and each line reads as plain British English.

## Done looks like

No retired label in `app/`, `components/` or `lib/` outside the allowlist. `npm run check:labels` passes, and fails on a plant. The three next-step lines are in place. Every spec you ran passes. Nothing moved but words, and the three new lines.

## Report back

- The branch head, and which commit is sign-up's.
- Every string you changed, old and new, with its file.
- The allowlist and its reasons.
- The words you would use in `app/layout.tsx` and `lib/plan-rules.ts`.
- The photographs, named.
- The specs you ran and their results.
- Each case you judged (a "website" you kept, a word you weren't sure of) and why.

Run, one at a time: every spec file you changed; `e2e/add-exhbt*.spec.ts`; the roadmap specs (`git ls-files e2e | grep -i roadmap`); `e2e/phase2-builder.spec.ts`; `e2e/seo.spec.ts`; `e2e/a11y.spec.ts`; and any spec that covers the email template.

## Rules

The fifteen rules in this folder's `README.md` apply, with your branch, your port (3355) and your screenshot folder (`/tmp/claude-0/-home-user-Exhbt/8f68944d-9b6a-5167-8a40-0d82c10fe3df/scratchpad/appeal-build/3a/`). As a Sonnet agent, end each commit with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` and then the README's `Claude-Session:` line, unchanged.
