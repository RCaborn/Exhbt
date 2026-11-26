# Brief 1b: the kit and its checks

| | |
|---|---|
| Phase | 1, the theme foundations |
| Model | Sonnet |
| Branch | `phase-2-appeal-1b-kit`, made from `phase-2-appeal` |
| Port | 3352 |
| Starts when | The main session has cut `phase-2-appeal`. Tonight, beside 1a |
| Hours | About 7: milestone 1 about 2, milestone 2 about 3, milestone 3 about 2 |

## Goal

Three things that let every later job move a screen onto Astryx once, the same way, without anyone seeing two systems.

1. **A dev page, `/dev/astryx`,** that shows each Astryx component the site is about to use, under the real theme, beside the hand-built thing it replaces. The design lab has a Kit page under its proposed theme (`/lab/design/kit`, on `phase-2-design-lab`); yours is the same parts under the theme every real page gets. It is how 1a sees what the real theme still lacks, and when the two pages match, the theme has been moved across.
2. **The app's own wrappers,** in `components/ui/`, as `Button.tsx` is today: one import for each kind of control, holding the app's rules, so a screen never imports a raw Astryx input and a later change is made in one file.
3. **Three check scripts and a spec** that hold the line: the palette has one set of values, nothing new is raised, and nothing banned or hand-built creeps back.

Nothing here changes a screen a student can reach. You add files; you wire none of them into a page.

## Read first

`docs/decisions/0033-astryx-is-the-design-guide.md` (the order of authority; "What Astryx governs"; the six, above all the first three, which your checks hold). `docs/design/appeal-plan.md` ("Rules that keep visitors' pages and live data safe"). `DESIGN.md` (Design system; Banned). `docs/design/astryx-agent-guide.md`. With the CLI: `npm run astryx -- docs principles`, `docs is-my-code-good`, `docs migration/migration-setup` (its "foundation smoke test" is your dev page), and `component <Name>` for each of `Field`, `TextInput`, `TextArea`, `CheckboxInput`, `Banner`, `Toast`, `Drawer`, `BottomSheet`, `AlertDialog`, `DropdownMenu`, `MoreMenu`, `EmptyState`, `Stepper`, `Heading`, `Text`; `hook useToast`, `hook useAnnounce`. From other branches, to read and not to edit: the lab's `components/lab/samples.tsx` and its Kit page (in your base if the lab was merged in, else under `origin/phase-2-design-lab`), and the portfolio editor's `components/portfolio-editor/ui/Sheet.tsx` (`git show origin/phase-2-pf2:components/portfolio-editor/ui/Sheet.tsx`). Then the code: `components/ui/Button.tsx` (the pattern for a wrapper), `components/ui/CopyLink.tsx`, `components/ui/Tick.tsx`, `app/dev/emails/page.tsx` and `app/dev/editor-timing/page.tsx` (how a dev page keeps itself out of production, and how the lab build lets one through), `app/globals.css` (`.field`, `.label`, `.hint`, `.chip`: the hand-built parts you show beside the new ones), `lib/hosts.ts` (`portfolioHost`, `USERNAME_RE`), `scripts/check-docs.mjs` and `scripts/check-protected.mjs` (how the house writes a check), `.github/workflows/ci.yml`.

## You own

- `app/dev/astryx/` (new).
- New files in `components/ui/`: `Field.tsx`, `Notice.tsx`, `toast.ts`, `Sheet.tsx`, `Confirm.tsx`, `Menu.tsx`, `Empty.tsx`, `Steps.tsx`.
- `components/brand/AddressLine.tsx` (new).
- `scripts/check-tokens.mjs`, `scripts/check-raised.mjs`, `scripts/check-astryx-use.mjs` (new).
- `package.json`: three script lines, and their names added to the `check` script. Nothing else in that file.
- `.github/workflows/ci.yml`: one step, beside `check:theme`.
- `e2e/astryx-kit.spec.ts` (new).

## You must not touch

`themes/exhbt/` (1a's). `themes/exhbt-next/`, `app/lab/` and `components/lab/` (the main session's lab). `components/ui/Button.tsx`, `CopyLink.tsx`, `Tick.tsx`. `app/layout.tsx` and `app/providers.tsx`: both wrap visitors' pages, so if a wrapper turns out to need a provider at the root, stop and say so; do not add one. `app/globals.css`. `playwright.config.ts`. Any page a student can reach. Everything in the README's frozen list.

## What you build against

**Facts about the installed Astryx (0.7.11) that shape the wrappers.** Check each with the CLI before you rely on it.

- `TextInput` and `TextArea` are controlled: `value` is required and `onChange` receives the value first. They draw their own label (`label` is required), take `description`, `status: { type: "error" | "warning" | "success", message }`, `isOptional`, `isRequired`, and `htmlName` for the native `name`. Most of the site's forms post to server actions from uncontrolled inputs, so the wrapper holds the value when none is passed.
- `Banner` is **not** a live region. The site's screens and twelve spec files rely on `role="status"` and `role="alert"`.
- `useToast` shows a toast from anywhere and mounts its own viewport if no layer provider is there. A toast that carries an action must be shown with `isAutoHide: false`.
- The portfolio editor already has a sheet: Astryx's `Drawer`, at the side on a wide window and the full width under 640px, carrying `data-sheet`. It matches the exhbt editor's side sheets, so it is the app's sheet too.
- `BottomSheet` needs a `label`; a short list of actions wants `height="hug"`; one holding a text field needs `height="tall"`. `Drawer` and `BottomSheet` share `purpose: "info" | "form" | "required"`.
- `SelectableCard` is announced as a checkbox and `ClickableCard` follows its link in script. Neither is in the kit: one choice of many is a `RadioList`, and a card with one action is add-exhbt's pattern (a `Card` with one `Button` stretched over it).
- `Stepper` is for three to seven steps.

**The wrappers, as built.** Keep each one thin: it exists to hold a rule of the app, not to rename props. If one would only rename, do not write it, and say so.

```ts
// components/ui/Field.tsx  ("use client")
type FieldBase = {
  label: string;
  /** The native name, so a form posts it to a server action. */
  name?: string;
  /** Under the label. */
  hint?: string;
  /** An error from the server or the page: marks the field invalid and is tied to it. */
  error?: string;
  /** Uncontrolled use: the wrapper keeps the value. */
  defaultValue?: string;
  /** Controlled use. */
  value?: string;
  onChange?: (value: string) => void;
  required?: boolean;
  placeholder?: string;
  autoComplete?: string;
  disabled?: boolean;
};
export function TextField(props: FieldBase & { type?: "text" | "email" | "password" | "url" | "tel" | "search"; inputMode?: "text" | "email" | "url" | "tel" | "numeric" }): ReactNode;
export function TextAreaField(props: FieldBase & { rows?: number }): ReactNode;
export function CheckboxField(props: { label: string; name?: string; hint?: string; defaultChecked?: boolean; checked?: boolean; onChange?: (checked: boolean) => void; required?: boolean }): ReactNode;

// components/ui/Notice.tsx
/**
 * A message on the page: an Astryx Banner inside a live region, because Banner is not live by itself.
 * `live` defaults to "polite" for info and success and "assertive" for warning and error; "off" for a message
 * that is there when the page loads.
 */
export function Notice(props: {
  status: "info" | "success" | "warning" | "error";
  title: string;
  children?: ReactNode;
  /** One action, at the end. */
  action?: ReactNode;
  dismissable?: boolean;
  /** "section" runs the full width under a bar; "card" sits in the flow. */
  container?: "card" | "section";
  live?: "polite" | "assertive" | "off";
}): ReactNode;

// components/ui/toast.ts  ("use client")
/** `say("Link copied")` for a passing confirmation; `sayWith(...)` stays until dismissed, because it holds an action. */
export function useSay(): { say(message: string): void; sayWith(message: string, action: ReactNode): void; fail(message: string): void };

// components/ui/Sheet.tsx  ("use client")
/**
 * A panel over the page, as the portfolio editor's own sheet is: an Astryx Drawer at the side on a wide window
 * and the full width on a phone. `kind="form"` cannot be lost by a stray press outside it. `kind="actions"` on a
 * touch phone is an Astryx BottomSheet that hugs its short list instead. `name` goes on the root as data-sheet,
 * which the tests select by. `presentation` forces one or the other, for a test.
 */
export function Sheet(props: { name: string; title: string; subtitle?: string; open: boolean; onOpenChange(open: boolean): void; kind?: "actions" | "form" | "info"; footer?: ReactNode; children: ReactNode; presentation?: "drawer" | "bottom-sheet" }): ReactNode;

// components/ui/Confirm.tsx  ("use client")
/** Astryx AlertDialog for something that cannot be undone. The confirm button is the only destructive button on the screen. */
export function Confirm(props: { open: boolean; onOpenChange(open: boolean): void; title: string; body?: string; confirmLabel: string; onConfirm(): void | Promise<void> }): ReactNode;

// components/ui/Menu.tsx  ("use client")
export type MenuItem = { label: string; onSelect?: () => void; href?: string; danger?: boolean; /** Why it is off: shown under the label and read out. */ off?: string };
/** An Astryx DropdownMenu from a button you pass; `More` is the three-dot form (MoreMenu), named by `label`. */
export function Menu(props: { trigger: ReactNode; items: MenuItem[]; label: string }): ReactNode;
export function More(props: { items: MenuItem[]; label: string }): ReactNode;

// components/ui/Empty.tsx
/** Astryx EmptyState with the app's rule built in: a title that says what is empty, and exactly one next step. */
export function Empty(props: { title: string; body?: string; picture?: ReactNode; action: ReactNode; headingLevel?: 2 | 3 }): ReactNode;

// components/ui/Steps.tsx  ("use client")
/** Astryx Stepper. Throws in development if given fewer than three steps. */
export function Steps(props: { label: string; steps: { label: string; note?: string }[]; active: number; compact?: boolean }): ReactNode;

// components/brand/AddressLine.tsx
/**
 * A person's address as display type (decision 0033, the first of the six): the name, then the host from lib/hosts.ts.
 * "on-ink": the name in mint, the rest white. "on-white": the name in jade, the rest ink.
 */
export function AddressLine(props: { username: string; tone?: "on-ink" | "on-white"; size?: 1 | 2 | 3; as?: "p" | "h2" | "h3" }): ReactNode;
```

**The three checks.** All three leave out the design lab (`app/lab/`, `components/lab/`) and `themes/`: the lab is frozen for you, it is not part of the product, and it already holds things the checks would refuse (a floating button with `elevation="med"`, its own `shadow-pack` variables).

- `scripts/check-tokens.mjs`: the brand's values are declared twice, in `themes/exhbt/exhbtTheme.ts` and in the `@theme` block of `app/globals.css`, and nothing stops them drifting. Read both and fail if mint, the mint press colour, jade, ink, graphite, slate, line, mist, wash, the error red or white differ. Compare case-insensitively.
- `scripts/check-raised.mjs`: 0033's second rule. Count the files under `app/` and `components/` that use `shadow-pack`, or pass `elevation="low"`, `"med"` or `"high"` to anything. Hold today's list in the script as a baseline (about 33 files use `shadow-pack`). Fail when a file not on the list appears. Print how many are left. Later jobs shorten the list as they flatten a screen.
- `scripts/check-astryx-use.mjs`: in `app/` and `components/`, fail on an import of Astryx's `Carousel`, `ClickableCard` or `SelectableCard`, on an import of `Badge` outside a short allow-list held in the script (empty today: a count is the only use that would earn a place), and on a colour-named variant passed to an Astryx component (`blue`, `cyan`, `orange`, `pink`, `purple`, `red`, `teal`, `yellow`). Then a ratchet, like the one above: count raw `<input`, `<textarea`, `<select` and `<dialog` in `app/(app)`, `app/(marketing)` and `components/`, leaving out the folders a person's own page is drawn from (`components/portfolio`, `components/exhbt`, `components/charts`, `components/exhbt-editor`, `components/portfolio-editor`). Hold today's count per folder as the baseline and fail if any rises.

## Steps

Commit and push after each.

**Milestone 1: the dev page** (pushed first, so 1a can look at its theme on it)

1. `app/dev/astryx/page.tsx`: not found in production unless the build has `EXHBT_LAB=1`, as `app/dev/editor-timing/page.tsx` does. Its own `<main id="main">`; one heading; a section for each group below, each with a short plain line saying what the group is for.
2. If the lab's `components/lab/samples.tsx` is in your base and its samples suit, draw from them; do not edit them. Show, in every state it has (rest, hover and focus where a still page can show them, filled, invalid, disabled), straight from Astryx with no local styling: `Heading` at levels 1 to 3 and `type="display-1"` to `display-3`; `Text` in each type; `Button` in each variant through `components/ui/Button.tsx`; `TextInput`, `TextArea`, `CheckboxInput`, `RadioList`, `Switch`, `SegmentedControl`, `FileInput`; `Card`; `Banner` in its four statuses, as a card and as a section; `Drawer`, `Dialog` and `BottomSheet` (each opened by a button, and a `Dialog` shown `isInline`); `DropdownMenu`, `MoreMenu`, `Popover`, `Tooltip`; `Toast`; `TabList`; `Stepper` with three and with five steps; `Toolbar` with an `IconButton` or two; `StatusDot`, `Token`; `ProgressBar`, `Skeleton`; `EmptyState`; `List` with `Item` rows; `Link`.
3. Beside each one the site hand-builds today, show the hand-built thing with its own class: a `.field` input under a `.label` with a `.hint`; a `.chip`; the native `<details>` question from `components/home/Faq.tsx`; a native `<dialog>`. Label the two "Astryx" and "Today".
4. Push. Tell the main session the page is in.

**Milestone 2: the wrappers**

5. Build each wrapper in the block above, in that order. After each, add it to the dev page under "The app's own parts" with one live example.
6. `Field.tsx`: prove on the dev page that a `TextField` with a `name` inside a plain `<form>` posts its value, with and without a `defaultValue`, and that an `error` is read out with the field. Label text passes through unchanged: do not turn "(optional)" in a label into Astryx's Optional mark, because the tests find fields by their labels and the screens that own those labels will decide.
7. `Notice.tsx`: the outer element is the live region; the `Banner` is inside it.
8. `Sheet.tsx`: start from the portfolio editor's file, taking `open` and `onOpenChange` as props where it reads the portfolio's runtime. Add the one thing it lacks: on a touch phone, `kind="actions"` draws an Astryx `BottomSheet` with `height="hug"`. When both wrappers are on `main`, the portfolio editor's can become a two-line import of yours; say so in your report, and do not touch it.
9. `AddressLine.tsx` (named so as not to be confused with the portfolio editor's own `Address.tsx`, which reads the browser's address): the host comes from `portfolioHost`, never from a typed string. A name `USERNAME_RE` would refuse is drawn as given: checking is the caller's job.

**Milestone 3: the checks**

10. The three scripts, each run from `package.json` (`check:tokens`, `check:raised`, `check:astryx`) and added to the `check` script after `check:theme`. One CI step runs all three.
11. Prove each fails: plant one fault for each (a changed hex in a scratch copy of the theme; a `shadow-pack` in a new file; a raw `<input>` added to a counted folder), see the failure, take the fault out. Put the three failure messages in your report.
12. `e2e/astryx-kit.spec.ts`, on `/dev/astryx`:
    - axe finds nothing, with a dialog open and with a menu open as well as at rest;
    - a `TextField` reached by Tab has an outline in jade (if 1a's milestone 1 is not in your branch yet, mark this one case `fixme` with that reason and say so; it is the only case you may hold back);
    - a `Notice` with `status="info"` sits in an element with `role="status"`, and one with `status="error"` in `role="alert"`;
    - the `Sheet` is a drawer at the side at 1440 wide; in a block that sets a 390 by 844 touch viewport with `test.use`, a `kind="actions"` sheet is a bottom sheet and a `kind="form"` sheet fills the width; Escape closes each and focus goes back to the button that opened it;
    - with reduced motion emulated, opening the `Sheet` leaves `document.getAnimations()` empty;
    - `AddressLine` for "priya-shah" shows the name and the host `portfolioHost` gives;
    - `Steps` with two steps throws in development.

## Done looks like

`/dev/astryx` shows every part the plan uses, in Exhbt's theme, beside today's hand-built versions. Eight wrappers and `AddressLine` exist, are used nowhere yet, and each has a live example and a test. `npm run check` runs three new checks, each proven to fail on a planted fault. No screen a student can reach has changed.

## Report back

The branch head after each milestone. For each wrapper: its signature as built (it must equal the block above; any change named, with why), and any that you did not write because it would only rename props. What `TextInput` did with a native form. Whether `useToast` needed a provider. The baselines the two ratchets start from, per folder. The three planted-fault messages. The spec's results and how long it takes. Screenshots of `/dev/astryx` at 1440 and 390.

Run: `e2e/astryx-kit.spec.ts`, `e2e/a11y.spec.ts`.

## Rules for every agent

1. **Read first:** `AGENTS.md`, `DESIGN.md`, `docs/MAP.md`, and the decision records this brief names. The brief says what to build; the records say why.
2. **Branch:** work only on the branch named above, made from the base named above. Never commit to `main` or a release branch (`phase-2-appeal`, or the portfolio build's `phase-2-pf0` to `phase-2-pf4`). Open no pull requests. The main session merges.
3. **Your files only.** Change the files this brief says you own. If something you need is in a file you must not touch, stop that part, carry on with the rest, and say exactly what you need in your report. Do not work round it with a copy.
4. **Commit and push after every working step.** The account's usage limit can stop you without warning, and only what is pushed survives. A step is small: one function with its test, one component that renders. Push each time (`git push -u origin <your branch>`).
5. **Before every commit, run all four:** `npx tsc --noEmit -p .` ; `npm run lint` ; `npm run check:docs` ; `npm run check:theme`. Then `git checkout -- tsconfig.json` if `next dev` rewrote it.
6. **Playwright:** run only the spec files this brief names, one worker, on your own port: `E2E_PORT=<your port> npx playwright test <file> --workers=1`. Never run the whole suite. Never skip, weaken or delete a test to make it pass, unless this brief names the case.
7. **Commit messages:** plain British English, what changed and why, first line under about 70 characters. An Opus agent ends with these two lines:
   `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
   `Claude-Session: https://claude.ai/code/session_01SXCVQu8yRBVXtcSEG6wWoZ`
   Any other model names itself in the first line and keeps the second as written.
8. **House rules that bite here:** on a person's own page, colours, faces and corners come only from the look's variables (`--pf-*`, `--xp-*`); everywhere else every control is an Astryx component in the theme's tokens, with no fixed colour, pixel size or timing; buttons are Astryx Buttons through `components/ui/Button.tsx`; lower-case "exhbt" in running text; plain British English with no hype words; no plan figures in prose or in a UI string (read them from `lib/entitlements.ts`); Claude Haiku is the only model the app names (`lib/ai/model.ts`); data access goes through the `Store` interface; never edit an applied migration; never commit a secret.
9. **If something you wait for lands after you started,** the main session will tell you. Then merge the release branch into yours (`git fetch origin && git merge origin/<release branch>`); never rebase a branch you have pushed.
10. **If you are resumed after a stop:** run `git status` and `git log --oneline -5` first, commit and push anything on disk that works, then carry on from the step list.
11. **Never run anything that calls the Anthropic API.** Do not set `ANTHROPIC_API_KEY` or `ANTHROPIC_API_KEYS`.
12. **Visitors' pages are protected.** Do not edit `app/(portfolio)/**`, `lib/portfolio.ts` or `lib/plan-rules.ts` (`npm run check:protected` fails if you do), never regenerate a golden copy, and keep to the frozen list in this folder's README. The theme, `app/layout.tsx` and `components/ui/Button.tsx` all reach a page an employer reads.
13. **Read Astryx before you build with it.** `docs/design/astryx-agent-guide.md`, then `npm run astryx -- docs principles`. Read each component you use with `npm run astryx -- component <Name>`: take prop names, theming keys and public variables from there, never from memory or from a review. `npm run astryx -- theme targets` lists every theming key. The installed version is 0.7.11; do not raise it.
14. **Look at what you build.** Open it in the browser at 1440 and at 390 wide, take screenshots (deviceScaleFactor 2), read them, and fix what looks rough before you report. Save them under `/tmp/claude-0/-home-user-Exhbt/8f68944d-9b6a-5167-8a40-0d82c10fe3df/scratchpad/appeal-build/1b/`, or the folder the main session gives you, and name each file in your report. If `.claude/skills/impeccable/` is in your branch, read its `reference/craft-floor.md` before you build and `reference/polish.md` before you report.
15. **The shared machine** has four cores and 15 GB, and has been running out. Run one spec file at a time, stop your dev server when you are not testing, and do the reading and writing first. A test that fails with "Page crashed", "Target crashed" or `ERR_ABORTED` is run once more on its own before you treat it as a failure.
