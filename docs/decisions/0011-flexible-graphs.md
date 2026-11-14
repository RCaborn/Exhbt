Status: accepted
Date: 14 Nov 2026
Amends: 0007 (what a graph can be), 0009 (which graph words count)

# Graphs come in a fixed set of kinds

Rory, 13 Nov 2026: "Every project will require different diagrams... that needs to be extremely flexible!" Until now an exhbt's graph could only be a before-and-after dumbbell. We agreed flexible within a fixed set of kinds, because the promise to an employer is that every value on a graph is printed and can be checked against the work. A free-form chart builder would break that, so anything more exotic still goes in as an image.

## The kinds

The schema, the caps and the checks are `lib/exhbt/charts.ts`; `LIMITS.charts` in `lib/exhbt/blocks.ts` points at them.

| Kind | What it's for | Caps |
|---|---|---|
| Before and after (`beforeAfter`) | one measure before and after a change | 1 to 3 rows |
| Bars (`bar`) | one measure across a few things | 2 to 8 bars |
| Grouped bars (`groupedBar`) | series side by side | 2 to 4 series, up to 6 groups |
| Stacked bars (`stackedBar`) | parts of a whole, none below 0 | 2 to 4 parts, up to 8 bars |
| Line (`line`) | change over an ordered axis: weeks, months, rounds | 1 to 4 lines, 2 to 12 points |
| Scatter (`scatter`) | how two measures move together | 3 to 30 points, both axes named |
| Big numbers (`numbers`) | headline figures, each with an optional "from" | 2 to 4 |
| Table (`table`) | a small table of figures or short text | up to 5 columns and 6 rows |

Every kind has a title. The bar kinds and lines take optional axis titles and a unit; scatter has a unit per axis. `highlight` picks the one that stands out: a bar, a series, a point, a number or a table row, depending on the kind. Comparisons (before and after, bars, grouped bars, lines) can say lower is better. Still up to 2 graphs on an exhbt; any label is at most 40 characters.

Graphs saved before kinds existed have no `kind`. They are before-and-after graphs and `ChartSchema` reads them that way, so there's no migration (`blocks` is jsonb). The store hands docs back unparsed, so everything that reads a graph calls `asChart()` first, the editor page fills the kinds in (`withChartKinds`), and publishing writes them.

## Typed in by hand

Owner, 14 Nov 2026, on importing from spreadsheets: "most data is proprietary, no can do". There's no paste from a spreadsheet and no import from an uploaded file. The graph card has a small grid where people type summary figures, not raw data: rows and series added and removed within the caps, and a note under any box that isn't a number. Switching kind keeps the figures that fit (`convertChart`); a graph with nothing typed yet starts the new kind afresh.

## Protect the real numbers

Owner, 14 Nov 2026, for confidential work: a graph can show its values as the change from the start (in %) or as an index where the start is 100, with a note under it saying the real figures aren't shared. It applies to before and after, bars, grouped bars and lines (either way) and stacked bars (index only, since stacked changes from a start add up to nothing meaningful). Scatter, tables and big numbers can't: type them as percentages instead. Where "the start" is depends on the kind: each row's before value, the first bar, each group's first bar, each line's first point, or the first stacked bar's total. A start of 0 or below can't be protected, and publishing says so.

People can type either the real figures or ones they've already turned into changes. **The real figures stay in the working copy and never reach the published copy.** We transform on publish, in the one place a published copy is written: `publishExhbt` in `lib/store.ts` stores `publicDoc(doc)`, and for a protected graph that keeps only the index, rounded to one decimal place, with the unit dropped. We chose this over storing relative values only because the person still needs their own figures to edit the graph, switch between change and index, or turn protection off. Because the transform sits in the store's publish rather than in a page or an action, no route can publish around it. The index is stable (indexing an index changes nothing), so the live page draws exactly what the editor's preview drew. The draft, which only its owner sees, keeps the typed figures, and the account export includes both copies as before.

Words elsewhere can still give a figure away (a title, a finding), so the editor's help says to check them. A before-and-after headline worked out from a protected graph is a ratio, so it's the same either way.

## Drawing

`components/charts/Chart.tsx` draws any kind, for the project page and the editor's preview alike. Each kind has its own component in `components/charts/`, written by hand with no chart library, with no client code so it renders on the server and prints. Bars are HTML (crisp text that reflows); lines and scatter use SVG for the marks with HTML text laid over them. Every graph prints its values, is one `role="img"` with a short summary for screen readers, and carries a visually hidden table of every figure; a table graph is a real table instead. Colours are one jade ramp of four steps (`SERIES_RAMP` in `components/charts/series.ts`), checked with the dataviz palette validator, and `DESIGN.md` has the rules.

## Counting and checking

`wordCount()` takes in every word a graph puts on the page: title, axis titles, unit, series names, row, point and tile labels, table headings and cells. The "lower is better" and protected-numbers notes are ours, so they don't count (as with the trust badge). The 200-word cap stays strict, and publishing is refused over it.

The AI draft may propose a graph of any kind, only from figures in the material, copied as written (`lib/ai/exhbt-draft.ts`). `lib/exhbt/verify.ts` checks every graph value and label, whatever the kind, and flags any it can't find, as before. The stand-in AI used in development and tests drafts a bar graph of the first figures in the material; asked to ("stand-in: add a figure to check" in the notes) it adds a total it worked out, so the flag can be seen without an API key.
