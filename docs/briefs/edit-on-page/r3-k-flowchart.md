# Brief K: editing the flowchart on the page

| | |
|---|---|
| Release | 3, the editor |
| Model | Fable |
| Branch | `phase-2-r3-k-flow`, made from `phase-2-r3` after G's first milestone is merged |
| Port | 3311 |
| Starts when | G's first milestone is merged |

## Goal

Make the flowchart on the editing page fully editable where it sits: type in each box, add a box on any arrow, remove one, and drag a box to another place, with the page's own markup and classes. Rory: "add the bits to the flowchart on that right-hand side".

## Read first

`docs/decisions/0026-edit-on-page-editor.md` ("Dragging", "Undo", "Accessibility"). The prototype: `git show origin/phase-2-lab:components/lab/LabFlow.tsx` (both ways of dragging a box) and the flow-box tests in `git show origin/phase-2-lab:e2e/lab-editor.spec.ts`. On your base: `components/exhbt/MethodFlow.tsx` (the slots C put in), `components/exhbt-editor/flow/FlowEdit.tsx` (G's stub), `components/exhbt-editor/store.ts`, `components/exhbt-editor/drag/options.ts`, `components/editor/FlowEditor.tsx` (today's wording and limits).

## You own

`components/exhbt-editor/flow/`, `components/exhbt-editor/css/flow.css`, `components/exhbt/MethodFlow.tsx`, `e2e/editor-flow.spec.ts` (new).

`MethodFlow.tsx` also draws the public page. Any change there must leave its read-only output identical: run `e2e/layout-parity.spec.ts`.

## You must not touch

The rest of `components/exhbt-editor/`, `components/portfolio/`, `lib/exhbt/`, `app/globals.css`. Moving the flowchart as a whole section is F's.

## What you build against

The slots `MethodFlow` calls, from `components/portfolio/page-ctx.ts`:

```ts
/** The flowchart's own slots, so MethodFlow keeps its markup and classes. */
export type FlowEdit = {
  /** Wraps the whole list (the adapter returns the <ol> it is given, inside whatever it needs round it). */
  list(o: { count: number; stack: boolean; children: ReactNode }): ReactNode;
  /** One box. The adapter renders the <li> itself with `className`, so it can be the thing that is dragged, and gives it a key that lasts. */
  box(o: { index: number; last: boolean; className: string; children: ReactNode }): ReactNode;
  /** Inside a box, out of the flow: its grip and its remove button. */
  tools(o: { index: number; count: number }): ReactNode;
  /** In the arrow after box `after`: the "+" that adds a box there. `after === count - 1` is the one at the end. */
  add(o: { after: number; count: number }): ReactNode;
};
```

You fill in `export function useFlowEdit(): FlowEdit` in `flow/FlowEdit.tsx`. The box's words are not yours: `MethodFlow` already draws them as `ctx.edit.text` fields ("Box n", id `flow-box-N`; "Box n detail").

From the store (`components/exhbt-editor/store.ts`), the part you use:

```ts
  /** The flowchart's boxes. A box has no stored id, so each gets a key that lasts for the visit. */
  flowKeys(): readonly string[];
  flowAdd(at: number): string | null;
  flowRemove(key: string): void;
  flowMove(key: string, to: number): void;
```

Each of the three changes is one undo entry. `flowAdd` returns null when the flowchart is full.

`useDoc((d) => d.flow)` gives the boxes. `useUi().say(text)` speaks. The limits are `LIMITS.flow` in `lib/exhbt/blocks.ts` (min, max). `FLOW_BOX_STYLE` in `components/exhbt-editor/drag/options.ts` is `"line"` or `"slide"`. G made that file and F owns it: read the constant and never edit the file. For your own run with the other style, change it locally and do not commit the change.

## Steps

Commit and push after each.

1. **`box`**: the `<li>` with the class it is given, `data-flow-step={key}`, keyed by the box's lasting key, so typing never remounts a box and a moved box keeps its field.
2. **`tools`**: a grip ("Drag box n to move it") and "Remove box n", out of the flow so the box keeps its size. Remove is off at the minimum number of boxes and says why. On the dark last box they must still pass contrast in every look.
3. **`add`**: a "+" in each arrow ("Add a box after box n") and one after the last box ("Add a box at the end"), gone at the maximum. The new box takes the focus. It must take no room: the arrows stay where they are.
4. **Dragging a box**, both ways, chosen by `FLOW_BOX_STYLE`:
   - `"line"` (the default): the flowchart stays still, a line in the gap shows where the box will go, a copy the size of the box follows the pointer, and on the drop the boxes move to their places, 180ms, transforms only.
   - `"slide"`: the other boxes slide aside (dnd-kit's sortable does this well for boxes of one size in one line).
   The flowchart is a row or a column by its container's width, so read which it is from the list and sort along that axis. Mouse after 6px, touch after a 150ms press, keyboard from the grip (Space or Enter, arrows, Space or Enter, Escape), each step read out ("The box would go to place 3 of 5"). Nothing animates under reduced motion.
5. **The last box is the result**, drawn dark, whichever box that is after a move. Check it follows.
6. **Issues**: a box with an issue at `flow.N.step` or `flow.N.detail` is marked by the field (G's); the count issue at `flow` ("The flowchart needs at least 3 boxes.") shows under the flowchart, tied to the list.

## Tests

`e2e/editor-flow.spec.ts`, on a case study (a row), a gallery (a column beside "What happened") and research (a column under "Method"):
- typing in a box re-renders the flowchart only, once a key (use `renders(page)` from `e2e/page-editor.ts`);
- "+" on an arrow adds a box there with the focus in it; at six boxes there is no "+"; Remove at three boxes is off;
- a box dragged along the row and down the column lands where shown; with `"line"` every other box stays where it is until the drop and a copy the size of the box is carried; nothing moves when the drag starts;
- the keyboard moves a box, each step read out;
- adding, removing and moving a box are each undone by Undo, and typing done in between is kept;
- the dark box is always the last;
- on the `touch` project: the flowchart is a column and a box is dragged down it after a short press; a swipe on a box scrolls the page;
- with reduced motion nothing animates;
- axe, in the Exhbt and Night looks.

Run: `e2e/editor-flow.spec.ts` on both projects, `e2e/layout-parity.spec.ts`, `e2e/editor-smooth.spec.ts`.

## Done looks like

The checks above pass on all three layouts; the parity spec still passes; changing `FLOW_BOX_STYLE` to `"slide"` needs no other change (run your spec once each way, without committing the change, and say so).

## Report back

The branch head; anything you changed in `MethodFlow.tsx` and why; whether both styles pass; anything in the slots you needed changed; the specs you ran and their results.

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
