# Brief A: the edit page's switch, the gate and the crash fallback

| | |
|---|---|
| Release | 3, the editor (its first, short part) |
| Model | Opus |
| Branch | `phase-2-r3-a-gate`, made from `phase-2-r2` once E is merged there, or from `phase-2-r3` if that exists when you start |
| Port | 3305 |
| Starts when | E (which put in `editorKind()`) is merged into `phase-2-r2`. Your branch is merged into `phase-2-r3` first thing, before anyone else's, and never into `phase-2-r2`: it changes what the edit page serves. G starts when you are merged, and takes over every file you made |

## Goal

Make `/exhbts/<id>/edit` serve the new editor by default and keep the classic editor one step away, safely: the edit page's switch, the gate that draws the new editor only in the browser inside an error boundary, the loading stand-in, the route's own error page, and the test projects the other agents need. The editor itself is G's; you leave stubs for G to fill. This is split from G so it can be built and proven first, in one short run.

## Read first

`docs/decisions/0026-edit-on-page-editor.md`: "One page, one renderer" (the list of what is in the flow in the editor only), "The classic editor: the switch, the fallback, the escape", "Saving". `docs/briefs/edit-on-page/README.md`: "The kill switch, and how it is tested". On your base: `lib/editor-kind.ts` (`editorKind()`, E's), `app/dev/editor/route.ts` (E's: sets the development cookie), `app/(app)/exhbts/[id]/edit/page.tsx`, `components/editor/Editor.tsx` (its props), `components/portfolio/ProjectView.tsx`, `components/portfolio/page-ctx.ts`, `app/dev/edit-slots/` (C's stand-in adapter: yours is close to it), `components/portfolio/themeFonts.ts` (`lookAttrs`, `themeStyle`), `themeFor` in `lib/portfolio-themes.ts`, `app/(portfolio)/p/[username]/[slug]/layout.tsx` (how a public page gets its look), `playwright.config.ts`.

## You own

Until you are merged; then G owns all of them:
- `app/(app)/exhbts/[id]/edit/page.tsx`, `app/(app)/exhbts/[id]/edit/error.tsx` (new)
- `components/exhbt-editor/EditorGate.tsx`, `EditorShell.tsx` (a stub), `StandIn.tsx`, `context.ts` (the props type only), `pending.ts` (a stub): all new
- `playwright.config.ts`
- `e2e/editor-classic.spec.ts` (new)

## You must not touch

`lib/editor-kind.ts` and `app/dev/editor/` (E's, done), `lib/site.ts`, `components/editor/`, `lib/exhbt/`, `components/portfolio/`, `app/globals.css`, `wrangler.jsonc`, `next.config.ts`, the existing specs.

## What you build against

From E, on your base:

```ts
// lib/editor-kind.ts  (new, server only: its first line is import "server-only")
export type EditorKind = "page" | "classic";
/** Which editor /exhbts/<id>/edit serves. "classic" only when the runtime variable EXHBT_EDITOR is "classic". Read on each request. */
export async function editorKind(): Promise<EditorKind>;
```

In development, `GET /dev/editor?kind=classic|page` sets a cookie that `editorKind()` reads, for that browser only; `?kind=` clears it.

The adapter type from `components/portfolio/page-ctx.ts` (C's, release 2): read it on your base. Your stand-in implements `EditAdapter`.

What you make, word for word, for G to take over:

```ts
// components/exhbt-editor/context.ts  ("use client")   (yours: this type only; G adds the rest of the file)
import type { PortfolioTheme } from "@/lib/portfolio-themes";
import type { EditorProps } from "@/components/editor/Editor";

/** What the edit page passes: the classic editor's props, plus the person's look and the stored reports a figure can be taken from. */
export type PageEditorProps = EditorProps & {
  theme: PortfolioTheme;
  /** The person's stored PDFs for this exhbt, for "Take a figure from my report" when nothing was picked. */
  reportFiles: { fileId: string; name: string; url: string }[];
};

// components/exhbt-editor/EditorShell.tsx  ("use client")
export function PageEditor(props: PageEditorProps): React.ReactNode;

// components/exhbt-editor/pending.ts  ("use client")
/** Sends the newest doc to the server if it has not got it; resolves when that lands or after three seconds. Your stub resolves at once. */
export function flushPending(): Promise<void>;

// components/exhbt-editor/StandIn.tsx  (no hooks, no state: it is in the gate's own chunk)
/** The adapter the loading view draws with: everything 0026 puts in the flow in the editor only (EDIT_ONLY_IN_FLOW), inert; every other control left out. */
export function standInAdapter(): EditAdapter;
```

## Steps

Commit and push after each.

1. **`context.ts`** with the props type above and nothing else. **`pending.ts`**: `flushPending` resolves at once.
2. **The edit page.** The classic editor when `searchParams.editor === "classic"` or `(await editorKind()) === "classic"`, wrapped in `<div data-editor="classic">`, with one line above it when it was asked for by the query: "You're in the classic editor." and a link, "Back to the new editor". Otherwise `EditorGate`, with two more props than the classic editor takes: `theme` (the look the person's public pages use: as `app/(portfolio)/p/[username]/[slug]/layout.tsx` gets it, and `themeFor(profile, plan)` for someone with no username yet) and `reportFiles` (the person's stored PDF files attached to this exhbt, kind `source`, leaving out the draft's helper files, each with a signed link; an exhbt started from scratch has none). In development only, `?crash=server` makes the page throw on the server, for the error page's test.
3. **`StandIn.tsx`**: `standInAdapter()`, close to C's harness adapter but drawing what the live editor will draw in the flow: `text` and `rich` draw the value as the page draws it, or, when empty, the field's placeholder in the part's own element with `--xp-muted`, inert; `item` draws `ItemView` inside a `<div>` carrying `rowClass`, as G's frame will; `skills` draws the read-only pill list with the "Add a skill" box after the last pill, inert, the size of a pill, holding its words in `--xp-muted` (the box alone when there are no skills: it is the skills block's placeholder); `extra` with `where: "below"` on an image draws the description field inert, as J will draw it, in the caption's type: the stored description when there is one, wrapping as the field will, and otherwise one line holding "Describe it for people who can't see it" in `--xp-muted`; `work` draws the work button, or "Add the work" when there is none; the flowchart's `box` returns the `<li>` it is given; `insert`, `list`, `tools`, the other `extra` slots and the flowchart's `tools` and `add` return null (controls take no room, so leaving them out moves nothing). 0026's list of what is in the flow in the editor only (`EDIT_ONLY_IN_FLOW`: the placeholders and the two edit-only fields) is exactly what it adds to the visitor's page, so nothing moves when the editor arrives.
4. **`EditorShell.tsx`, the stub**: `PageEditor` draws `<div data-editor="page" data-ready="true">`, an empty bar where the top bar will be (`height: var(--xe-topbar-h, 3.5rem)`; G defines the variable in `css/core.css` and H's bar is that tall), and the canvas: the person's look (`lookAttrs(theme)`, `themeStyle(theme)`) at the public frame's width, holding `ProjectView` with `headingLevel="h2"` and `edit={standInAdapter()}`. In development only, `?crash=render` makes it throw on its first render. G replaces it.
5. **`EditorGate.tsx`: the new editor is never rendered on the server.** A small client component holding an error boundary and `PageEditor`, loaded with `next/dynamic` and `ssr: false`. An error boundary cannot catch a throw during the server's render, so the editor must not be drawn there. While the chunk loads, the gate draws exactly what the stub draws (the bar and the canvas with the stand-in), so the fields come alive in place and nothing moves. The boundary catches a throw while the editor draws and a chunk that fails to load: it logs the error, shows "Something went wrong with the new editor. Your work is saved.", awaits `flushPending()` (three seconds at most), and calls `location.replace` with `?editor=classic` added to the address.
6. **`error.tsx`** for what the boundary cannot see (the page failing on the server): the same words, and a link to the classic editor (`?editor=classic`), or "Reload" when the classic editor was the one asked for.
7. **The test projects** in `playwright.config.ts`, as the other agents' briefs expect:
   ```ts
   { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } }, testIgnore: /editor-(phone|tablet)\.spec\.ts/ },
   { name: "mobile", use: { ...devices["Pixel 7"] }, testMatch: /responsive\.spec\.ts/ },
   { name: "touch", use: { ...devices["Pixel 7"] }, testMatch: /editor-(drag|flow|phone)\.spec\.ts/ },
   { name: "tablet", use: { browserName: "chromium", viewport: { width: 820, height: 1180 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }, testMatch: /editor-tablet\.spec\.ts/ },
   ```
   Keep everything else in the file as it is. `editor-drag` and `editor-flow` run on desktop and touch; `editor-phone` on touch only; `editor-tablet` on tablet only.
8. **`e2e/editor-classic.spec.ts`**: after `/dev/editor?kind=classic` the edit page serves `[data-editor="classic"]`, and after `?kind=page` the new one (`[data-editor="page"]`); a fresh browser context is not affected by another's cookie; `?editor=classic` serves classic for that request, with the line and the way back, which works; `?crash=render` shows the notice and ends in `[data-editor="classic"]`; `?crash=server` shows the route's error page with its link to the classic editor; `/api/health` reports the kind (read `editor` from its JSON body and ignore the status: in the e2e environment it answers 503, having no database; E's `e2e/editor-switch.spec.ts` does the same). G adds the `?crash=change` test when it takes the file over.

## Done looks like

The four checks pass; `e2e/editor-classic.spec.ts` passes on the desktop project; `e2e/editor-classic-keeps.spec.ts` (E's, which opens `?editor=classic`) and `e2e/edit-slots.spec.ts` still pass. Expect the older editor specs that open a bare `/edit` to fail once you are merged: N's first step points them at `?editor=classic` straight after your merge. List the ones you saw fail.

## Report back

The branch head; whether `reportFiles` could be filled, and from where; anything in `page-ctx.ts` that made the stand-in hard to match the visitor's page; the specs you ran and their results, with how long each took.

## Rules for every agent

1. **Read first:** `AGENTS.md`, `DESIGN.md`, `docs/MAP.md`, and the decision records this brief names. The brief says what to build; the records say why.
2. **Branch:** work only on the branch named above, made from the base named above. Never commit to `phase-2`, `main` or a release branch (`phase-2-r2`, `phase-2-r3`, `phase-2-r4`, `phase-2-r5`). Open no pull requests. The main session merges.
3. **Your files only.** Change the files this brief says you own. If something you need is in a file you must not touch, stop that part, carry on with the rest, and say exactly what you need in your report. Do not work round it with a copy.
4. **Commit and push after every working step.** The account's usage limit can stop you without warning, and only what is pushed survives. A step is small: one function with its test, one component that renders. Push each time (`git push -u origin <your branch>`).
5. **Before every commit, run all four:** `npx tsc --noEmit -p .` ; `npm run lint` ; `npm run check:docs` ; `npm run check:theme`. Then `git checkout -- tsconfig.json` if `next dev` rewrote it.
6. **Playwright:** run only the spec files this brief names, one worker, on your own port: `E2E_PORT=<your port> npx playwright test <file> --workers=1`. Never run the whole suite. Never skip, weaken or delete a test to make it pass, unless this brief names the case.
7. **Commit messages:** plain British English, what changed and why, first line under about 70 characters. End with your own attribution lines, then the line `Claude-Session: https://claude.ai/code/session_01SXCVQu8yRBVXtcSEG6wWoZ`.
8. **House rules that bite here:** colours and corners on the exhbt page come only from the `--xp-*` variables; buttons in app chrome are Astryx Buttons through `components/ui/Button.tsx`; lower-case "exhbt" in running text; plain British English with no hype words; no plan figures in prose; Claude Haiku is the only model the app names (`lib/ai/model.ts`); data access goes through the `Store` interface; never edit an applied migration; never commit a secret.
9. **If something you wait for lands after you started,** the main session will tell you. Then merge the release branch into yours (`git fetch origin && git merge origin/<release branch>`); never rebase a branch you have pushed.
10. **If you are resumed after a stop:** run `git status` and `git log --oneline -5` first, commit and push anything on disk that works, then carry on from the step list.
