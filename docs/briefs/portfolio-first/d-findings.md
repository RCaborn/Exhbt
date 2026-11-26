# What agent D found: read this before briefs E, F, G, I and J

Agent D built the portfolio page's edit slots (`components/portfolio/home-ctx.ts`, `PortfolioHome.tsx`, merged at a171f97). Its report changes three things in the other briefs and adds rules for anyone who fills a slot. **Where this file and a brief disagree, this file wins.**

## Three corrections to the other briefs

1. **`owner("band")` fills the button row only.** With no exhbt and the band on the page, the page draws the band itself: the look's own treatment, "My best piece of work", and the heading "Your best project goes here" (`id="best-work-h"`). `owner("band")` sits where "See how I did it" goes, a flex row. `bandButtonClass(cta)` is exported so "Add an exhbt" can be the look's own button.
   - **F's step 9 is changed:** F draws only the button. Drawing the whole band would put a band inside a band.
2. **"Looking for" is a seventh difference that takes room in the editor.** The field shows the words as stored. Visitors get them with the first letter lowered (`lowerFirst`, in Meta and in Ledger's row), and in Notebook with `upperFirst` and a leading "Looking for" taken off. On the full fixture this makes Meta's span 2px wider.
   - D's spec lets only the width differ, only on Meta's `[data-looking-for]` span and Ledger's `dt`, and only when the printed words differ.
   - **E's `HOME_EDIT_ONLY_IN_FLOW` and J's box tests need this entry.**
   - Decided by the main session: accept the difference. The words are not changed on save.
3. **Studio's name keeps its lines only with a CSS fix.** As one field, a two-word name fitted on one line at 412 wide and the hero lost 42px. The editing `<h1>` now takes `[word-spacing:100cqw]`, so it breaks after every word. Proven with plain text in Chromium only.
   - **E's field needs `word-spacing: inherit`** (a `<textarea>` gets `word-spacing: normal` from the browser) **and a test of its own.**

## Rules for whoever fills a slot

- **`owner("work-end")`** is the last child of the work's `<ul>` or `<ol>` (the card grid, or the rows). It must return `<li>`s.
- **`owner("page-end")`** is a bare child of the page root, after the last section and before the footer, with no wrapper.
- **`lineTools`** is the last child of the lines' `<dl>`, which is `relative` while editing. It picks up the `.pf-rows > * + *` hairline, so make it absolute and drop that border.
- **`tools("intro")`** is the last child of `[data-intro]`, which is `relative` while editing.
- **`tools("contact")`** is a grid child of the Get in touch section, which is `relative` while editing. It must be absolute.
- **`photo(face)`:** the face is a grid item with `order-*` classes in Classic, Mono and Ledger. A box wrapped round it moves it at phone width.
- **`tile`** sits inside the card's `<li>`. The card is `h-full`, so the frame must pass the height through.
- **`index` and `count`:**
  - a section is counted among all sections drawn;
  - the band is index 0 of 1;
  - a card or row is counted within the work's list, without the band's exhbt;
  - `lineTools.count` is the number of stored lines, empty ones included, and `max` is `TILE_LIMITS.lines`.
- **Lines:** a line's two halves share one path. The index is 0-based and the name 1-based ("Course or qualification N", "Year", "Role N", "Years"). Empty lines are drawn, so the path matches the stored index.
- **No `maxChars` is passed,** as on the exhbt page; the checks report anything too long.
- **Field sizes:** the year cells and Ledger's location are `shrink-0` block fields. Check field sizes there.
- **Inert while editing:** the top bar's `<nav>`, the footer, and the card, row, band and contact links. The hero is never inert.
- **Empty sections while editing:**
  - About: its heading, an empty paragraph field, then the education list and the Tools row.
  - Experience: its heading and an empty list.
  - Quote: the marks and its three fields.
  - Get in touch: its heading and an empty list.
  - More of my work: always drawn, headed "More of my work" when the band is on the page and "My work" when it is not.
- **Labels** use the table's straight apostrophes. D chose the placeholders, including "e.g. Leeds", "e.g. graduate data roles" and "e.g. 2026".

## Where each hero draws a field

Every hero passes its face through `photo(face)`.

| Treatment (looks) | Fields | Stays as words |
|---|---|---|
| portrait (Exhbt, Night), greeting (Bloom) | name in the `<h1>` (block); headline `<p>` (block); intro `[data-intro]` (paragraphs, with `tools("intro")` inside); location and looking for in Meta (inline) | none |
| masthead (Classic) | name, headline, intro, Meta | none |
| notes (Notebook) | name, headline, intro; Looking for and Based in as block fields in their fact `dd`s, always drawn while editing | the Education fact, the skills |
| terminal (Mono) | name, headline, intro, Meta | the `~/username` path, the skills |
| block (Studio) | the face sits in the band block; the name is one field in the `<h1>`; headline, intro, Meta | none |
| ledger (Ledger) | name, headline, intro; Meta only when there is an education line. With none: "Looking for {inline field}" in a row's `dt`, and the location (block) in Based in's `dd` | the education rows, the "Pieces of work" count |

In sections:
- **About:** `about.text` as paragraphs, with the visitor's `<p>` classes as `paraClass`. Each stored line has two block fields, `part` "label" and "year". The Tools row is a block field.
- **Experience:** the same two-field lines.
- **Quote:** the words, the name and the role, all inline, with ", " always drawn between the name and the role.

## Data findings for E

- About's text goes through `oneLine` in `TilesSchema`, so a paragraph break typed in About does not survive a save.
- `joinYear("", "2024")` gives "2024", which `splitYear` reads back as words with no year. `splitYear` is unchanged.
- In Ledger, the location and looking-for fields move from the rows to the line under the intro when the first education line gets words.

## The harness D left

`/dev/home-slots` (development only; 404 in production) takes these from the address:
- `u`: a person seeded through `/dev/portfolio-parity`;
- `look`: a look's id;
- `read=1`: the same page with no adapter;
- `case`: `full`, `none`, `one`, `no-work` or `empty` (all six sections, no words).

`e2e/home-slots.spec.ts` has 54 tests (8 looks × 6 cases, the harness's visitor page against `/p/` markup for markup, and 5 `joinYear` tests). If CI needs it shorter, the four cases beyond full and sparse take about two thirds of the time.

## Not checked by D

- Whether `memo` skips a render in the browser. That belongs to E's smoothness spec.
- `edit` drawn from a client component: the harness renders on the server.
- The word-spacing fix in a real field, or in WebKit.
- That each placeholder is one line high.
- The long-name fixture in `home-slots`.
- `phase2-builder` has not had one clean full run on D's head: every test passed, but not in one run, because the shared machine was out of memory. Run it once when the machine is quiet.
