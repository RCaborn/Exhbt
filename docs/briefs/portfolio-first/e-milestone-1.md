# What agent E built at milestone 1: read this before briefs F, G, I and J

Agent E's first milestone is merged into `phase-2-pf2` (67e13c8, 26 Nov 2026). With the development cookie at `page`, `/portfolio` draws the person's page through `PortfolioHome`'s adapter, every field in decision 0031's table types in place, and the page saves through `useBuilder`. With no cookie the step builder is as before. **Where this file and a brief disagree, this file wins.** `d-findings.md` and `astryx.md` still apply.

## Who owns what now

Everything below is in `components/portfolio-editor/`.

| Agent | Takes over these stubs | Also makes |
|---|---|---|
| F | `sections/SectionFrame.tsx`, `sections/ArrangeBoard.tsx` (new, see change 2), `tiles/TileFrame.tsx`, `tiles/LineTools.tsx`, `tiles/OwnerParts.tsx` | `css/arrange.css` |
| G | `bar/EditorBar.tsx`, `bar/FirstRun.tsx`, `sheets/PhotoButton.tsx`, `tools/PartTools.tsx` | `css/bar.css` |
| I | `phone/ItemMore.tsx` (with the `ItemAction` type) | `css/phone.css` |

E keeps everything else: `runtime.ts`, `runtime-core.ts`, `adapter.tsx`, `Canvas.tsx`, `home.ts`, `home-props.ts`, `fields/`, `ui/` (`Sheet`, `SaveStatus`, `UndoButton`), `PortfolioEditor.tsx`, `PortfolioGate.tsx`, `StandIn.tsx`, `pending.ts`, `undo.ts`, `paths.ts`, `renders.ts` and `css/core.css`. If you need a change in one of E's files, say exactly what in your report or tell the main session; do not edit it.

## Eight changes to the briefs

1. **`SectionFrame` takes `sectionKey`, not `key`.** Its props are `Omit<HomeSectionSlot, "key"> & { sectionKey: SectionKey; children }`. React never passes a prop called `key` to a component, so the brief's signature could not work.
2. **A new stub for F, `sections/ArrangeBoard.tsx`:** `ArrangeBoard({ children })`. The canvas draws the whole editing page inside it, within the look's wrapper. It is where a drag's context, sensors and lifted copy go: the frames are one per section, and a drag needs one parent round them all. `useEditingHome()` in `home.ts` gives the page's own props for drawing a lifted section.
3. **The runtime's API gains `seeAsVisitor(on: boolean)`.** `usePortfolioUi()` returns `{ sheet, previewing, issues, visitor, full, marked, team }` and also takes a selector, `usePortfolioUi((u) => u.sheet)`. A new `usePortfolioSave()` gives `{ status, stale }`.
4. **`PortfolioData` gains `owner`** (the user id) **and `admin`** (for G's "go back to the step builder for good"). The loader is `loadPortfolioData(userId, host, admin = false)`.
5. **`ui/Sheet.tsx` is Astryx's `Drawer`,** not a copy of the exhbt editor's dialog: `<Sheet name title subtitle? purpose? width? footer?>`, full width under 640px. The bar stub is Astryx's `Toolbar` in a frame exactly `--xe-topbar-h` tall, with the heading, Undo and the save status in it.
6. **For F, three attributes:** `data-owner` on what `OwnerParts` draws (`HOME_EDIT_ONLY_IN_FLOW` in `e2e/portfolio-editor.ts` selects on it); `data-path` (the list's own path) on `LineTools`; and `data-tile="<id>"` on an owner-only tile, so that `?at=` can find it.
7. **A paragraph field's box is a `<p>`,** as the visitor's is. Astryx's reset gives every bare `<p>` the body size, so the intro's paragraphs are 16px on visitors' pages whatever their box says. Anyone drawing words on the page checks against `/p/<name>`, not against the classes.
8. **Exhbts the state's `order` does not hold yet** (made since the page opened) are drawn after it (`shownProjects` in `home-props.ts`), as the server puts them on a save.

## Not working until E's milestone 2

- `seeAsVisitor` sets `ui.visitor`, but the canvas does not switch yet.
- Nothing reads `?open=`, `?at=`, `?full=1`, `?joined`, `?left`, `?step=` or the hashes yet; `ui.full`, `ui.marked` and `ui.team` are always empty.
- `change(update, label)` records undo steps and the Undo button works, but it has no test yet and there is no Ctrl+Z.
- Problems show at a field with the look's error outline, and the status says "Not saved: ..." with "Show me". This is untested, and a line of education that is too long has nowhere to show until its key moves to the line.
- There is no keeping of a stale save, no note about two tabs and no toast.

## One open fault, E's, first in milestone 2

The editor's save does not revalidate. After Back from another page, Next can remount the editor on the props it was first loaded with, and the next key press would save old words over new. Tile, exhbt editor, Back is the journey F builds, so **F does not rely on Back being right until the main session says this is closed.**

## What had run at the merge

- `e2e/portfolio-core.spec.ts`: 13 of 13 across three runs, never all in one. Two runs lost tests to "Target crashed" and "Page crashed", which the kernel log shows as out-of-memory kills on the shared machine.
- `e2e/phase2-builder.spec.ts`: 9 of 9.
- Not run by E: `portfolio-parity`, `home-slots`, `phase2-customiser`. E changed nothing in `PortfolioHome.tsx`; its only edit in `components/exhbt-editor/` is three exports in `fields/InlineText.tsx`.
- The type check, lint, the docs check, the theme check and `check:protected` pass.

## Pushing

Put `[skip ci]` at the end of the first line of every work-in-progress commit you push: each push without it queues 19 jobs on a pool of 20 that the releases need. Leave it off only on the commit you push at a milestone or before your report.
