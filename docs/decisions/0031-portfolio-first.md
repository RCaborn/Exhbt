Status: accepted
Date: 26 Nov 2026
Amends: 0016 (the step builder gives way to the page itself, edited where it sits), 0014 (exhbts are arranged on the page; the separate exhbts list goes), 0018 (a look is picked from a list in a menu, and the page itself is the preview), 0026 (the exhbt editor's way back is "Your portfolio", and a first publish returns there), and `DESIGN.md` (the Dragging rule's builder sentence and the builder paragraph, rewritten by brief K)

# Portfolio first: one page to build, and exhbts added from it

Rory, 25 Nov 2026, after trying the new exhbt editor: "I wanted the editor to practically be the preview… I hate the two columns… There's no connection from the left side to the right side… like you're editing a Word document practically, just an editable form rather than a left side and a right side."

And on how the app hangs together: "maybe you get sent straight to building your portfolio where you can edit on the page… you can have like an add button to add a new exhibit on that portfolio page, so the exhibit builder actually lives within the portfolio builder… you start on the portfolio bit, which should really take like a minute tops, and then you've now got a vision, you can see what you're building, and then you click add… currently it just doesn't make sense, even as someone who knows what all of these things mean."

In the meeting of 24 Nov, Alex asked: "is this publishing this one exhibit on a named link, or publishing an exhibit to the portfolio, or publishing the portfolio?" Rory: "We need to explain that your exhibit is part of a portfolio… step one build your portfolio, step two build your exhibit… It just all has to be editable for them easily and visual." On job links, Alex: "I think job links is part of portfolio"; Rory: "the job links are all sub portfolios of your main one". Alex: "the thing we should definitely focus on is it being your own personal website."

So the portfolio becomes the thing a person lands on, builds and comes back to, edited on the page as visitors see it, in their own look. Exhbts are added from it, open in the exhbt editor, and come back to it. The names stay: an exhbt is one piece of work; the portfolio is the whole site at `yourname.exhbt.co.uk`.

Three designs were written for this on 25 Nov 2026 and judged against the code on 26 Nov (main at 5261c10). This record takes the most careful of the three as its spine (what is protected, the switch, the order of releases) and the other two's first-run and wording ideas. The build is in `docs/briefs/portfolio-first/`.

## Publishing, in one rule

This answers Alex's question, and every screen says the same thing.

- You publish **exhbts**, one at a time, from the exhbt editor. Each one goes on your portfolio and has a link of its own to send with an application.
- You never publish the **portfolio**. It saves as you type, as the builder does today. Visitors see it once you have an address (a paid step) and at least one live exhbt.
- A **job link** is a version of your portfolio for one job: a menu on the portfolio.

## The structure

### A new student, from sign-up to a published exhbt

1. **Sign-up lands on the portfolio** (`/portfolio`), wherever it started, unless the link they came by says otherwise (`next`). Today it lands on `/account` or `/roadmap`. Log-in lands there too.
2. **They see their own page, not a form,** in the default look, with each empty field's placeholder where its words go. Under the editor's bar, in app chrome, a slim strip: "1 Your page, about a minute · 2 Your first exhbt". The cursor is in the name. Someone who came through the roadmap gate with the same email already has their name filled in, and their LinkedIn if they gave it (`claimPendingRoadmaps` copies both today).
3. **Step 1 is four things, all on the page:** the name, a one-line headline, a photo (optional, a button over the initials) and a look. "Pick a look" in the strip opens the bar's Look menu, so they learn where it lives. The strip ticks each one off. Nothing blocks: "Skip to your first exhbt" is there from the start.
4. **Step 2 is the vision.** With no exhbt yet, the band ("My best piece of work") is drawn full size in the look's band colours, saying "Your best project goes here", with the look's own button, "Add an exhbt".
5. **Add.** It opens the upload (`/exhbts/new`), now titled "Add an exhbt to your portfolio", with the back link "Your portfolio" and, under the upload, "Or start from a blank page" (`createFromScratch`, today only on the exhbts list).
6. **They write it up in the exhbt editor.** Its back link says "Your portfolio" and waits for the last save before it leaves.
7. **Publish.**
   - **Free:** the publish sheet says the exhbt is on their portfolio as a draft only they can see, with "Back to your portfolio" and the upgrade.
   - **Paid, with no address yet:** the sheet's "Choose one" goes to the portfolio with the address sheet open (`/portfolio?open=address`), where the address is claimed. They then open the draft tile and publish.
   - **Paid, with an address:** a first publish returns to the portfolio (`/portfolio?at=<id>`). The tile has turned from Draft to Live where it sits, and a note at the foot of the window gives the exhbt's own link with Copy. Publishing changes to an exhbt that is already live stays in the editor.

### A returning person

Log-in lands on `/portfolio`: their page as visitors see it, with owner-only parts (Draft tiles, the hidden row, the Add tile) and the controls drawn over it. A chip in the bar says where the page stands: "Live", "Not online yet" or "Preview only". A notice under the bar appears only when something needs them: someone has asked to join one of their exhbts, or a look or section is held after a downgrade.

### The nav

Signed in: "Your portfolio", then "Roadmaps", with Account in the corner. Signed-out and marketing headers do not change. The exhbts list (`/exhbts`) goes: everything it did has a home on the portfolio (below). Job links leave the foot of the portfolio page for a menu in the editor's bar.

### Routes

| Route | Switch at `page` | Switch at `steps` (today) |
|---|---|---|
| `/portfolio` | the one-page editor; the query below | the step builder |
| `/exhbts` | redirects (307) to `/portfolio`, query kept, for good: sent emails link to `/exhbts#team-projects`, and `createFromScratch` and the team actions redirect to `?full`, `?joined`, `?left` | the list |
| `/exhbts/new` | "Add an exhbt to your portfolio"; signed out, it goes to log in with `next=/portfolio` | unchanged |
| `/exhbts/[id]/edit` | the exhbt editor; way back "Your portfolio" | unchanged |
| `/exhbts/[id]/team` | back link to that exhbt's editor | unchanged |
| `/account/portfolio` | `/portfolio?open=address` (its only callers are the "choose a username" links) | `/portfolio?step=you` |
| `/portfolio/customise` | `/portfolio` | `/portfolio?step=projects` |
| `/job-links`, and the job-link pages' back links | `/portfolio?open=job-links` | `/portfolio#job-links` |
| `/team/accept` once accepted | `/portfolio?open=team` | `/exhbts#team-projects` |
| sign-in with no `next` (log-in, sign-up, password set) | `/portfolio` | `/roadmap`, `/account`, `/account` |
| new | `POST /api/portfolio/editor` (an admin's own choice), `/dev/portfolio-kind`, `/dev/portfolio-parity`, `/dev/home-slots` | the same |

No new top-level route, so `lib/hosts.ts` does not change: `TOOL_PATHS` already moves `/portfolio` and `/exhbts` to the app host when that is switched on. `middleware.ts` gains `/portfolio` in `SESSION_PATHS`, where it is missing today. Without it a person who lands there with an expired access token is refreshed by a server component, which cannot write the cookie; that matters more once `/portfolio` is where everyone lands.

### What the portfolio reads from its address

`/portfolio`, with the switch at `page`:

| In the address | What the editor does |
|---|---|
| `?builder=steps` | Serves the step builder for this request, whatever the switch says: the escape and the crash fallback. Wins over everything below. |
| `?open=look` · `address` · `job-links` · `team` · `links` | Opens that menu, sheet or popover once the page is up. |
| `?at=<exhbt id>` | Scrolls to that tile and marks it for two seconds. If the exhbt is live, the note at the foot of the window says "<title> is live at <address>" with Copy link. |
| `?full=1` | The Add tile gives the plan's reason in the alert tone (`canCreateExhbt`). With `open=team`, the team sheet gives it beside Make my own. |
| `?joined=1`, `?left=1` | Opens Team, with today's note from `/exhbts` (`TEAM_SAID`). |
| `?step=you` | Focuses `profile.name`. |
| `?step=look` | As `open=look`. |
| `?step=projects` | Scrolls to the work. |
| `?step=publish` | As `open=address`. |
| `#team-projects` | As `open=team` (sent emails carry it; browsers keep it across the `/exhbts` redirect). |
| `#job-links` | As `open=job-links`. |

Once acted on, the query and the hash are taken out of the address with `history.replaceState`, so a reload does not do it again. Unknown values are ignored. With the switch at `steps` the step builder reads `?step=` as it does today and ignores the rest.

### Where each thing the exhbts list did goes

| On `/exhbts` today | From now on |
|---|---|
| The list, its order and the up and down buttons | The tiles on the page, dragged or moved |
| "Live", "Draft", "Hidden from portfolio" chips | The tile's own chip; the hidden row |
| The plan count and "Preview only on Free" | The Add tile ("<used> of <limit> on <plan>") and the bar's chip |
| "Upload your project", "Start from scratch", the plan-full prompt | The Add tile |
| View, Edit | The tile (it opens the exhbt editor); the exhbt's link in its publish step |
| Team | The exhbt editor's team strip, as now |
| Delete | The exhbt editor's menu only, as now |
| Join requests | The notice under the bar, and the Team sheet in the bar's menu |
| Team projects | The Team sheet |

## The portfolio editor

`/portfolio` draws `PortfolioHome` itself, in the person's look, at the width visitors get, inside the same container and `themeStyle` wrapper the public page has (its container queries need them), under the app header and the editor's bar. Public pages pass no adapter and draw exactly what they draw today.

### The bar

One row in app chrome, built from the exhbt editor's `xe-topbar` classes so the two editors read as one product (the portfolio's wrapper sets `--xe-topbar-h`, which `core.css` sets only under `[data-editor="page"]`):

- "Your portfolio" and the chip ("Live", "Not online yet", "Preview only");
- Look;
- Undo, named for what it undoes ("Undo: remove Experience");
- See as a visitor;
- the save status;
- Job links;
- the menu: Team projects; "Reorder sections" on a touch screen; "Use the step builder" while the old builder exists;
- the primary button: "Claim your address" until there is one, then "Share", which opens the same sheet with the address and Copy link.

### What is edited where

| Part | How |
|---|---|
| Name, headline | Typed in place in every hero, in the look's type. The hero redraws as the name changes (its size, the initials, Mono's path). |
| Intro | Typed in place as paragraphs: Enter starts a new one. "Suggest an intro" sits over its corner (`suggestIntroAction`, from facts the person gave only). |
| Photo | A button over the photo or the initials opens the photo sheet (`PhotoField`, which saves at once, as now). |
| Location, looking for | In place wherever the look draws them: `Meta` in five heroes, Notebook's facts and Ledger's rows. |
| LinkedIn, GitHub, website, email, "Show LinkedIn" | A small "Your links" popover from Get in touch's corner. Addresses are not prose, and the page shows them shortened. |
| About me's words, the tools line | In place. |
| Education and experience lines | In place, two fields per line, the words and the year, written back as one line that `splitYear` reads (`joinYear`). "Add a line" and each line's move and remove sit over the list. Limits from `TILE_LIMITS` and `checkTiles`. |
| The quote, who said it, their role | In place, the words between the look's marks. |
| Look and colourway | The Look menu: a list of the looks by name, with their faces, their swatches and, for a locked look, the plan it comes with. Choosing one restyles the page at once. No scaled pictures of the page: the page is the preview. A locked look is previewed under a line ("Preview of Studio, comes with <plan> · See plans · Back to yours"), never saved and never shown to visitors. |
| Sections | A corner toolbar on each, over it and out of the flow: grip, up, down, remove. "Add a section" after the last section lists the six; Experience and Quote are locked where the plan lacks them, with the reason. Undo puts a removed section back with its words. |
| Exhbt tiles | Clicking a tile opens the exhbt. Over its corner: the star (which puts it in the band), Hide and a grip; Move up and Move down in its More menu. Hidden exhbts sit in a row after the work, each with Show. |
| Draft and over-limit tiles | On a paid plan, owner-only tiles after the live ones, dashed, with a chip ("Draft", "Over your plan's limit") and "Finish and publish". They are not dragged or starred: the server arranges only the exhbts that can be live (`customisableExhbts`). On Free every exhbt is arranged, as now. |
| Add an exhbt | The last tile of the work (the band itself when there is none): Upload your project, Or start from a blank page, and "<used> of <limit> on <plan>". When the plan is full: the reason from `canCreateExhbt` and the upgrade, in the alert tone after `?full=1`. Owner tiles follow the look: cards where it draws cards, rows in the list and index looks. With More of my work off the page, they sit after the last section. |
| Address, share, hide from search | The address sheet: on a paid plan the claim (`UsernameForm`, with its live check, its hourly limit and its 30-day redirect, never autosaved), then the address with Copy, Change and "Hide from search". With an address and nothing live, it says the address shows "not found" until an exhbt is published. On Free, the plan's reason and "See plans"; the billing page's success line gains "Back to your portfolio". |
| Job links | The bar's menu: each link with Live or Off, its views and Edit; New job link; the live links left. With nothing published: "Publish an exhbt first: a job link shows your live exhbts." Below the plan that has them, only the upgrade line. |
| Team | A notice under the bar when someone has asked to join; Team projects in the bar's menu (a sheet with today's buttons). |

### Fields, and the path each one has

| Path | What | Drawn in | Edited as | Name read out |
|---|---|---|---|---|
| `profile.name` | the name | every hero | `text`, block | Your name |
| `profile.headline` | one line about you | every hero | `text`, block | One line about you |
| `profile.bio` | the intro | `Intro`, in the heroes that draw one | `paras` | Your intro |
| `profile.location` | where you are | `Meta` (five heroes), Notebook's facts, Ledger's rows | `text` | Where you're based |
| `profile.lookingFor` | what you're looking for | the same places | `text` | What you're looking for |
| `profile.linkedin`, `profile.github`, `profile.website`, `profile.contactEmail` | your links | Get in touch's rows | the "Your links" popover (`tools("contact")`) | LinkedIn, GitHub, Website, Email |
| `arrangement.header.linkedin` | show LinkedIn | the hero and Get in touch | a switch in the same popover | Show LinkedIn on your page |
| `arrangement.tiles.about.text` | About me's words | About | `paras` | About you |
| `arrangement.tiles.education.lines.N` | a course or qualification, and its year | About's rows | two `text` fields, `part` "label" and "year" | Course or qualification N; Year |
| `arrangement.tiles.education.tools` | the tools line | About's last row | `text` | Tools you use |
| `arrangement.tiles.experience.lines.N` | a job or role, and its years | Experience's rows | two `text` fields, `part` "label" and "year" | Role N; Years |
| `arrangement.tiles.quote.text` | the quote | Quote, between its marks | `text`, inline | The quote, word for word |
| `arrangement.tiles.quote.name`, `arrangement.tiles.quote.role` | who said it, their role | Quote's byline, on one line | `text`, inline | Who said it; Their role (optional) |
| `arrangement.sections` | the sections and their order | each section's frame; "Add a section" | toolbars and drag | (the section's name) |
| `arrangement.order`, `arrangement.featured`, `arrangement.hidden` | the exhbts' order, the band, the hidden ones | each tile's frame; the hidden row | tile controls and drag | (the exhbt's title) |
| `arrangement.themeId` | the look | the whole page | the Look menu | Look |

Every field carries `data-path`. A problem is shown at its path: `profileProblems` key `k` at `profile.k`; `checkTiles` key `kind.field` at `arrangement.tiles.kind.field` (a list's problem, `education.lines`, at `arrangement.tiles.education.lines`, which the list's own anchor carries). Heroes that repeat a line from About (Notebook's facts, Ledger's rows of education) draw it as words, not as a field: the line is typed in About.

### The adapter

The same pattern as decision 0026, "One page, one renderer": `PortfolioHome` takes one optional prop, `edit`, and each part asks `edit ? edit.text({ … }) : value`. No public page passes it, so the server draws what it draws today. A React context was turned down for the reason 0026 gives: server components cannot read one. A second renderer was turned down because two drawings of one page drift.

```ts
// components/portfolio/home-ctx.ts  (types only: no "use client", no values, safe to import anywhere)
import type { ReactNode } from "react";
import type { SectionKey } from "@/lib/portfolio-layout";

/** A path into the editor's state (`BuilderState`): "profile.name", "arrangement.tiles.about.text", "arrangement.tiles.education.lines.1". */
export type HomePath = string;

/** One line of plain text in the page's own type. Enter does nothing. */
export type HomeTextSlot = {
  path: HomePath;
  value: string;
  /** The field's accessible name: "Your name", "Who said it". */
  label: string;
  placeholder: string;
  /** "block" where the page sets the words on their own (a name, a headline, a line); "inline" where they flow among other words (a quote between its marks; its name and role on one line). */
  as: "block" | "inline";
  /** For a line of education or experience only: which half this field is. The adapter writes the whole line back with joinYear. */
  part?: "label" | "year";
  maxChars?: number;
};

/** Paragraphs in the page's own type: Enter starts a new paragraph (a blank line in the stored text). The intro and About me's words. */
export type HomeParasSlot = {
  path: HomePath;
  value: string;
  label: string;
  placeholder: string;
  /** The classes the page puts on each paragraph, so the field's paragraphs are set exactly the same. */
  paraClass: string;
};

/** One section, for its frame and corner toolbar. Plain values only. */
export type HomeSectionSlot = { key: SectionKey; index: number; count: number };

/** One exhbt as the page draws it: in the band, as a card, or as a row (the list and index looks). */
export type HomeTileSlot = { id: string; where: "band" | "card" | "row"; index: number; count: number };

/** A list of education or experience lines, for the controls drawn over it (add a line; move or remove one). */
export type HomeLinesSlot = { path: HomePath; kind: "education" | "experience"; count: number; max: number };

/** Where the page asks for what only the owner sees. */
export type HomeOwnerPlace =
  /** The band, when the band is on the page and there is no exhbt yet: the vision. */
  | "band"
  /** After the last card of More of my work: owner-only tiles, the Add tile, the hidden row. */
  | "work-end"
  /** After the last section, when More of my work is not on the page: the same parts. */
  | "page-end";

export type HomeEdit = {
  text(s: HomeTextSlot): ReactNode;
  paras(s: HomeParasSlot): ReactNode;
  /** The photo or the initials with the button over it that opens the photo sheet. `face` is what the page draws without an adapter. */
  photo(face: ReactNode): ReactNode;
  /** A section in its frame. `node` is the section as the page draws it, its fields included. */
  section(s: HomeSectionSlot, node: ReactNode): ReactNode;
  /** An exhbt with the owner's controls over its corner. `node` is the band, card or row as the page draws it. */
  tile(s: HomeTileSlot, node: ReactNode): ReactNode;
  /** Drawn over a list of lines; takes no room. */
  lineTools(s: HomeLinesSlot): ReactNode;
  owner(where: HomeOwnerPlace): ReactNode;
  /** The corner toolbar of a part with no frame of its own: the intro's (Suggest an intro) and Get in touch's (Your links). Takes no room. */
  tools(where: "intro" | "contact"): ReactNode;
};

// HomeProps (components/portfolio/PortfolioHome.tsx) gains one optional prop:
//   edit?: HomeEdit
// No public caller passes it. With `edit`, the page draws every section in `sections` (none is left out
// for being empty), draws empty word sections with their fields rather than EmptySection's outline, and
// keeps the top bar and the footer inert (as `inertChrome` does). `frame` stays for the step builder
// until the clean-up removes it.

// lib/portfolio-layout.ts gains, beside splitYear:
//   export function joinYear(label: string, year: string | null): string
// It writes "label, year". splitYear(joinYear(label, year)) gives back { label, year } for any label that does
// not itself end in a year and any year splitYear reads ("2024", "2021–2024", "2023 to now");
// joinYear(label, null) and joinYear(label, "") give label.trim(). A line is rewritten only when one of its
// two fields is typed in, so a stored line nobody touches keeps its own punctuation.
```

The costly parts of a tile (`ProjectCard`, the band's figure) are memoised on the tile's data, which the loader gives and typing never changes, so a key typed in the headline draws no card and no chart again. If React's server build refuses `memo` in `PortfolioHome.tsx`, the adapter's `tile` does the memoising instead.

### What the editing page adds that takes room

The editing page matches the visitor's page box for box except for these, which the box-for-box tests allow by name (`HOME_EDIT_ONLY_IN_FLOW` in `e2e/portfolio-editor.ts`, the portfolio's twin of `EDIT_ONLY_IN_FLOW` in `e2e/page-editor.ts`):

1. **Placeholders.** An empty field shows its placeholder, one line of the type it sits in.
2. **Empty sections drawn whole.** An empty About, Experience, Quote or Get in touch draws its heading and its empty fields, where the visitor's page leaves the section out. (The step builder's dashed `EmptySection` outline is not used in the editor.)
3. **The vision.** With no exhbt yet and the band on the page, the band is drawn full size in the look's band colours: "Your best project goes here", with the look's own button, "Add an exhbt" (`owner("band")`).
4. **The end of the work.** After the last card (`owner("work-end")`), or after the last section when More of my work is off the page (`owner("page-end")`): owner-only tiles (a draft, an exhbt over the plan's limit), then the Add tile, then the hidden row.
5. **An empty More of my work.** When the only exhbt is in the band, More of my work draws its heading to hold the Add tile.
6. **Studio's name.** Studio sets the name one word per line; while it is being typed it is one field. Its box differs; nothing else on the page moves.

Everything else the editor adds is drawn over the page and takes no room: section and tile toolbars, "Add a line", the photo button, Suggest an intro, the "Your links" button. The bar, the first-run strip, the team notice and the note after a publish are app chrome above or below the page.

### See as a visitor

`PortfolioHome` with no adapter, in public mode, from the published copies only, in the person's order and without hidden exhbts, drafts, over-limit exhbts, held extras or a previewed locked look: exactly what an employer gets once the page is online. When visitors get "not found" today, a line above it says so and why, in this order: the plan has no public page ("Only you can see this page on <plan>" with See plans), there is no address ("Not online yet: claim your address"), or nothing is live ("Not online yet: publish an exhbt"). It is drawn in a region named "Preview", and it is what the editing page is tested against.

### Saving

- **The state and the save path stay the step builder's:** `BuilderState`, `useBuilder` (changes show at once and save 0.6s later, flushed when the tab is hidden), and the checks in `saveBuilderAction`. Those checks move into one function that both callers use; the editor's own action, `savePortfolioAction`, skips `revalidate()`, which from its own page would draw the page again on every save (to be confirmed in a production build). Publish, unpublish, create and delete gain `revalidatePath("/portfolio")`.
- **One status in the bar:** Saved (and "Saved · live" when visitors can see the page), Saving, or "Not saved" with the reason. A state the rules refuse is not sent, as now: the field has the look's error outline and its message, and "Show me" jumps to it.
- **After a deploy,** the tab's save action no longer exists. The editor says "The site was updated. Reload to carry on", keeps the unsaved state in the browser, and offers it back once after the reload (the check is `isStale` in `components/exhbt-editor/Autosave.tsx`, copied).
- **Two tabs:** the newest save wins, as today. A note says when the page is open in another tab (`BroadcastChannel`).

### Undo

Up to 30 steps, each named for what it undoes. An entry keeps only the before-values of the keys its change touched, so typing done since is never lost (the exhbt editor's rule, `undo.ts`). It lives in the editor and calls `useBuilder`'s `change()`; `useBuilder`'s own one-step Undo stays as it is for the step builder. Typing is not a step. Ctrl or Cmd and Z works outside text fields.

### On a phone

- One column. The site header scrolls away; only the editor's bar sticks, keeping the heading, the save status and the primary button. Look, Undo, See as a visitor, Job links and Team projects go in the menu (`useNarrow`).
- Each section and tile has one 44px "More" button, opening a sheet: Move up, Move down, Remove, and for a tile Star, Hide and Open.
- "Reorder sections" opens a sheet of rows with up and down.
- Press-and-hold on a grip still drags (the builder's 160ms, already tested).
- Sheets fill the screen. Fields are 16px or larger, so iOS does not zoom (`phone/noZoom.ts`).
- The setup strip is one line, "Step 1 of 2", with Next.

### Continuity with the exhbt editor

- The exhbt editor already draws in the person's look.
- Its back link waits for `flushPending()` (`components/exhbt-editor/pending.ts`) before it navigates. Today the last save is sent as the editor unmounts and not waited for, so the portfolio could show the old title.
- The portfolio calls `router.refresh()` when the browser's Back button returns to it.

## Reuse

| Piece | Use |
|---|---|
| `app/(app)/portfolio/useBuilder.ts`, `actions.ts` (save, claim, photo, intro), `PhotoField`, `UsernameForm`, `checkTiles`, `profileProblems`, `JobLinksSection`, `Preview.tsx`'s dnd-kit sensors and announcements | As they are, moved into the page, sheets and menus. The save checks move into one shared function with no change in what they do. |
| `lib/portfolio-layout.ts`, `portfolio-themes.ts`, `portfolio-profile.ts`, `portfolio-customise.ts`, `plan-rules.ts` | Read as they are. `portfolio-layout.ts` gains `joinYear`. |
| `components/exhbt-editor/atom.ts`, `again.ts`, `ui/Said.tsx`, `topbar/Popover.tsx` (`useNarrow`), `phone/usePhone.ts`, `phone/noZoom.ts`, `css/core.css`, `css/topbar.css` | As they are: none reads the exhbt editor's context. |
| `components/exhbt-editor/fields/InlineText.tsx` | Its inner `BlockText` and `InlineSpan`, and their props type, are exported: the word `export`, nothing else. They take plain props and `onText`. `InlineText` itself and `issues.tsx` read the exhbt store and are not used. The intro's paragraph field is the portfolio's own, in the same classes. |
| `ui/Sheet.tsx`, `topbar/SaveStatus.tsx`, `topbar/UndoButton.tsx` | Copied into `components/portfolio-editor/ui/`: each imports the exhbt editor's context. |
| `EditorGate.tsx`'s boundary, `pending.ts`'s flush, `Autosave.tsx`'s `isStale` | Copied: `PortfolioGate` flushes, then reloads into `?builder=steps`. |
| `lib/editor-kind.ts`, `lib/editor-kind-server.ts`, `/api/exhbts/editor` | Copied as the portfolio's switch (below), never imported: they go with the classic exhbt editor. |
| `e2e/editor-test.ts`, `page-editor.ts`'s field and typing helpers, `layout-parity.spec.ts`, `edit-slots.spec.ts` with `app/dev/edit-slots`, the render counter | The pattern and the helpers, with portfolio fixtures and selectors. |

**Not used, on purpose:** the exhbt editor's store, undo, frames and adapter (typed to an exhbt), its drag engine, toolbar placement, "+" menu and tray (built round an exhbt's rows), its figures, files, layout menu and word bar. The portfolio is a few kilobytes with one photo, and dnd-kit already sorts its sections and tiles.

**The exhbt editor's core is not touched** until the classic exhbt editor has been deleted: `store-core.ts`, `undo.ts`, `Autosave.tsx`, `pending.ts`, `components/editor/useAutosave.ts`, `lib/editor-kind.ts`. Before release 2 the only edit in `components/exhbt-editor/` is the `export` above. Release 2 changes the exhbt editor's back link, its publish sheet's buttons and one optional prop, all behind the switch.

## Data

- **No migration.** The editor writes only what the step builder writes: the `profiles` columns (name, headline, bio, location, looking for, links, `portfolio_theme`, `hide_from_search`, `featured_exhbt_id`, `portfolio_layout`), `exhbts.position` and `exhbts.hidden_on_portfolio`, and the username through `claim_username`. It writes nothing the step builder cannot read and show; a round-trip test holds both to that. No `Store` method changes.
- **Nothing is written on load.** Legacy layouts (0014's markers), held extras, a stored locked look and over-limit exhbts change shape only on the first edit, as today.
- **The roadmap prefill** is already done at sign-in by `claimPendingRoadmaps` in the Supabase store (`lib/store.ts`): the gate's name and LinkedIn fill an empty profile. The in-memory store does not, which breaks the rule that both implementations behave alike and leaves the tests unable to show it; brief B fixes the in-memory one.
- **The profile has no published copy.** On a live paid page a typed word is public within a second, as it is today. The status says "Saved · live" so that is never a surprise (question 1).
- **`savePortfolioLayout` is several writes, not a transaction** (`lib/store.ts`). Its order is safe; positions can half-apply if the connection drops. Known, and kept.
- **First run is worked out from the data:** step 1 is done when the name and the headline are filled in, step 2 when there is at least one exhbt. "Hide this" is kept in the browser (localStorage, inside try and catch); losing it only brings the strip back.

## The switch

One switch carries the editor and the new structure, so both reach people on the same day (Rory's decision), and one change takes both back.

```ts
// lib/portfolio-kind.ts  (the rule only: reads no request; copied from lib/editor-kind.ts, which it never imports,
// because that file is deleted with the classic exhbt editor)
export type PortfolioKind = "page" | "steps";

/**
 * THE SWITCH for portfolio first: "steps" is today's app for everyone (the step builder, the two nav items,
 * today's landings after sign-in); "page" is the one-page editor and the new structure. Pinned by
 * e2e/portfolio-switch.spec.ts (SHIPPED_DEFAULT): change both in one commit. The runtime variable
 * EXHBT_PORTFOLIO overrides it for everyone without a deploy.
 */
export const DEFAULT_PORTFOLIO: PortfolioKind = "steps";

/** An admin's own choice, for a year, honoured only while the signed-in person is an admin. Set by POST /api/portfolio/editor. */
export const PORTFOLIO_OWN_COOKIE = "exhbt-portfolio-own";
/** Development only: stands in for EXHBT_PORTFOLIO in one browser ("page", "steps", or "default" for not set). */
export const PORTFOLIO_KIND_COOKIE = "exhbt-portfolio-kind";

export const isPortfolioKind = (v: unknown): v is PortfolioKind => v === "page" || v === "steps";

export type PortfolioFacts = {
  /** process.env.EXHBT_PORTFOLIO as it is set, if it is. */
  variable: string | undefined;
  production: boolean;
  devCookie?: string;
  admin?: boolean;
  own?: string;
};

/** What an ordinary person gets, and what /api/health reports. */
export function portfolioForEveryone(f: PortfolioFacts): PortfolioKind;
/** What this person gets: an admin's own choice first, then what everyone gets. */
export function decidePortfolio(f: PortfolioFacts): PortfolioKind;
```

```ts
// lib/portfolio-kind-server.ts  (import "server-only"; reads cookies and process.env.EXHBT_PORTFOLIO on each request)
export async function portfolioKindForEveryone(): Promise<PortfolioKind>;
/** `admin` is isAdmin(user), checked on this request. */
export async function portfolioKind(admin: boolean): Promise<PortfolioKind>;
/** For code with no signed-in person to hand (the app layout's nav): asks isAdmin only when the own cookie is there. */
export async function portfolioServed(): Promise<PortfolioKind>;
```

- `EXHBT_PORTFOLIO` is never listed in `wrangler.jsonc` `vars` (every deploy would reset it) nor in `next.config.ts` `env` (it would be fixed at build).
- `POST /api/portfolio/editor` (form field `kind`: `page` or `steps`): 404 for anyone who is not an admin; otherwise sets `PORTFOLIO_OWN_COOKIE` (httpOnly, sameSite lax, one year) and redirects to `/portfolio`.
- `GET /dev/portfolio-kind?kind=page|steps|default`: sets `PORTFOLIO_KIND_COOKIE` in that browser and redirects to `/portfolio`; 404 in production.
- `/api/health` gains `portfolio: "page" | "steps"` from `portfolioKindForEveryone()`, never an admin's own choice; `?only=portfolio` answers at once.
- `isAdmin` in `lib/admin.ts` stays: this switch calls it, so the classic editor's removal must not delete it.

```ts
// lib/landing.ts  (no request reading: callers pass what they know)
import type { PortfolioKind } from "./portfolio-kind";
/**
 * Where someone goes after signing in when no `next` says otherwise; safeNext's fallback.
 * "steps", or Phase 2 off: today's places (log-in "/roadmap", sign-up "/account", password "/account").
 * "page" with Phase 2 on: "/portfolio" for all three.
 */
export function landingAfterSignIn(how: "log-in" | "sign-up" | "password", kind: PortfolioKind, phase2: boolean): string;
```

```ts
// components/site/app-nav.ts
import type { PortfolioKind } from "@/lib/portfolio-kind";
export type NavItem = { href: string; label: string };
/**
 * The signed-in nav. Phase 2 off: Roadmaps only.
 * "steps": Roadmaps (/roadmap), Your exhbts (/exhbts), Portfolio (/portfolio), as today.
 * "page": Your portfolio (/portfolio), Roadmaps (/roadmap).
 */
export function appNav(kind: PortfolioKind, phase2: boolean): NavItem[];
```

`SiteHeader` takes `portfolio?: PortfolioKind` (default `"steps"`) and draws `appNav(portfolio, phase2)` when signed in. `app/(app)/layout.tsx` passes `await portfolioServed()`. Marketing pages still call `SiteHeader` bare and stay static. The landing follows what everyone gets (`portfolioKindForEveryone()`), not an admin's own choice.

What reads the switch at `page`: `/portfolio` (the editor), the nav, the landing after sign-in, `/exhbts` (the redirect), `/exhbts/new`, the exhbt editor's back link and publish sheet, the team page's back link, `/account` and `/account/portfolio`, `/portfolio/customise`, `/job-links` and the job-link pages' back links, `/team/accept`, the roadmap's "Add as an exhbt", and the billing page's "Back to your portfolio". Everything else is the same at both settings.

**Three ways back,** as with the exhbt editor:
1. **For everyone, with no deploy:** set `EXHBT_PORTFOLIO=steps` on the live Worker in the Cloudflare dashboard (or delete it while the default is `steps`).
2. **For one visit:** "Use the step builder" in the editor's menu opens `/portfolio?builder=steps`.
3. **By itself:** if the editor throws, `PortfolioGate` sends what is waiting and reloads into `?builder=steps`. The editor is drawn only in the browser, inside that boundary.

**The admin trial.** On the step builder, an admin sees "Try the new portfolio", a form that posts `kind=page` to `/api/portfolio/editor`; the editor's menu has "Use the step builder" and, for an admin, "Go back to the step builder for good" (`kind=steps`). An admin's own choice changes the editor and the nav for them; the landing after sign-in follows what everyone gets.

## Releases

Each release goes to `main` by a pull request the main session opens, safe with the switch at `steps`. The detail is in `docs/briefs/portfolio-first/README.md`.

| | Ships | For users | Gate |
|---|---|---|---|
| **Hotfix** | The exhbt editor's live links through `portfolioHref` | The publish sheet's links work on the live host | Its own spec |
| **R0, guard rails** | Portfolio parity goldens written on main; the switch, unused; the nav and landing seams, behaving as today; `/portfolio` in `SESSION_PATHS`; the in-memory store's prefill; the protected-paths check | Nothing changes | The suite green; the switch's spec |
| **R1, the reader release** | `PortfolioHome`'s `edit` prop and slots, unused; `joinYear`; the slots harness | Nothing changes | Parity passes with the goldens untouched; the slots spec |
| **R2, editor and structure, switched off** | Everything above, behind the switch | Only an admin who opts in sees a change | The gate specs (brief J); parity again |
| **R3, trial, then on** | Rory and Alex on a laptop and an iPhone; then `EXHBT_PORTFOLIO=page` | Everyone | `/api/health` says `"portfolio": "page"` |
| **R4, clean-up, a week later** | The default becomes `page`; the step builder, `frame`, the list's body and the switch go; the old specs' useful checks move | Nothing changes | The suite green without the old builder |

The build starts once the new exhbt editor is on for everyone (Rory's decision; the change is ready on `switch-on-page-editor`); only the hotfix goes before. The removal of the classic exhbt editor (`docs/briefs/edit-on-page/r5-p-remove-classic.md`) and brief H edit the same files: they are never in flight together. `EXHBT_TOOL_HOST` (the move to `app.exhbt.co.uk`, which signs everyone out once) is never switched on in the same week as `EXHBT_PORTFOLIO`.

## Visitors' pages stay as they are

- `PortfolioHome` still draws them on the server. Its one new prop lands alone (R1) and is held to golden copies of every look written on main before any change.
- Until the clean-up nothing edits `app/(portfolio)/**`, `lib/portfolio.ts` or `lib/plan-rules.ts`; `npm run check:protected` fails if a change does. Drafts never reach the public order: `visibleOnPortfolio`, `listedOnPortfolio` and `loadPortfolio` are unchanged.
- The owner's own host still has no sign-in cookie, so editing happens at `/portfolio` on the app host, never at the person's address. "See as a visitor" is how the owner sees their page.

## Not done, on purpose

- **A "publish changes" step for the portfolio,** a draft copy of the profile, or a conflict check between tabs. Each needs a migration (`profiles` has no `updated_at`), and a second meaning of "publish" is what confused Alex.
- **Holding a username on a free trial.** Floated on 24 Nov, not decided.
- **Opening the username check to Free, and Stripe sending people back to the portfolio with the name filled in.** With no name held, a name shown as free could be gone after paying. Billing gets "Back to your portfolio" instead; the return path is for later, with Alex.
- **A tile for a roadmap idea before sign-up** (the idea waiting in the band). A signed-out "Add as an exhbt" signs in and comes back to the idea, as "Build this" does today.
- **The upload in a sheet over the portfolio.** The Add tile and the way back carry the continuity; the upload stays its own page.
- **Generalising the exhbt editor's store, undo, drag engine or switch** for a page this small, in the fortnight that editor goes on for everyone and loses its fallback.
- **A phone bar at the foot of the screen.** One "More" button per section and tile does the job with less to build and test.

## Not sure, and risky

- **Seven heroes** each need their fields. The goldens and the per-look specs guard them, and Studio's one-word-per-line name is a listed difference.
- **Typing redraws the page.** One state object means a key in the intro draws the page again; the memoised cards and charts keep it cheap, and the render-count spec holds it (a key in the headline draws no card). If it is not cheap enough, the fallback is a slice of state per section (an `atom` each): about three agent-hours, not planned.
- **A card grid inside a sortable section, on an iPhone.** If Rory finds dragging a tile clumsy, tiles move by Move up and Move down only.
- **Payment confirmation can lag.** The address sheet opened before Stripe's webhook lands still offers the upgrade; it borrows the billing page's "usually within a minute".
- **The session refresh on `/portfolio`** is reasoned from the code, not seen: e2e signs in with the development cookie. Tried on the preview with a short token life before the switch goes on.
- **The live links bug.** `edit/page.tsx` gives `/p/<name>` whenever the tool is not on the app host, and the real domains answer `/p/...` with 404, so the publish sheet's links are probably broken on the live site today. Whether they are depends on `EXHBT_TOOL_HOST`, which `keep_vars` hides. The hotfix is safe either way.
- **The preview site's database** may still lack the Phase 2 tables (the edit-on-page build found that on 19 Nov), in which case a new account's first minute cannot be tried there before the switch goes on. The e2e first-run specs and a fresh test account in the first hour after switch-on, with `steps` one dashboard change away, are then the check.

## Questions for Rory, each with a default

The default is what gets built if he says nothing.

1. **Do changes to a live portfolio go live as they save,** or wait for a "publish changes" button? *Default: as they save, as today; the status says "Saved · live". A button needs a migration and a second meaning of "publish".*
2. **When visitors would get "not found"** (Free, no address, nothing live), what does "See as a visitor" show? *Default: the page as it will look from what is published, under a line saying visitors get "not found" for now and why. The other way is to draw the drafts as they will look once live.*
3. **Education and experience lines, and links.** *Default: lines typed in place; links in a small panel from Get in touch.*
4. **Team projects and join requests.** *Default: a notice under the bar only when someone has asked to join; Team projects in the bar's menu.*
5. **A first exhbt made from a roadmap idea.** *Default: it lands on the portfolio with the draft in the band; with exhbts already, straight into the exhbt editor.*
6. **A Free person presses "Claim your address".** *Default: the sheet says it comes with a paid plan and links to the plans; the billing page's success line gets "Back to your portfolio".*
7. **Draft tiles.** *Default: after the live exhbts, just before "Add an exhbt"; on paid plans they are not dragged or starred. On Free everything is arranged, as now.*
8. **The LinkedIn from the roadmap gate** is already copied into the profile and shown once the page is live. *Default: keep it; the editor shows it on the page before anything is public, with "Show LinkedIn" beside it.*
9. **The home page's "Build your exhbt" button** (Alex's page). *Default: the label stays; signed out it leads to log in or create an account, then the portfolio. Alex's call.*
10. **When does it go on for everyone?** *Default: the day after Rory's laptop and iPhone check, once what it finds is fixed and the release checks pass, and not in the same week as the move to `app.exhbt.co.uk`.*

Smaller defaults, stated so they can be changed: "Roadmaps" stays in the nav, second; an exhbt is deleted only from its editor's menu, not its tile; the star is the only way to choose the band; the step builder stays a week after the switch-on at `?builder=steps`, then goes.

Code (from release 2): `components/portfolio/home-ctx.ts`, `components/portfolio/PortfolioHome.tsx`, `components/portfolio-editor/`, `app/(app)/portfolio/page.tsx`, `load.ts`, `actions.ts`, `lib/portfolio-kind.ts`, `lib/portfolio-kind-server.ts`, `lib/landing.ts`, `components/site/app-nav.ts`, `components/team/TeamPanel.tsx`, `app/api/portfolio/editor/route.ts`. Tests: `e2e/portfolio-parity.spec.ts`, `home-slots`, `portfolio-switch`, `portfolio-editor`, `portfolio-structure`, `portfolio-safety`, `portfolio-visitor`, `portfolio-smooth`, `portfolio-phone`. Briefs: `docs/briefs/portfolio-first/`.
