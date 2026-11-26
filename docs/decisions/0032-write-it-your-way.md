Status: accepted
Date: 26 Nov 2026
Amends: 0009 (a section's title is not counted, and nor is a part that is not drawn), 0015 (a quote takes bold and italic, and needs no name; no minimum number of boxes or findings; nothing has to be filled in), 0024 and 0028 (what a layout "needs" is a suggestion; the flowchart can leave any layout), 0026 (where the formatting buttons are; three more formatted fields; titles typed in place; "Suggestions"; the flowchart's Remove is never off), 0027 (the flowchart can be removed in every layout, and a layout switch no longer brings it back), 0029 (the fields the AI's emphasis is kept out of are unchanged, but a person may now format three of them), and `DESIGN.md` (the exhbt page's headings and quote; the editor paragraph)

# Write it your way: formatting, your own titles, and nothing compulsory

Rory, 26 Nov 2026, after using the edit-on-page editor on the live site:

- "In the editor I should be able to bold and italicise text as I please... also the quote should not be confined to being titled 'feedback'."
- "Quotes also don't necessarily need who said it! We need customisability in box titling as well as optionality in filling in all sections or not!"
- The day before, which led to decision 0030: "It should be less forceful on certain sections. It should allow a bit more customizability."

He wrote the first of these in a quote: he had selected words and found nothing to press. A quote was plain text, and where a field did take bold, the buttons sat at the far end of its line, not by the words he had selected.

Three things change. A person can format a sentence wherever they write one. A person can title a section themselves. And nothing has to be filled in: what is left to stop publishing is what keeps a page honest and readable by everyone.

## A. Bold and italic wherever a person writes sentences

**Three more fields take bold and italic:** a quote's words, an essay's pull quote, and the one line under a link. They take no links: none of them sits beside a field that does, a quote is someone else's words, and a link's line already sits under its own link. Titles, section headings, flowchart boxes, skills, the sidebar's facts and a link's label stay plain. They are one-line labels.

Decision 0015 kept a quote plain because "formatting them changes what they said". Rory wants the choice, and it is the same choice a person has when they quote someone anywhere else.

**How the formatting is stored.** The plain string stays exactly where it was, and the same words with their formatting are kept beside it as runs:

| Section | The words (as before) | Their formatting (new, optional) |
|---|---|---|
| quote | `text` | `textRuns` |
| pull quote | `text` | `textRuns` |
| link | `description` | `descriptionRuns` |

The string owns the words. The runs are there only when some of them are formatted, and they are read only while they spell exactly the string (`richOf` in `lib/exhbt/blocks.ts`). Otherwise the string is drawn plain. `normaliseDoc`, which the store runs on every read, takes away runs that no longer spell their string.

Why beside, and not in the string's place:

- **A step back is safe.** The build that was live before this, and the classic editor, read `text` as a string. Had the string become runs, the old page would have thrown on a quote. As it is, the old build draws the plain words, and its next save drops the runs it does not know (every save runs the doc through its schema, which keeps only the keys it knows).
- **Words changed by code that does not know the runs are never drawn in old formatting.** The classic editor changes the string and leaves the runs; so would a copy kept in a browser by the old build. Because the runs must spell the string to be used, the new words are drawn plain.
- **Every count and check already reads the string.** Word counts, the number check, the check that a quote is in the person's material and the AI's source-quote check are unchanged, as decision 0029 requires of emphasis.
- **A page nobody has formatted is byte for byte the page it was.** With no runs, the page writes the same text it always wrote. `e2e/layout-parity.spec.ts` passes against its golden copies, untouched.

`e2e/step-back.spec.ts` proves the first two: it keeps a frozen copy of `lib/exhbt` as it was on the live build (`e2e/fixtures/reader-before-0032/`) and hands it docs as this code saves and publishes them.

**Where the buttons are.** Before this, on a laptop, a formatted field showed three small buttons above the right-hand end of its line for as long as it had the cursor (below the line on a section's first line, where the section's toolbar sits). They were in the right place for someone about to type, and a long way from words already selected. A plain field, the quote among them, showed nothing at all.

Now:

- **Words selected, with a mouse or the keyboard:** a small bar sits just above the selection with Bold and Italic (Highlight on the context line), and Link where the field takes links. Link turns the bar into the address field, so the address is typed where the words are; Enter adds it, Escape gives the cursor back to the words. While the bar is up, the buttons at the end of the line go, so there is one set and it is where the eye is.
- **The cursor in a field with nothing selected:** the buttons at the end of the line, as before.
- **Ctrl or Cmd with B or I** work in every formatted field. A key pressed in the moment before a field's editor has loaded is kept and done when it has.
- **A field that takes no formatting shows nothing.**
- **Under a finger** nothing changes: a phone has the buttons in the bar at the foot of the screen, which now covers the three new fields (with no Link for them), and a tablet keeps the buttons at the end of the line. The bar at the selection is only for a screen whose own pointer is fine (`pointer: fine`), because a phone's and a tablet's own copy and paste bubble sits exactly where it would.

The bar is in the browser's top layer, so nothing on the page moves when it comes or goes (`e2e/your-way.spec.ts` measures every box before and after).

**The bar is Astryx** (Rory, 26 Nov 2026: "you must use astryx as the design guide"): a fixed layer from `useLayer`, a `Card` for its surface, a `Toolbar` of `ToggleButton`s and an `IconButton`, each with Astryx's tooltip, and a `TextInput` for the address. Astryx's `Popover` was not used for the address: it hangs from a button and keeps the focus until it closes, and this has to hang from a selection and hand the cursor back to the words. The buttons at the end of a line, the phone's bar and the field's own address prompt are the editor's existing chrome and stay as they were built; moving them to Astryx is its own job.

## B. Section titles the person can change

Every heading the page draws over a part is a field typed in place:

| Heading | The layout's own | Where the person's is kept |
|---|---|---|
| the findings' | "What I found", "What happened", "Results", "What it does", "Key points", "What changed and why", "How it went" | `title` on the section |
| the quote's | "Feedback", or "Review" in an event | `title` on the section |
| what I'd do next | "What I'd do next" and each layout's own | `title` on the section |
| the aim's | "Aim" or "Hypothesis" | `title` on the section |
| the conclusion's | "Conclusion" | `title` on the section |
| the flowchart's | "What I did", "Method", "How I built it", "How the argument runs", "How we put it on"; none in a case study | `flowTitle` on the doc |
| a list of links' | "References", "Sources" | `refsTitle` on the doc |

The flowchart's is on the doc because its marker holds nothing and is taken out when the flowchart is removed (0027); its title stays with its boxes and comes back with them. A list of links is no one section, so its title is on the doc too.

**Three states, one optional string each.** It is jsonb, so there is no migration.

- **Nothing stored:** the layout's own heading. It follows a layout switch, as it always did.
- **The person's words:** theirs, kept through a layout switch. Typing the layout's own words again stores nothing, so the heading follows the layout once more. That is the way back.
- **An empty string:** cleared. A visitor sees no heading, and the editor keeps a faint "Add a title" in its place, so it can come back.

**A case study draws no heading over its flowchart** ("Process" is only the section's name for a screen reader). A placeholder there would sit on every case study, so the way in is a small "Add a title" over the flowchart's top edge, out of the flow, as the aim's switch is. Pressed, it puts the field in the flow; a title left empty takes it out again. A title typed there is drawn as a small label over the boxes.

**One line, at most 28 characters** (`LIMITS.sectionTitleChars`, checked on publish as every one-line field is). The longest heading a layout has of its own is 25 ("Limitations and next steps"). At 28, a title of ordinary words holds on one line in all eight looks at 390px, in the large heading the findings and the flowchart take; one made of the widest letters wraps to a second line, and nothing overflows. `e2e/your-way.spec.ts` measures both.

**A title is not counted in the 200 words**, the person's no more than the layout's own ever was. Counting it would have meant that changing "What I found" (never counted) to "Findings" made the page longer. It is one short line, held by its own limit. This amends 0009, which counts every word on the page; Rory may want it the other way, and it is one line in `sectionTexts` if he does.

**The aim's switch** (Aim or Hypothesis) names the heading, so pressing it puts the layout's heading back over a title the person typed.

**The AI sets no titles.** The draft's answer is the size it was: `npm run probe:ai -- --dry` still says 39 and 41 fields. A rewrite of the findings keeps the section's title.

**A page with no title typed is drawn exactly as before.**

## C. Nothing is compulsory except honesty and access

**A part left empty is not drawn for a visitor**, on the public page, in "See as a visitor" and in print. The editor keeps its placeholders. There is one definition of empty (`isBlank` and `filledFlow` in `lib/exhbt/blocks.ts`), read by the page, the published copy, the word count and the publish check:

- findings with no words in any of them; a finding with no words is left out of the list;
- a graph with nothing typed in it, its title included;
- a quote or a pull quote with no words (a name with no quote is not a quote);
- what I'd do next, an aim or a conclusion with no words;
- a link with no label, no line and no address;
- a flowchart box with no words; a flowchart with no box left is not drawn at all;
- a skill left empty.

Before this, most of these were things to fix ("Fill in this finding or remove it."). Three of the renderers would have drawn a bare heading for an empty part had it ever been published: the quote ("Feedback" over an empty pair of quotation marks), what I'd do next, and the flowchart outside a case study.

**The published copy holds only what is shown** (`publicDoc`). Empty parts stay in the working copy. So a portfolio card, a link preview and the build before this one never meet one.

**A quote needs no name.** With none there is no line under the words, and no stray comma. A role is drawn only with a name.

**What a layout "needs" is a suggestion.** `FORMAT_RULES[layout].needs` (a gallery's two images, research's aim, an event's role and the rest) and the least there may be of a thing (three flowchart boxes, two findings) no longer stop publishing. The editor shows them under their own heading, "Suggestions", in the top bar's fix list and in "Review and publish". They are not counted in "things to fix", they never mark a field, and the words under them say "None of these stops you publishing." When they are all there is, and the exhbt could go live as it stands, the top bar's button is a quiet "2 suggestions"; an exhbt that has barely been started is not handed a list. Only what a visitor would see answers one: an aim section with no words does not answer "Add your aim or hypothesis".

**Every section can be removed in every layout, the flowchart too.** A case study and research kept theirs (0027, 0028), with Remove shown off and a reason. That rule is gone. The "+" and the tray offer the flowchart back, at the place chosen, with its boxes and its title. A layout switch leaves a flowchart that was taken off where the person left it: off.

A flowchart box and a finding can be removed down to none, with their own buttons. The classic editor's own Remove buttons still stop at three boxes and at the layout's least number of findings; its publish check does not.

### What still stops publishing, and why

| Still needed | Why |
|---|---|
| A title, and something on the page besides it | A title alone is not a page |
| The page's 200 words (0030) | It keeps an exhbt to a quick read |
| A description for each picture | For people who can't see it |
| "I may share this figure", on a figure taken from the person's files | It may be someone else's to share (0017) |
| "This is my work, and the numbers are true", and the numbers to check | Honesty (checked on the server) |
| The most there may be of each thing, and the room a one-line field has: the title, the sidebar's facts, a skill, a flowchart box and its detail, a quote's name and role, a link's label, a section's own title | They protect the layout |
| The username and the plan | As now (checked on the server) |
| A link that opens: https only, in formatted text, in a link section and for the work | A page must not send a visitor somewhere unsafe, or nowhere |
| A link section with words but no address (except an essay's source, as now) | A link that goes nowhere misleads a visitor; a person who wants none removes the section |
| A graph that has been started: its own checks | Half a graph misleads; one with nothing in it is simply not drawn |
| An exhbt that can't be read at all | It could not be drawn |

The last four were not named when this was asked for. They are kept because each is about honesty or about a visitor being able to use the page, and they are listed here so Rory can decide otherwise.

### What no longer stops publishing

Each of these was a message in `validateForPublish`:

- the context line: "Add the context: why the question matters." and each layout's own wording of it;
- the flowchart: "The flowchart needs at least 3 boxes.", "Type in this box or remove it.";
- findings: "Add at least 2 findings." (and each layout's least), "Fill in this finding or remove it.";
- a quote: "Type in the quote or remove it.", "Say who said it.";
- what I'd do next, an aim, a conclusion, a pull quote: "Say what you'd do next, or remove this.", "Write your aim or hypothesis, or remove this.", "Write your conclusion, or remove this.", "Type in the pull quote or remove it.";
- a link: "Say what the link is." (a link with an address and no label is drawn as "Link", or the layout's word for one);
- a skill: "Fill in this skill or remove it.";
- every layout's needs: "Add findings or a graph, so the exhbt shows what came of the work.", "A gallery needs at least 2 images.", "Add your aim or hypothesis.", "Add your conclusion.", "Add a graph or an image: the key figure.", "Add your results.", "Add a screenshot or a link, so people can see it working.", "Add your key points.", "A before and after needs at least 2 images.", "Mark one image Before and one After.", "Add what changed and why.", "Add at least one picture, such as the poster.", "Say what your role was."

The two that said "needs" now read "works best with", since they are suggestions.

## A step back

If this build is rolled back to the one before it (origin/main at d277be7), with exhbts saved and published under 0032 in the database:

| What was saved under 0032 | What the build before it does |
|---|---|
| Bold or italic in a quote, a pull quote or a link's line | Draws the plain words. Its next save of that exhbt drops the formatting |
| A title of the person's own | Draws the layout's own heading. Its next save drops the title |
| A quote with no name, published | Draws the quote with no line under it |
| A part left empty, published | Draws nothing for it: the published copy never held it |
| The same, in the working copy | Lists it under things to fix, as it did before |
| A flowchart taken off a case study or research | In the working copy the flowchart is back, first, with its boxes, and Remove is off again. The live page was published with no boxes, so it shows an empty flowchart until it is published again: nothing at all in a case study, and the bare "Method" label in research |
| A flowchart taken off any other layout | No flowchart, as before |

The research case is the one unclean result. Keeping the boxes in the published copy would have been worse: the old build would then show a visitor a part the person took off.

One thing reads differently going forward as well. Before this, a case study or research whose doc said the flowchart was off (it could be taken off in another layout, and the layout then switched in the classic editor) still drew it, first. Now it is off, as the doc says. Nothing in the product removes a flowchart and then switches layout that way without the person doing both, and the new editor's own switch wrote the flowchart back in, so no such page is known; one query against `exhbts.blocks` would say for certain.

## Both editors

The publish check is shared, so the classic editor is relaxed with it, and its list "To finish this layout" is now "Suggestions for this layout". It offers neither the titles nor the three fields' formatting, and it keeps both when it saves (`e2e/editor-classic-keeps.spec.ts`). If a person retypes a quote there, its formatting goes with the old words.

## Not done

- **The sidebar's labels** ("What it is", "Where and when", "My role", "Can you trust it?") and **the skills' name** stay as they are.
- **A title for a part the page draws no heading over:** a graph (it has its own title), a picture (its caption), a link drawn as a card or a button, a pull quote, the lead image.
- **The classic editor** offers no titles and no formatting in the three fields, and its own Remove buttons keep their old minimums.
- **Links in a quote, a pull quote or a link's line.**
- **The bar at a selection under a finger.** A tablet keeps the buttons at the end of the line.
- **The buttons at the end of a line, the phone's bar and the field's own address prompt in Astryx.** They are existing chrome.

## Not sure, and risky

- **Safari and Firefox** have not been tried. The bar is a native popover placed by hand; Astryx shows it as an ordinary fixed box where the browser has no popovers.
- **A real phone** has not tried the three new fields in the bar at the foot of the screen.
- **A screen reader** has not been heard on the bar or on a cleared title.
- **The words of the suggestions** are a first draft.

Code: `lib/exhbt/blocks.ts` (`richOf`, `isBlank`, `filledFlow`, `hasBody`, `validateForPublish`, `suggestionsFor`, `publicDoc`), `lib/exhbt/formats.ts` (`flowHeading`, `sectionHeading`, `refsHeading`, `titleShown`, `flowShown`), `lib/exhbt/layouts.ts`, `components/portfolio/exhbt-parts.tsx`, `LayoutMain.tsx`, `page-ctx.ts` (`TitleSlot`, `beside`, `quoted`), `components/exhbt-editor/fields/SelectionBar.tsx`, `TitleField.tsx`, `RichEditor.tsx`, `RichField.tsx`, `topbar/Suggestions.tsx`, `css/your-way.css`. Tests: `e2e/your-way.spec.ts`, `e2e/your-way-model.spec.ts`, `e2e/step-back.spec.ts`, `e2e/editor-classic-keeps.spec.ts`.
