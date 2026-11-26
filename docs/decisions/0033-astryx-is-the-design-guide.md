Status: accepted
Date: 26 Nov 2026
Amends: 0005 (Astryx goes from the buttons to the whole app and every marketing page), 0026 (the editor's sheets, menus and top bar become Astryx components as each is moved, the buttons in its corner toolbars move from the look's variables to Astryx on the app's own surface, the publish step ends on the finish, and the "add teammates" line leaves the top of the editor if Rory agrees: question 6), 0031 (the note after a first publish is the finish; the first-run strip gains a ticked first step; the Add tile has one button; the portfolio's bar is an Astryx toolbar, not the exhbt editor's classes; the copied sheet, save status and Undo are built on Astryx), and `DESIGN.md` (Motion, Shape and depth, the Operate line of "Mode by surface", Focus, and "What is on Astryx today": the new wording is under "What DESIGN.md says as each part lands")

# Astryx is the design guide, and six things make the site Exhbt on top of it

Rory, 26 Nov 2026: "I want you to continue the full build as discussed. However you must use astryx as the design guide! Currently the entire site is lacking the strong UI feel it needs! The flare it must bring! Continue with what we are doing while also planning forward how we must inflate the appeal of the site!"

Later the same day: "It is also clear that we must understand that it is not obvious what we do or how we help... that should be considered as we design to limit confusion and help sell the product and continuation to building portfolios and exhbts." And: "The site is good right now... it could be GREAT."

On 24 Nov he and Alex had said what the product should feel like: "your own personal website", "a real click and play, plug and play everywhere". Alex on the looks of the app: "huge margins on the side... block block". Both liked scroll-led pages "like the Apple page". On 25 Nov Rory called the old two-column editor "messy... clunky... the continuity is just not there", and said of the one-page editor: "I really like the new editor."

He also asked for the methods other products use to draw people in and keep them going. That is answered under "Drawing people in and keeping them going", with the tactics we refuse and why.

So Astryx becomes the system the app and the marketing pages are built from: its components, its tokens and its layout rules, in an Exhbt theme. A design system gives consistency and nothing more, so this record also fixes what gives the site its own character (six things, below), makes clarity a goal with its own tests, and turns the chosen methods into jobs. The build is `docs/design/appeal-plan.md`; the one page for Rory and Alex is `docs/design/for-rory-appeal.md`.

Six reviews of the live code were written on 26 Nov from 76 screenshots of `main` (38 at 1440 wide and 38 at 390): how well the site fits Astryx, how it looks, a new student's journey, how ambitious it could be, how clear it is, and what keeps people going. This record takes their findings where they agree and says which way it went where they don't.

## The order of authority

Highest first. `DESIGN.md` already carries this list (it went in with the agent guide on 26 Nov); this record is the reason for it.

1. **The fixed brand.** Mint, jade, ink and white; Bricolage Grotesque and Inter; the mark (`docs/brand.md`). Nothing below may change a colour or a face. The Exhbt theme (`themes/exhbt/exhbtTheme.ts`) carries the brand into Astryx.
2. **Astryx.** Three parts, all binding on the surfaces it governs:
   - its **components**: every control is an Astryx component, read first with `npm run astryx -- component <Name>`, and nobody hand-builds one Astryx has;
   - its **foundations**: colour roles, spacing, radius, elevation, motion, the type scale and the focus ring come from its tokens through the theme, with no fixed colour, pixel size or timing in app code;
   - its **layout rules**: the frame first (shell, then regions, then content), one content line a page, rows for lists and a card only for a thing that stands alone.
3. **`DESIGN.md`'s own rules and its banned list.**

Where a `DESIGN.md` rule and an Astryx foundation disagree, Astryx wins, and the `DESIGN.md` line is rewritten in the same change so the two never contradict each other on `main`. The disagreements found so far are under "What DESIGN.md says as each part lands".

The banned list never has to give way, because nothing in Astryx obliges a page to use what it bans. It narrows what we take: no `Carousel`, no `Badge` as decoration (a `StatusDot` or a `Token` says a status), no hero stat strip, and no icon, heading and text card grid, though Astryx offers each. The rule against any claim before it is true sits above everything here.

## What Astryx governs, and what it does not

| Surface | Governed by |
|---|---|
| Marketing pages (`app/(marketing)`), the roadmap, "Add an exhbt", account, billing, job links, admin, sign-up and log-in | Astryx |
| The chrome of both editors: the bar along the top, the first-run strip, notices, the toolbars and buttons drawn over a part's corner, menus, popovers, sheets, confirmations, toasts, tooltips | Astryx |
| A person's public pages (`/p/*`): the portfolio home, each exhbt, a job-link page, the pager, the sign-off | The person's look (`--pf-*`, `--xp-*`, `lib/portfolio-themes.ts`). Not Astryx |
| The same pages while they are being edited: every word typed on the page, placeholders, the frames round sections and tiles, and what only the owner sees in the page's flow (the Add tile, draft tiles, the hidden row, the band's button) | The person's look. Not Astryx |
| Graphs and the skill radar, the mark, the seal, the tick, pictures of the product in a browser frame, the viewfinder pattern, the drag engines | Their own rules in `DESIGN.md`. Astryx has no match for them |
| Emails | Unchanged: tables and plain hex |

**The line inside an editor.** What sits in the page's flow is the page, and takes the look's variables. What the editor draws over or around the page is chrome, and is Astryx on the app's own white surface, so it reads on all eight looks, Night included: the corner toolbars, "Suggest an intro", "Your links", the photo button, and everything they open. The portfolio editor is being built this way now (briefs F and G of the portfolio build). The exhbt editor's corner toolbars are older and take the look's variables (`.xe-tool` reads `--xp-*`, decision 0026). They move to the same Astryx parts in the plan's phase 5, and until they have, the corner controls of the two editors differ. That is the one seam this plan knowingly leaves open for a time, on the two screens a student goes between most, so the job that closes it must not drift.

**The theme reaches visitors' pages.** `app/layout.tsx` wraps every route, public pages included, in the Astryx theme, and the theme's built stylesheet sets bare paragraphs, small text and headings from its type tokens in the lowest layer. The public exhbt page also draws one Astryx button ("See the work"). So a change to the theme's type scale, its body, heading or supporting text tokens, its text colours, its control sizes or its button can move or recolour a page an employer reads, and CI would not see it: the golden-copy tests compare markup there, and boxes only on the machine that wrote them. The rule that follows is in the plan's "Rules that keep visitors' pages and live data safe": those settings change one at a time and only while both parity specs pass with boxes, the rest of the voice is set through tokens only Astryx's own components read, and no theme change is merged without those runs. The design lab's proposed theme changes the type scale and the headings' weight; that is safe in the lab, where every rule is scoped to the lab's own pages, and is exactly what has to be proven before it becomes the real theme.

## Clarity is a goal of its own

Rory said it is not obvious what Exhbt does or how it helps. The clarity review found the real pages explain the product better than the words do, and that Home shows them late or cropped. So clarity is held to the same standard as the look, with rules a test or a cold reader can check.

**Every screen says what it is for and what happens next.** On each app and marketing screen:
- one heading names the thing in the person's own words ("Add an exhbt to your portfolio", not "Draft an exhbt");
- where that is not enough, one line under it says what the screen is for;
- there is one main button, it is the next step, and it carries one of the labels below;
- every finish hands the next step over where the person already is: a draft arrives with what to check, a publish with where to put the link and what to add next, a payment with "choose your address, then publish", a roadmap with "Already finished a project? Add it as your first exhbt".

**One label for one action.** The clarity review counted eight labels that start an exhbt and seven names for the place it goes. From now on:

| The thing | The word |
|---|---|
| Starting an exhbt, anywhere | "Add an exhbt" ("Add as an exhbt" on a roadmap idea; "Add an exhbt to your portfolio" as that page's heading) |
| The place | "your portfolio" |
| `name.exhbt.co.uk` | "your address" |
| One exhbt's own address | "its link" |
| The editor's publish step | "Review and publish", as decision 0026 has it |
| The roadmap | "Build your roadmap" |
| The hero's button | "Start your portfolio" once the portfolio is where people land; until then it stays as it is (question 5, with Alex) |

**The home page tells one story, in seven beats.** Each beat has a headline, one line, and a proof that is a real page drawn by the product's own components, never a drawing of one.

| | Headline | Line | Proof |
|---|---|---|---|
| 1 | A website of your own, built from your projects. | For students and graduates: each project becomes an exhbt, a short page an employer reads in a minute and can check. | The real portfolio, in the first screen at both widths |
| 2 | One project, one page. | The question, how you did it, what you found, the file behind it. | The example exhbt, held beside its parts as they are named |
| 3 | A CV says it. An exhbt shows it. | A CV or a LinkedIn line names the skill. An exhbt is the report's one-minute version, with the PDF a click behind. | One CV line beside that exhbt's graph |
| 4 | Start with the file you already have. | We draft from your files and nothing else; you check every word. | The steps as real screens |
| 5 | An address that's yours. | One link for your CV, LinkedIn and email signature. | Type a name: the address and the page take it, marked as a preview |
| 6 | Not sure what to make? Build your roadmap. | Free, no account: what the job asks for, where you stand, projects that close the gaps. | The radar beside the job field |
| 7 | Free to start. Pay to put it online. | The plans, the questions, and the hero's button again. | The plan cards |

"What you get" goes, since the beats say it. Job links become one line under the plan that has them. The beats must not be laid out as words and a picture swapping sides five times running: `DESIGN.md` bans three or more such sections in a row.

**How clarity is checked.** A cold read: an agent that has seen neither the code nor this record is given screenshots of each screen on the new person's path and asked what the screen is for, what to press and what will happen. A wrong answer is a failed check. The label table is held by a search of the app's strings, in the plan.

## What gives Exhbt its character on top of Astryx

Astryx untouched would make the site more neutral, not less: under today's theme its page heading draws at 28px, its largest display step at 48px in a regular weight, and its selection ring is blue. The appeal review's reading is that the character already exists in the wrong place, in the eight looks and the editor, while the brand's own pages are timid. For a 21-year-old making something an employer will judge, flair means confidence: their work shown large, one loud line of type, mint spent only where it means something, motion that confirms what just happened, and a finish that feels like an event.

Six things carry it. The first three are rules that hold on every screen; the last three are moments. Each has a test.

### 1. One loud line

- **A person sees** one line on each screen that is plainly the loudest thing there, in Bricolage Grotesque at weight 600: the promise on Home, the heading of "Add an exhbt", the address at the moment it is claimed or shared. Settings screens keep a plain page heading and nothing larger. Their address, `name.exhbt.co.uk`, is always set as display type, with the name in mint on ink or jade on white, drawn by one component wherever it appears.
- **Built with** the theme's three display steps (`--text-display-1` to `-3`, size, weight and line height, plus tracking on `heading`'s `type:display-*`), which only Astryx's `Heading` and `Text` read, so no visitor's page moves. The lab's proposed theme has the values: 61, 49 and 39px, and 48, 40 and 33px on a phone. Home's opening line keeps its own larger fluid step. One new component draws the address.
- **Cost:** no script, no library. **Reduced motion:** nothing moves.
- **Tested by** a spec that, on each listed screen, finds no text larger than the one display line or page heading, and by the address component's own test (the name part, the host from `lib/hosts.ts`, AA contrast on both grounds).

### 2. Only the work is raised

The brand treats an exhbt as a museum treats an object: framed, labelled and checked (`docs/brand.md`). A museum frames the object, not the wall.

- **A person sees** forms, settings and lists lying flat on one ground. The only things in the page's flow with a shadow or a frame are pictures of real work: a real page in a browser frame, a tile, a section lifted in a drag. Every screen that sells, is empty, or marks a finish shows a real page: theirs if they have one, the made-up demo person's if not.
- **Built with** `BrowserFrame` and `Preview` (they exist), Astryx surfaces at `elevation="none"`, and the pack shadow kept for pictures of work. Menus, dialogs, sheets and toasts float with Astryx's own elevation: that is stacking, not decoration.
- **Cost:** none. **Reduced motion:** nothing moves.
- **Tested by** a check script that fails when the pack shadow or a raised `elevation` appears outside a short list of files (33 files use the pack shadow today, form cards among them), and by a spec that finds a framed real page on each listed screen.

### 3. Mint means go, live and checked

- **A person sees** one mint button on a screen, and it is always the next step. The word Live, the ticks and "checked" are mint and jade. Nothing else is: chrome is ink and white. Delete, Unpublish and Remove sit in a menu and ask first, so four pink pills never outshout the one mint button again.
- **Built with** the Button's variants (they exist), Astryx `MoreMenu` with `AlertDialog`, `StatusDot` and `Token`.
- **Cost:** none. **Reduced motion:** nothing moves.
- **Tested by** a spec that counts, on each listed screen at rest, at most one visible primary button and no destructive button outside a menu or a dialog. "Add an exhbt" is the one named exception: its two ways to start are equal cards, and the button under the pointer or the keyboard turns mint.

### 4. "It's live"

Publishing is the product's biggest moment and today it is three lines in a blank drawer, ending on four equal buttons and a way back to a list.

- **A person sees,** after a first publish on a plan with an address: their tile turn from Draft to Live where it sits, the logo's brackets closing on it as the tick fills; then a panel with the link as LinkedIn or WhatsApp will show it (the real preview picture), the address in display type, "Copy link" in mint, "View it", and one next step: "Add your next exhbt", or the next idea from their roadmap if they still have one. About a second, once, never looping. On Free the exhbt stays a private draft, so the panel shows their own page with the draft on it, says it is saved and only they can see it, offers the upgrade, and never says "live".
- **Built with** one new component used in both places a publish can end: the exhbt editor's publish sheet and the portfolio's `?at=` landing. Astryx `Dialog` on a wide window and `BottomSheet` (`height="hug"`) on a phone, `Toast` for "Link copied", and Astryx's entry and animator hooks on the theme's motion tokens. The picture is the existing `preview.png` route. The panel is drawn outside `[data-portfolio-home]`, which the parity gate protects.
- **Cost:** no new dependency. The creative review measured Astryx's animation hooks at about 15 kB gzipped on their own; that figure has not been re-measured.
- **Reduced motion:** everything appears at once. One polite status line says "<title> is live at <address>".
- **Tested by** a spec: on a paid plan with an address, the panel holds the address, a picture whose source is that exhbt's `preview.png`, and exactly one primary button, which copies the link and says so; on Free no text on it matches "live"; with reduced motion `document.getAnimations()` is empty; axe passes; focus goes back where it came from.

### 5. An exhbt assembles itself

- **A person sees,** on Home, the example exhbt build in reading order as it scrolls into view: the highlighter stroke draws under the gap in the question, the flowchart's boxes arrive one by one and the last turns ink, the graph's line runs from before to after, the ticks fill. It explains what an exhbt is without a word.
- **Built with** CSS alone: one named view timeline on the picture's frame, attached from Home's wrapper to hooks the page already has (`.xp-mark`, `.xp-flow-box`, `[data-part]`, `.xp-tick`), on Astryx's easing tokens. `ProjectView` and its golden copies are not touched. Every rule sits inside `@supports` and `prefers-reduced-motion: no-preference`, and the resting style is the finished picture.
- **Cost:** no script at all. Nothing runs unless the page is scrolling.
- **Reduced motion, and a browser without scroll timelines:** the finished picture, as now. Which browsers have them was read from search summaries and not checked; the design does not depend on the answer.
- **Tested by** a spec: with reduced motion the picture is complete and no animation exists; the home page's parity targets still pass; axe passes.
- **Needs** the Motion rule changed (question 2).

### 6. The address becomes yours

- **A person sees** one field on Home: "Your name". As they type "Priya Shah" the address in display type becomes `priya-shah.exhbt.co.uk` and the example portfolio carries their name. Then, as they scroll, that same page changes look eight times while its words stay put, each look's name set large in its own face. In the product, choosing a look cross-fades their whole page.
- **Built with** React state and `LookPreview`, which already draws the real `PortfolioHome` in the browser; Astryx `Field`, `TextInput` and `Button`; the name held to `USERNAME_RE` in `lib/hosts.ts`. The looks use `position: sticky`, one `IntersectionObserver` and the browser's view transitions where it has them. No smooth-scroll library and no scroll-jacking.
- **Cost:** no library.
- **Honest by construction:** it is marked as a preview, nothing is sent until they submit, and nothing says the address is free until it has been checked.
- **Reduced motion:** the name field moves nothing, and a polite live region reads the address. The looks are not pinned and do not cross-fade; the radio group stays the control, and a pressed radio always wins over the scroll position, because the parity spec presses each one.
- **Tested by** a spec: typing a name gives the address `portfolioHost` would give; characters the rule refuses are dropped; the radios work by keyboard; the home page's parity targets pass.

**Small motions, not counted among the six.** Once the theme sets motion, Astryx's menus, dialogs and sheets ease in and out by themselves and rest under Reduce Motion. Two more are allowed if Rory picks a level that has them: the hero's highlighter stroke drawn once on load, and the radar's outline traced once when a roadmap first opens (which needs decision 0023 amended: see "Not decided").

**Three levels, for the mock-ups.** Restrained: the three rules, "It's live", the assembling exhbt and the small motions. Confident: add "The address becomes yours". Maximal: add a tile that opens into its exhbt on the public pages, and "How it works" as a film the scroll scrubs. The maximal tile can be mocked but not built before launch: it changes markup the parity gate compares, the protected-paths check fails any change under `app/(portfolio)/`, and the creative review found that the framework's page transitions would move the whole app to an experimental build of React.

**The lab and this record must agree before Rory chooses.** The main session's design lab (`/lab/design`, on the `phase-2-design-lab` branch) draws four screens (Home, Finish, App and Kit) at three levels on a proposed theme, `themes/exhbt-next/`. Its level notes describe a level by type size and motion in general, and put scroll-led pages at maximal only. The levels above are the creative review's, by which moments are built, and put the assembling exhbt at restrained. One of the two has to change.

**Turned down as tasteless or slow here:** a WebGL or shader hero, animated mascots, reveal-on-scroll on public pages (employers skim, and Save as PDF must print everything), smooth-scroll libraries, confetti, custom cursors, parallax text, anything that loops, a headline that fades in, and an animation library where CSS will do.

## Drawing people in and keeping them going

**Two numbers judge all of it.** N1 is the share of accounts that publish a first exhbt; N2 the share that publish a second. No event records a publish today, so both come from `exhbts.published_at` until one does.

The strongest pull is already built: the roadmap and the radar come before the email is asked for, so a person gets something real before giving anything. The weak point is the middle: nothing marks the first publish, the owner never learns that anyone looked, and on Free there is nothing to publish to.

The methods chosen, each as a job with its mark. **MUST** is on the new person's path and ships by 2 Dec; **AIM** ships by then if nothing slips; **AFTER** waits, with the reason.

| Job | The method behind it | What is built | Mark |
|---|---|---|---|
| **First run** | A head start makes people carry on, and an empty slot asks to be filled | Sign-up lands on their own page with the name filled in from the roadmap (0031); the strip shows the account step already ticked, which is true; the best-work band is drawn full size saying "Your best project goes here" | MUST |
| **Progress** | People keep going when they can see real progress, and stop trusting it when it is invented | The strip's ticks come from data and it goes when done; after that the bar's chip and its one main button name the next step. A count such as "2 of 4 gaps shown" is allowed because it is real | MUST for the strip; AFTER for a checklist past the first exhbt |
| **The finished moment** | People judge an experience by its peak and its end | "It's live" (the fourth of the six), with one next step a press away | MUST |
| **Sharing** | A link people put in their profile brings the next person | At the finish: the link's real preview, Copy link, then "where to put it" (an application, your CV, LinkedIn under Featured, your email signature) and a Share on LinkedIn button that uses LinkedIn's share address, with no API | MUST for the preview and Copy; AIM for the rest |
| **Emails** | One useful message at the right moment, and no others | One email at a first publish, with the link. A reminder three days after a draft nobody published, a weekly "opened N times" only when N is at least one, and a note on the day a person chose to finish a project all need a scheduler and a consent check | AIM for the first; AFTER for the others |
| **A true reason to return** | People come back to see that real people reacted | The owner's bar says how often their page was opened, in views and never "people", leaving out their own visits, shown only above zero and never rounded up. It needs a new `Store` method on both implementations | AFTER |
| **Measuring** | None of this is known to work here until it is counted | An `exhbt_published` event (which publish it was, and whether it came from a roadmap idea), and N1 and N2 on the admin page | AIM |

Two findings are plan decisions, not design jobs, and go to Rory as questions 3 and 4: a Free account cannot publish at all, which caps both numbers whatever the design does; and after a downgrade, links a person has already sent stop working.

**Tactics refused, and why.**
- **False urgency or scarcity** (countdowns, "offer ends", "3 left"). The house rule is no claim before it is true. The momentum review also reads UK consumer law as banning a false "limited time" claim outright; that reading has not been checked by a lawyer, and the tactic is refused on the house rule alone.
- **Streaks and loss-framed nudges** ("Don't break your streak"). An exhbt is made a few times a term and a job search is lumpy, so a streak punishes exam weeks, and guilt reads as spam to the university staff who recommend Exhbt.
- **Invented or inflated social proof** ("12 recruiters viewed you", a rounded-up count, "people" when only views are stored). `DESIGN.md` bans fabricated figures, and an employer who sees through one stops trusting every exhbt.
- **Hiding the way out.** Unsubscribe, cancel and delete each stay one press away.
- **Taking back what people rely on,** used as a lever. That is question 4: fix it rather than lean on it.
- **Exit pop-ups, and any message sent when nothing true has happened.**

**On the sources.** The reviews name the head-start finding (Nunes and Drèze's loyalty-card study), the peak-and-end rule, Duolingo moving sign-up later, and research on plans that name a day. Several of the pages could not be opened from the build machine, so figures were read from search summaries or memory. None is quoted here, and nothing in this record depends on one: each method is kept because it is honest and cheap, and N1 and N2 will say whether it works for Exhbt.

## What DESIGN.md says as each part lands

`DESIGN.md` is not edited by this record. Each line below is pasted in by the job that makes it true, never before, so a reviewer always judges the site against what it is.

- **Motion** (replaces the section, when the first scroll-led moment ships; question 2): "Three kinds of surface. **Marketing pages** may have one scroll-led picture each, on Astryx's easing tokens, with the finished picture as the resting style. **The app and the editors** move only to confirm what a person just did: Astryx's own entrances for menus, dialogs, sheets and toasts, a tile turning Live, a progress fill. **A person's public pages** move only on navigation. Nothing loops, nothing blocks the next action, and under `prefers-reduced-motion` everything rests. Timings and curves come from the theme (`motion` in `themes/exhbt/exhbtTheme.ts`), never from a literal."
- **Shape and depth** (when the theme lands): "Buttons, tags and the start form are pills. Every other corner comes from Astryx's radius tokens: `--radius-element` for a control, `--radius-container` for a surface. In the page's flow only a picture of real work has a shadow (decision 0033, the second of the six); menus, dialogs, sheets and toasts take Astryx's own elevation. Cards are otherwise flat with a `line` edge. One content width on marketing pages, one on app pages."
- **Mode by surface**, the Operate line (when the page frame lands): "Roadmap builder and result, the portfolio, add an exhbt, account, admin: **Operate**. Flat on one ground and one content line; rows for lists; a card only for a thing that stands alone."
- **Colour**, one rule added (when the finish lands): "A finish may use ink for the address, on any page."
- **Focus** (when the theme lands): "3px jade outline, set once through Astryx's focus tokens, with the white gap and ink halo on the site's own elements."
- **Design system (Astryx)**, "What is on Astryx today": rewritten by each phase of `docs/design/appeal-plan.md` to list what has moved.

## Visitors' pages stay as they are

Nothing in this decision restyles a public page. They are the best-looking pages Exhbt has and they belong to the person. The rules of decision 0031 hold: nothing edits `app/(portfolio)/**`, `lib/portfolio.ts` or `lib/plan-rules.ts` (`npm run check:protected`), nobody regenerates a golden copy, and both parity specs run before a merge that could reach them. This record adds one thing the earlier ones did not need: the theme itself is treated as a file that reaches those pages.

## Not done, on purpose

- **Restyling the public pages or the eight looks.**
- **A dark mode for the app.** The theme stays light only.
- **Rebuilding the exhbt editor's drag engine, or the maths that places its corner toolbars.** Only what is drawn inside them moves to Astryx.
- **A big-bang swap.** Each surface moves whole, in one change, with its tests; no page is left half on each system.
- **Raising Astryx's version** before 2 Dec. `main` is on 0.7.11; a bump forces a theme rebuild and a fresh look at every themed component, so it is its own job afterwards.
- **Streaks, countdowns, counters or testimonials,** until real figures exist, and then only real ones.

## Not decided

Each has the default that applies if Rory says nothing. The first six are the questions on his page.

1. **Which level is mocked up and built:** restrained, confident or maximal. *Default: confident.*
2. **May a marketing page move as it scrolls?** `DESIGN.md` says nothing moves because the page scrolled; both founders liked scroll-led pages; Astryx's motion guidance covers menus and dialogs, not this. *Default: yes, on marketing pages only, one scroll-led picture a page, resting under Reduce Motion. The app and people's own pages do not change.*
3. **Should Free publish one exhbt at its own link,** with the "made with exhbt" line, as Canva and Linktree let a free page go out? *Default: no change. Free stays private, the page says so before anyone starts, and the finish shows them their page with the draft on it.*
4. **Should links already sent keep working after a downgrade?** *Default: no change before 2 Dec; decided straight after. Changing it means editing the two protected files that decide what visitors see.*
5. **The hero's button,** which is Alex's page (0031's question 9). *Default: "Start your portfolio", going to the portfolio, from the day the portfolio is on for everyone; "Build your exhbt" until then.*
6. **The "Worked on this with other people?" line** above the exhbt editor is the first thing a person reads when their first draft arrives. *Default: it moves into the editor's menu; a real request to join still shows as a notice.*
7. **The finish: a panel over the page, or a note docked at its foot.** *Default: a panel, as three of the reviews asked; the mock-up shows both.*
8. **The radar on the roadmap's first view, traced once.** Decision 0023 keeps it on Gaps and says nothing animates. *Default: it stays where it is until Rory has seen a mock-up.*
9. **Carrying the name typed on Home into sign-up.** Decision 0031 defines no way to pass one. *Default: not before 2 Dec; the field previews only.*
10. **The site's own header above the editors.** *Default: it stays, as 0031 says, and scrolls away on a phone so only the editor's bar sticks. The marketing footer goes from both editors.*
11. **The size of a page's own heading.** `phase-2-add-exhbt` sets Astryx's headings to the site's 48, 32 and 22px, so a page built from them reads like today's; the lab's proposed theme has 31, 25 and 20px under its display steps. Both cannot hold. *Default: today's sizes, until Rory has seen both in the lab.*

## Not sure, and risky

- **Nothing has been seen on a real iPhone.** Every phone screenshot came from a desktop browser pretending. Astryx's sheets, drawers and the phone keyboard are the parts most likely to differ.
- **Astryx is in beta.** A component can behave in a way its page does not say. Each job reads the component with the CLI and looks at it in the browser before building on it.
- **The shell changes the header on every page at once.** Seven spec files select the header, its Menu button or its `Main` navigation. If it is not green in time it is left out whole: a half-moved header is the "two systems" look this decision exists to avoid.
- **Astryx's `Banner` is not a live region by default.** Twelve spec files and every screen reader rely on `role="status"` or `role="alert"`; a swap that loses one is a regression nobody would see.
- **Two Opus agents run at once on a shared machine that has been running out of memory,** and the portfolio build already holds one of them. The plan says which job takes which place, and what goes first if it runs over.
- **The methods are known patterns, not measured ones.** Until `exhbt_published` exists there is no before to compare with.

Plan: `docs/design/appeal-plan.md`. Briefs: `docs/briefs/appeal/`. For Rory and Alex: `docs/design/for-rory-appeal.md`. Code this record names: `themes/exhbt/exhbtTheme.ts`, `app/layout.tsx`, `app/providers.tsx`, `components/ui/`, `components/site/`, `components/home/`, `components/exhbt-editor/` (chrome only), `components/portfolio-editor/` (from the portfolio-first build), `e2e/portfolio-parity.spec.ts`, `e2e/layout-parity.spec.ts`.
