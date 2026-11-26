# Brief E hand-over: what is left of milestone 2

Written by agent E on 26 Nov 2026 for whoever takes over E's files. Read `e-editor-core.md` (the brief) and `e-milestone-1.md` (the contract changes) first; this file holds only what is not in them.

## Where things stand

**Update, 26 Nov 2026 (E's successor, branch `phase-2-pf-e2`): milestone 2 is built and merged into `phase-2-pf2` (7b0e4cf). Everything below this note is E's hand-over as written, kept for its traps.**
- **Done, each with its tests in `e2e/portfolio-core.spec.ts`:**
  - steps 12 to 18;
  - step 19's render counts, charts counted from the spec;
  - the box-for-box check of the six looks, by `HOME_BOXES` landmarks;
  - the mirror path (`E2E_GROW=mirror`);
  - axe;
  - `WorkRow` for F.
- **Since then:**
  - a line's limit no longer counts its year (`lineWords`, `lib/portfolio-layout.ts`);
  - See as a visitor says why nothing is live, by case;
  - the Back check allows the servers' clocks two seconds (below, "The Back fix's limit").
- **On a production build:** `npx playwright test -c playwright.prod.config.ts` builds the app and runs "Coming back to the page, with nothing of development's" against `next start`. It uses the stand-in store with `EXHBT_ALLOW_MEMORY_STORE`, and it signs in through `/auth/dev`.
  - `/auth/dev` honours that switch only when Supabase is not configured.
  - Checked by hand with `next start`: with Supabase settings present it answers 404 both with and without the switch, and it also answers 404 with neither.
  - On 26 Nov both tests passed on the production build. Back behaved as on the development server: two fetches of the page, no wait on the stand-in.
  - One difference: in production the header's link prefetches `/portfolio`.
- **Not done:** nothing has run on WebKit itself.


- **Milestone 1** is merged into `phase-2-pf2` (67e13c8).
- **Milestone 2, step 17's safety half** is done and tested (a72bbd9): the browser's Back can no longer bring old words back (below, "The Back fix"). The same commit adds `usePortfolioUndo()` to `runtime.ts` for G and exports `WRAP`, `ROWS` and `CARD` from `PortfolioHome.tsx` for F.
- **Everything else in milestone 2 is not built.** For four of the steps a draft is in this branch, **written and typechecked but never run**. None of them is imported by anything, so none changes what the editor does today. Wire them one at a time, each with its test.

| Draft | For | State |
|---|---|---|
| `components/portfolio-editor/VisitorView.tsx` | step 18 | not imported |
| `components/portfolio-editor/Address.tsx` | step 17 (the query and the hash) and the note after `?at=` | not imported |
| `components/portfolio-editor/Notices.tsx` | steps 15 and 16 | not imported |
| `components/portfolio-editor/keep.ts` | step 15 | not imported |
| a new `issuesOf` for `app/(app)/portfolio/builder-state.ts` | step 13 | written out under step 13 below, **not in the code** |
| `when` on `ui/Sheet.tsx` | brief I | in the code, and changes nothing until a caller passes it |

Already live from milestone 1, with no test of its own yet: undo's recording and `undoLast` (`runtime-core.ts`, `undo.ts`), `SaveStatus`'s words (`ui/SaveStatus.tsx`), `jumpTo`, `open`/`close`, `previewLook`, `seeAsVisitor` (it sets `ui.visitor`; nothing draws the view).

## A map of the runtime

**Who owns the state.** `useBuilder` does, in `PortfolioEditor` (`PortfolioEditor.tsx`). It holds the newest `BuilderState`, debounces the save (0.6s), flushes when the tab is hidden and when it unmounts, and owns the save status. Nobody may change it. `rt.state` (an atom, `runtime-core.ts`) is a mirror of it, and `change()` in `runtime-core.ts` is the state's one writer.

**How a key reaches `useBuilder`.**
1. A field calls `api.setAt(path, words)` (`fields/TextField.tsx`, `fields/ParasField.tsx`).
2. `setAt` is `change((s) => setAtPath(s, path, words))`. `setAtPath` (`paths.ts`) shares everything it did not touch, and returns the same state when nothing changes.
3. `change` calls `host.change(updater)`, which is `useBuilder`'s own `change`. `useBuilder` runs the updater at once on its newest state. Inside the updater the new state is noted for the crash fallback (`notePending`).
4. Straight after, `change` puts that same object in `rt.state` and recomputes `ui.issues`.

Step 4 is why the atom is written through and not copied from `useBuilder`'s state in an effect: the fields are controlled, and React puts a field's old words back unless its new value arrives in the same event. Every subscriber of the atom re-renders inside the key's own event.

**What draws again on a key.**
- `PortfolioEditor` itself (`useBuilder`'s `setState`). Its child `Shell` is memoised with stable props, so that stops there.
- `Canvas` (`useEditingHome` reads the whole state), so `PortfolioHome` and the hero.
- One section. `adapter.tsx` wraps each section in `SectionSlot`, a memo boundary whose comparison (`sameSection`) reads the props the page gave the section element and knows which sections read which part. **Trap:** if a section starts reading something new (the contact section reading the name, say), `sameSection` must learn it, or the section goes stale and a field in it stops taking keys. Any prop it does not know redraws, which is the safe way to be wrong.
- The fields are memoised on plain values. Cards and figures are memoised in `PortfolioHome.tsx` on the exhbt object, which only a refresh replaces.

**Lines.** A line's two halves are two fields at one path. The stored line cannot hold a half as typed (`joinYear` trims, and "20" is not a year yet), so `rt.lines` keeps both halves as typed, valid only while the stored line is still the one they made (`LinePart` in `fields/TextField.tsx`). Anything else that changes the line (Undo, a move) makes the draft stop matching, and the fields show what `splitYear` reads.

**Paragraphs.** `ParasField` has no state of its own. The stored text is the paragraphs joined by exactly one blank line and split on exactly that, so an empty paragraph just started is in the state. Each paragraph's box is a `<p>` because Astryx's reset sets every bare `<p>` to the body size: on visitors' pages the intro's paragraphs are 16px, whatever `[data-intro]` says. About me is one paragraph (the server one-lines it).

**Undo.** `change(update, label)` with a label calls `entryFor(label, before, after)` (`undo.ts`): it walks the two states side by side, and for each key that differs keeps either its value before or, for a list that changed by one add, remove or move, that one step by place. The stack is in `createRuntime` (30 entries); `rt.undo` holds the newest label for the button. `undoLast` pops, applies `applyUndo` through `change` with no label, says "Undone: …", then moves the focus (to the section it brought back, else Undo, else the bar's heading). G reads it through `usePortfolioUndo()`.

**Where pending saves wait.** `pending.ts`, module-level, in the gate's chunk: `newest` (noted in every change), `serverHas` (noted when a save lands), `savedAt` (the server's time of the newest save that landed), and `sending` (saves on their way, counted by `noteSending` in `PortfolioEditor`'s save wrapper). `flushPending` (the crash fallback) and `settledSaves` (the gate) both wait for saves on their way first. `registerSender` runs once per mount, with the mount's own state: a refresh must not reset `newest`.

**Data.** `DataContext` is the page's props, the newest after a refresh. The state never follows a refresh: `visit.loaded` is what the editor opened with.

## The Back fix

`savePortfolioAction` does not revalidate, so Next keeps the page as first loaded and can hand it back on the browser's Back. With the fix off, the two tests in "Coming back to the page" fail with the old name and the old location back in the state.

- `loadPortfolioData` stamps `loadedAt` (server time, before it reads). The save action already returns `savedAt`.
- `isBehind(owner, loadedAt)` in `pending.ts`: a save is on its way, or one landed at or after the load.
- `useFresh` in `PortfolioGate.tsx`: while behind, the gate draws the stand-in (from `lastState(owner)`, the words the person left), waits for saves on their way, calls `router.refresh()`, and mounts the editor only on data loaded after the newest save. After ten seconds it says the newest copy could not be fetched, with "Try again".
- The gate also refreshes in the background when it mounts just after a history move (`movedAt`), for what other pages changed (an exhbt's title). `PortfolioEditor` does the same on `pageshow` with `persisted`.

**Not covered, and known:** other pages Next has kept (the exhbts list, the account page) can still show an older portfolio after Back, since nothing purges them. Before the fix the step builder's `revalidate()` did.

### The Back fix's limit, and the proper fix for after launch

Added 26 Nov 2026 by E's successor.

- **The limit.** `loadedAt` and `savedAt` are each stamped with `new Date()` by whichever server instance answers. Two instances can disagree. So the gate trusts a load only when it is newer than the newest landed save by more than `SKEW_MS` (2000, `pending.ts`).
  - If clocks differ by up to two seconds, old words cannot come back.
  - If the instance that served a load made *before* a save has a clock more than two seconds ahead of the instance that took the save, that load passes as newer. The editor would then open on old words. `e2e/portfolio-core.spec.ts` pins both sides: 1.5s is caught, 3s is the limit.
- **What the margin costs.** A load made within two seconds after a save counts as behind. The gate then waits on the stand-in until two seconds have passed since the save's answer, measured on the browser's own clock and used only as a delay. It then fetches once.
  - It never asks again sooner than 250ms, so it does not spin.
  - Coming back more than two seconds after the last save costs nothing.
  - Both cases are tested.
- **The proper fix (decided against before launch: it writes to the live database and puts a trigger on every profile update).** Use a counter from one source in place of the two times.
  - A migration:
    ```sql
    alter table profiles add column portfolio_version bigint not null default 0;
    create function public.bump_portfolio_version() returns trigger language plpgsql as $$
    begin new.portfolio_version := old.portfolio_version + 1; return new; end $$;
    create trigger profiles_portfolio_version before update on profiles
      for each row execute function public.bump_portfolio_version();
    ```
  - `PortfolioProfile` gains `version`. The in-memory store keeps a counter and bumps it in `updatePortfolioProfile` and `savePortfolioLayout`.
  - `savePortfolioLayout` writes the `profiles` row last, after the exhbts' hidden flags and positions (today it writes it first). It returns `{ version }` from `.select("portfolio_version").single()`.
  - The action returns `savedVersion` and the loader gives `loadedVersion`, read with the profile.
  - `staleness` becomes `loadedVersion < savedVersion`, with no margin and no wait.
  - Any other profile update (a plan change) only raises the number. A load can then look newer, never older, which is the safe way to be wrong.

**How the gate behaves when the server is slow:** it waits on the stand-in, and after ten seconds shows the warning. If newer data then arrives it mounts the editor by itself. If a save that was on its way never gets an answer, it stays on the stand-in until the browser gives that request up, since it cannot know what the server holds.

## What is left, step by step

### Step 12: undo's tests, and Ctrl or Cmd and Z

- **Plugs in:** a component in `Shell` (`PortfolioEditor.tsx`):

```tsx
const inField = (el: Element | null) => Boolean(el?.closest('textarea, input, select, [contenteditable]:not([contenteditable="false"])'));
function UndoKeys(): ReactNode {
  const rt = useRuntime();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey || e.key.toLowerCase() !== "z") return;
      if (inField(document.activeElement) || !rt.undo.get().label) return;
      e.preventDefault();
      rt.undoLast();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [rt]);
  return null;
}
```

- **Traps:** nothing on the page makes a labelled change until F and G land, so the test makes its own through the development handle (`window.__portfolioEditor.api.change` cannot be passed a function from the test: add a small helper to `e2e/portfolio-editor.ts` that runs `page.evaluate` with the update written inside it). Labels arrive in the past tense ("removed Experience", "moved About me"), and the button reads "Undo: removed Experience".
- **Test:** remove a section and move another by `change` with labels; type in the headline; Undo twice; the sections are back in order, the headline keeps its words, the button's name follows the stack, and the status reaches Saved. Then Ctrl+Z with the cursor in a field does the field's own undo and leaves the stack alone. `undo.ts` has no React in it: its rules (a line removed, then another line typed in, then Undo keeps the typing) can be checked in-process, as `e2e/phase2-builder.spec.ts` checks the profile rules.

### Step 13: problems at the field

- **Plugs in:** it is wired. `issuesOf` (`builder-state.ts`) gives `ui.issues`; each field reads its own with `useIssue(path)` (`fields/issue.tsx`) and gets `aria-invalid`, the look's outline and the exhbt editor's `xe-issue` note; `SaveStatus` shows "Not saved: …" with "Show me", which calls `jumpTo` on the first key of `ui.issues`.
- **The too-long line does not work yet.** `checkTiles` keys every line problem at `education.lines`, where no field is, so today an over-long line gives "Not saved" with a "Show me" that finds nothing and no outline. Replace `issuesOf` with this, which reads the same schema with the whole of each problem's path (it needs `TILE_KINDS` and `TilesSchema` from `lib/portfolio-layout`). The problem is then at `arrangement.tiles.education.lines.1`, and `LinePart` shows it on the words half. Only "too many lines" stays at the list's path, which F's `LineTools` carries.

```ts
export function issuesOf(s: BuilderState): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, message] of Object.entries(profileProblems(s.profile))) if (message) out[`profile.${k}`] = message;
  const shown = tileKindsShownBy(s.arrangement.sections);
  for (const kind of TILE_KINDS) {
    if (!shown.includes(kind)) continue;
    const one = TilesSchema.safeParse({ [kind]: s.arrangement.tiles[kind] });
    if (one.success) continue;
    for (const issue of one.error.issues) out[`arrangement.tiles.${issue.path.map(String).join(".")}`] ??= issue.message;
  }
  return out;
}
```
- **Traps:** the first key of `ui.issues` must stay the problem `problemOf` names (both read the profile first, then the tiles in `TILE_KINDS` order). The links' problems (`LINK_PATHS` in `paths.ts`) have no field until G's popover is open: `jumpTo` opens "links" and retries for thirty frames.
- **Test:** thirteen words in the headline: the status says "Not saved:" with the limit's words, the field is invalid and its note shows while it has the focus, a reload shows the old headline (nothing was sent), "Show me" from another field puts the cursor back; delete a word and it saves. Then a fifteen-word line of education: the same, at the line.

### Step 14: the status words

Built in `ui/SaveStatus.tsx` (`useLive`), not tested. Test "Saved · live" on a Max fixture with an exhbt published and listed, "Saved" on Free, and that hiding every exhbt drops "live".

### Step 15: after a deploy

- **Plugs in:** `keep.ts` and `KeptOffer` in `Notices.tsx` (drafts), `<Notices />` in `Shell` under the bar, and the save wrapper in `startVisit` (`PortfolioEditor.tsx`), which becomes:

```ts
async function send(state: BuilderState): Promise<SaveResult> {
  if (rt.save.get().stale) {
    keepUnsaved(owner, state);        // every later state follows the first into the browser
    return { ok: false, error: STALE_EDITOR };
  }
  try {
    …as now…
  } catch (e) {
    if (!isStale(e)) throw e;
    rt.save.set((v) => ({ ...v, stale: true }));
    keepUnsaved(owner, state);
    return { ok: false, error: STALE_EDITOR };
  }
}
```

- **Traps:** the kept copy is keyed by `data.owner` and a day old at most: on a shared computer the next person must not be offered it. It is taken out of the browser as the editor opens, so it is offered once. `?save=stale` stays in the address across a reload, so the test's "reload" is `page.goto("/portfolio")`. A state the rules refuse is never sent, so it is never kept.
- **Test:** open with `?save=stale`, type, see "The site was updated. Reload to carry on" and Reload; go to `/portfolio`; the offer is there; take it; the words are back, Undo names the step, and it saves. Reload again: no offer.

### Step 16: two tabs

`OtherTab` in `Notices.tsx` (draft), a `BroadcastChannel`. Test with two pages in one browser context: the note shows in both, goes when one closes, and the last save wins after a reload.

### Step 17: the query and the hash

- **Plugs in:** `<Address />` (draft) in `Shell`. It needs Astryx's `ToastViewport` round the editor for the note at the foot of the window: wrap `Shell`'s root in `<ToastViewport position="bottomEnd">`. Without it `useToast` makes a viewport of its own outside the app's theme.
- **What it does:** reads `open`, `at`, `full`, `joined`, `left`, `step` and the two hashes once, sets `ui.full`, `ui.team` and `ui.marked`, calls `api.open(...)`, then `history.replaceState`. G's sheets and popovers follow `ui.sheet` and nothing else, so `api.open` is all it has to call.
- **Traps:**
  - In development React runs the effect twice. The first run cleans the address, so the second finds nothing: keep it that way, and never clear the two-second timer in a cleanup.
  - `?at=` finds `[data-card="<id>"]`, the band, or `[data-tile="<id>"]`, which F must put on an owner-only tile.
  - `TeamPanel`'s `said` and `full` are read by the server page from the same query. Once the address is cleaned, the next `router.refresh()` draws the panel without them. Either keep `joined`, `left` and `full` in the address until the Team sheet closes, or have `page.tsx` not depend on them and let the panel read `ui.team` and `ui.full`.
  - F's Add tile waits on `ui.full`.
- **Test:** each `?open=` value sets `ui.sheet` and leaves `/portfolio` clean; `?at=` marks the tile for two seconds and, for a live exhbt, shows "<title> is live at <address>" with Copy link; `?step=you` puts the cursor in the name; the two hashes; an unknown value is left alone.

### Step 18: See as a visitor

- **Plugs in:** in `Shell`, replace `<Canvas />` with:

```tsx
function Body(): ReactNode {
  const visitor = usePortfolioUi((u) => u.visitor);
  return visitor ? <VisitorView /> : <Canvas />;
}
```

- **Traps:** `visitorHome` (`home-props.ts`) uses `personOf` and tidied tiles, as the public page would after a save; the editing page uses the words as typed. The preview's links are live (an employer's page). J compares it with `/p/<name>` box for box, so nothing may wrap `PortfolioHome` that changes its width. The line above it is chrome and may take room.
- **Test:** on Free the line says "Only you can see this page on Free" with See plans; on Premium with no address, "Not online yet: claim your address"; with an address and every exhbt hidden, "Not online yet: publish an exhbt"; a draft, a hidden exhbt and a previewed look are not in it; switching back keeps what was typed.

### Step 19: render counts

`renders.ts` counts `page`, `hero`, `section:<key>` and `tile:<id>` on `window.__portfolioRenders`. **There is no chart unit**, and E cannot add an honest one: the chart is drawn inside `ProjectCard` and `Figure` in `PortfolioHome.tsx` by `components/charts/Chart.tsx`, which is not E's file, and a hook cannot go in `PortfolioHome.tsx` (visitors' pages draw it on the server). Ask the main session for one of: a development-only counter in `Chart.tsx`, or J's spec counting renders itself with a devtools hook installed by `page.addInitScript`. Do not report an inferred count as a measured one. The three figures the brief wants (a key in the headline, a key in the intro, a section move) have not been read: `renders(page)` in `e2e/portfolio-editor.ts` reads them.

### Step 20, and what else has not run

- `e2e/portfolio-core.spec.ts`'s second part beyond "Coming back to the page".
- `portfolio-parity`, `home-slots` and `phase2-customiser` have not run on this branch. The only edits to `PortfolioHome.tsx` are the word `export` on `WRAP`, `ROWS` and `CARD`.
- **Six looks are unmeasured.** The editing page was compared with `/p/<name>` box for box (every element of the hero, the sections and the footer, 1440 and 412) in the Exhbt and Studio looks only, on the full fixture. That comparison found the `<p>` fault. Do the other six, and Ledger and Notebook with no education line, where the location and the year are `shrink-0` block fields.
- **The mirror path is untested.** Fields grow by a hidden mirror where a browser has no `field-sizing`. `css/core.css` has a rule for it (`width: 0; min-width: 100%` on the mirrored field) that nothing has exercised: provide `GrowContext` (`components/exhbt-editor/fields/InlineText.tsx`) with `"mirror"` under `?grow=mirror` in `Shell`, as the exhbt editor does, and run the lines and Studio tests that way.
- **The production-build answer on `revalidate()`** (brief step 3) has not been measured. Build twice, once with `revalidate()` added to `savePortfolioAction`, and watch the save's response: with it, the response carries the page again and `data` changes identity (every card draws again).

## Testing on the shared machine: what cost E time

- **Browsers are killed for memory.** "Page crashed", "Target crashed" and `net::ERR_ABORTED` on a first `goto` are the kernel, not the code: `dmesg | grep "Killed process"` shows them. Look at `free -g` first, and re-run a test that died that way on its own.
- **The development server builds a page the first time it is asked for, and answers nothing else while it does.** A test that leaves `/portfolio` and comes back must go to a page that is already built (`page.request.get("/account")` first, as "Coming back to the page" does). `/roadmap` redirects to `/roadmap/new`, a second build: the gate's ten seconds ran out behind it and the test failed for no fault of the code.
- **Never edit a product file while a spec is running:** the server reloads the page under the test. Docs and scratch files are safe.
- **A trace unzipped inside `test-results/` breaks `tsc`** (it holds copies of the specs). Delete the folder before typechecking.
- `e2e/portfolio-core.spec.ts` takes about six minutes on `desktop` with one worker, most of it the first build of each page.

## Asks from the other agents, for whoever holds E's files

- **G:** in `page.tsx`'s editor branch, `jobLinks={<JobLinksSection compact userId={user.id} />}` once G's `compact` is merged, and `team={<TeamPanel userId={user.id} host={host} said={…} full={asked.full === "1"} />}` once H's `TeamPanel` is merged (see the trap under step 17).
- **F:** a `WorkRow` component in `PortfolioHome.tsx` (the row body inside each `<li>` of `Work`'s list and index looks), so owner-only tiles are drawn in the look's own row. It is a refactor of the visitors' component: run `portfolio-parity` and `home-slots` before and after.
- **I:** `Sheet` takes `when`, for the one name ("item") every section and tile shares.

## In milestone 1, less than sure

- **A crash while a save is on its way.** `flushPending` waits 50ms for the leaving editor's own save to start, then for saves on their way. The one test of it types once and crashes at once. A crash during a slow save is reasoned, not seen.
- **Enter while an input method is composing** (`ParasField`): written from the rule, not tried with one.
- **The arrow keys between paragraphs** move only from the very start or the very end of a paragraph. Up from the middle of a first line stays in the paragraph on browsers that do not move the cursor to the start.
- **`sameSection`** is right for today's `PortfolioHome`. Nothing but the field tests would catch a section that should have drawn again and did not.
- **WebKit.** Nothing here has run on Safari's engine. `portfolio-core` is in the `safari` project; the fields' `contenteditable="plaintext-only"` halves and `field-sizing` are the exhbt editor's, which has.
- **`ui/Sheet.tsx` has never been opened in a browser.** No test or script has drawn the Astryx Drawer wrapper, and `when` was added without a run. G and I build on it: open one early.
- **Most of `e2e/portfolio-editor.ts` has never been called:** `HOME_EDIT_ONLY_IN_FLOW`, `HOME_BOXES`, `boxes()`, `differences()`, `call()`, `renders()` and `undoLabel()`. The selector list was written from reading the markup, not checked against a page. `seed`, `setKind`, `signIn`, `openEditor`, `waitReady`, `field`, `textbox`, `typeIn`, `focusedPath`, `stateNow`, `valueAt`, `saveState`, `waitSaved` and `settle` are the ones the core spec uses.
- **`app/(app)/portfolio/error.tsx` has never been drawn,** nor the gate's "We could not fetch the newest copy" with "Try again" on purpose (it was seen once, by accident, when the development server stalled).
- **The editing page has two `<h1>`s,** the bar's "Your portfolio" and the person's name, and axe has never run on it.
- **The Back fix has only run on the development server.** It compares two times the server stamps (`loadedAt` and `savedAt`). It is untried on a production build and on the Worker, where more than one instance answers.
- **Runs.** The thirteen tests of milestone 1 have passed in one run (the last full run, on the Back fix's code). Of the two Back tests, the second passed once, and the first passed on its third attempt after two "Page crashed" on its first `goto` (memory). `phase2-builder` passed 9 of 9 on milestone 1, eight in one run and one alone.
