# Phase 2 visual and UX audit

Date: 12 Nov 2026. Branch: `phase-2`. Dev server with the in-memory store and the mock AI draft.
Viewports: 1440×900 (scale 1) and Pixel 7 (412 wide, scale 2.625), full-page; spot checks at 375 wide.
Method: the `design:design-critique` and `design:accessibility-review` frameworks, judged against `DESIGN.md` and `docs/brand.md` (they win on any conflict), plus axe (WCAG 2.0/2.1 A and AA tags) on 42 page states and a keyboard pass through the editor.

Screenshots are not committed. They are in the session scratchpad:
`/tmp/claude-0/-home-user-Exhbt/8f68944d-9b6a-5167-8a40-0d82c10fe3df/scratchpad/audit/`
(file names are given beside each finding; `-desk` is 1440, `-mob` is Pixel 7). The editor's tab order is in `focus-order-editor.txt` in the same folder.

Out of scope by request: `middleware.ts`, `lib/hosts.ts`, `app/(portfolio)/layout.tsx` and host routing belong to the subdomain work. Anything that needs a change there is marked **for the subdomain work**.

## Verdict

Not yet. The bones are sound: the project page reads in about 30 seconds, the method flow and the dumbbell chart are clear, axe finds nothing, and nothing scrolls sideways on a phone. But the page a graduate would pay £9 a month for is plainer than the free demo on our own marketing site. `/demo` has the ink brand band, EX·01 catalogue numbers, the "checked" seal, a method strip and a big result number on every tile; the real `/p/<name>` has a mist page, an initials circle and four white cards with "Open project". An employer opening it would think "tidy", not "impressive", and the half-empty screen at 1440 makes a two-project portfolio look thin. The project page drops the headline number the tile promised, so the key result disappears on click. On the student side, the editor works but feels like a long form: the preview scrolls away, publish errors sit at the bottom of a 3,400px page, publishing ends with a small "It's live." and no link to share, and a signed-in user still sees "Log in" in the header with no way back to their exhbts. Fix the first six findings below and the product starts to look worth the money.

## Follow-up status

Ticked off after the audit (branch `phase-2-polish-2`):

- [x] **A5** The exhbts list (`/exhbts`) shows each exhbt's headline number and a "View" link to the public page for live ones (`app/(app)/exhbts/page.tsx`).
- [x] Image alt-text field in the editor is a growing textarea, so a long description is no longer cut off (`TextInput` with `multiline` in `components/editor/Editor.tsx`).
- [x] **A1** The header's signed-in links fit on a phone: below `sm` they sit behind a "Menu" button (`components/site/MobileNav.tsx`).
- [x] **J3 (part)** The project page shows one catalogue number, inside the card; the page bar no longer repeats it.
- [x] Profile photo: a Free user can upload, replace and remove it on Portfolio settings, and it shows on their previews (checked, covered by `e2e/phase2-polish-2.spec.ts`).

## Severity counts

| Severity | Count |
|---|---|
| Blocker | 2 |
| Major | 13 |
| Minor | 20 |
| Polish | 10 |
| **Total** | **45** |

## Top 10, in order

1. The public glance page is plainer than the free `/demo`: none of the brand band, catalogue numbers, seal or method strip (P1).
2. The project page never shows the headline number, so the key result vanishes when an employer clicks in (J1).
3. Free-plan states contradict each other: "4 of 1 used", exhbts marked "Live" while the portfolio 404s, an enabled "Publish changes" (E4).
4. The trust badge says "Confirmed by author" in the editor preview before the author has ticked the box (J2).
5. Signed in, the header still says "Log in" and "Build my roadmap", with no link to Your exhbts, Portfolio or Account (A1).
6. Publishing ends with a 16px "It's live." at the foot of the page: no "View it", no "Copy link", and the URL breaks mid-word (E3).
7. The editor preview is not sticky; after the first card it scrolls out of view (E1).
8. Publish blockers are listed only at the bottom and one has the wrong wording ("Keep the context to 40 words" on the question card) (E2).
9. Tiles without a headline number lose their anchor, and odd counts leave an orphan tile beside empty space (P2).
10. The AI drafting wait shows a bare spinner inside the button, with no label or time estimate (U1).

---

## Findings

Each finding: severity, page and state, what is wrong, why it matters, the fix and the files. Screenshots in brackets.

### Portfolio (glance): `/p/<name>`, `<name>.localhost`

**P1. Blocker. The real portfolio is a downgrade from the demo we show on the marketing site.**
[`01-glance-2-desk.png`, `01-glance-2-mob.png`, `05-glance-1-desk.png`, compare `42-demo-portfolio-desk.png`]
- What: `app/(portfolio)/p/[username]/page.tsx` draws its own header (84px initials circle, name, headline, bio, a 14px "LinkedIn" link) and its own tiles (headline number, title, context, four skill chips, "Open project →"). It does not use `PortfolioHeader` or `ExhbtTile`, so the page has no ink brand band, no `EX·01` catalogue numbers, no seal, no methodology strip and no "proven across N exhbts" skills row. `docs/brand.md` says the portfolio header is "the page's one ink surface" and every tile carries a catalogue number and seal; today only `/demo` does. At 1440 with two projects the content ends at y≈510 and the rest of the 900px viewport is empty mist.
- Why: this is the page employers see and the thing people pay for. The marketing site promises the demo; the product delivers something closer to a settings page. In the first 10 seconds the eye lands on a mint circle with "AO", not on a result.
- Fix: build the glance page from the brand components. Give `components/exhbt/PortfolioHeader.tsx` and `components/exhbt/ExhbtTile.tsx` a mapper from `ExhbtDoc` (title, context, headline, `flow` → methodology strip, skills) in `lib/portfolio.ts`, rather than a second set of tile markup. Feed the band from the profile: name, headline, bio, LinkedIn, the address chip. Hide the `studied` / `looking for` row until the profile has those fields (see "missing" below) rather than showing it empty. Use `catalogueNo(position)` and `<Seal asLink={false} compact />` on tiles. The band is designed to run full-bleed; the current layout wraps every portfolio page in a `max-w-[64rem]` mist container, so a full-bleed band needs a change to `app/(portfolio)/layout.tsx`: **for the subdomain work**. Until then, render the band as a rounded ink panel inside the container.

**P2. Major. Tiles with no headline number lose their anchor; odd counts leave an orphan.**
[`07-glance-3-longname-desk.png`]
- What: the third tile (headline cleared, which the editor allows: "optional") starts straight with a 18px title, so it reads as a lesser project. With three projects in `md:grid-cols-2`, the third sits alone with a 470px gap beside it. Tile heights also differ (232px vs 188px).
- Why: the number is what an employer scans. A tile without one looks unfinished, and the grid gap makes the portfolio look like it is missing something.
- Fix: in the tile, fall back to the first chart's change (e.g. "−25% under 30") or, failing that, the methodology strip in the number's place. For odd counts, let the first tile span both columns (`md:col-span-2` on index 0 when `items.length` is odd) or use a 3-column grid at `lg`. Files: `components/exhbt/ExhbtTile.tsx` (after P1), `app/(portfolio)/p/[username]/page.tsx`.

**P3. Minor. Headline numbers use Inter 800, which the type rules don't allow.**
[`01-glance-2-desk.png`]
- What: `text-[2rem] font-extrabold` on the tile number. `DESIGN.md`: Inter 400/500/600 only; display is Bricolage 600. `ExhbtTile.tsx` has the same `font-extrabold`.
- Why: the number is the hero of each tile; in the display face it would tie the portfolio to the brand and to the title type.
- Fix: set the number in the display face at 600 with tabular figures (`font-display` plus `tabular-nums`) in `ExhbtTile.tsx` and the glance page.

**P4. Minor. Mobile header spends 260px before the first project.**
[`01-glance-2-mob.png`]
- What: the 84px avatar stacks above the name, then headline, bio and LinkedIn; the first tile starts at about 260 CSS px.
- Why: on a phone the employer should see a result in the first screen.
- Fix: below `sm`, put a 56px avatar inline with the name and keep the bio to two lines. File: `app/(portfolio)/p/[username]/page.tsx` (or `PortfolioHeader.tsx` after P1).

**P5. Minor. LinkedIn is the only way to contact the person, and it is a 14px text link.**
[`01-glance-2-desk.png`]
- What: no email, no CV, no "Get in touch". LinkedIn has no icon and sits under the bio.
- Why: the employer's next step after "impressive" is to contact them.
- Fix: a contact row in the header (LinkedIn with icon, optional public email as a `mailto:`), from the profile. Files: `app/(app)/account/portfolio/ProfileForm.tsx`, `lib/store.ts` (both implementations), the glance page.

**P6. Polish. Each tile repeats "Open project →".**
[`01-glance-2-desk.png`]
- What: the whole card is the link, so the text label adds a line per tile. `/demo` uses a corner arrow instead.
- Fix: use the `ArrowUpRight` in the top corner, as `ExhbtTile` does.

**P7. Polish. "Projects" on the portfolio, "exhbts" everywhere else.**
- What: "All projects", "Open project", "1 of 2" on the public pages; "exhbts" in the app and the demo ("proven across 4 exhbts").
- Fix: pick one for employer-facing pages and keep it. "Projects" is clearer to an employer who has not heard of us; if so, change the demo band's "proven across N exhbts" to match.

### Portfolio (project): `/p/<name>/<slug>`

**J1. Blocker. The headline number is never shown on the project page.**
[`02-project-gp-desk.png`, `03-project-library-desk.png`, `08-project-edge-mob.png`]
- What: `components/portfolio/ProjectView.tsx` renders no `doc.headline`. The tile says "−18% missed appointments"; the page that opens says nothing of the kind until the chart, 600px down. On the library project (no chart) the "±6% forecast error" result appears nowhere on its own page. The editor preview has the same gap, so the student can't see where their headline goes (`20-editor-draft-desk.png`).
- Why: the key result is what the employer clicked for. The exhbt layout in `AGENTS.md` puts the outcome straight after the title.
- Fix: in `ProjectView.tsx`, render the headline under the title (display face 600, about 2.4rem, label beside it in graphite), before "the question". The editor preview then shows it for free.

**J2. Major. The trust badge claims "Confirmed by author" before the author has confirmed.**
[`25-editor-preview-mob.png`, `27-editor-scratch-desk.png`, `20-editor-draft-desk.png`]
- What: `components/exhbt/TrustBadge.tsx` always includes "Confirmed by author". The editor preview shows the tick on an empty "Start from scratch" doc and on an unconfirmed AI draft.
- Why: the badge is the product's trust promise. Showing a tick that hasn't been earned, even in a preview, teaches the student it means nothing, and the brand rules say the seal states only what the checks did.
- Fix: add a `confirmed` prop to `TrustBadge` (and `sourceAttached` already exists); pass it from `ProjectView` (public pages: true, since only confirmed exhbts publish; editor: the checkbox state, or show the tick hollow with "Not confirmed yet"). Files: `TrustBadge.tsx`, `ProjectView.tsx`, `components/editor/Editor.tsx`.

**J3. Major. No catalogue number and no seal on the project page.**
[`02-project-gp-desk.png`]
- What: the footer has the two ticks and a bare "12 Nov 2026" with no label. There is no `EX·01` above the author line and no "checked by exhbt" seal linking to `/how-to-read-an-exhbt#checks`, both required by `DESIGN.md` (Exhbt order, items 1 and 8) and `docs/brand.md`.
- Why: the seal and the guide link are how an employer learns what the ticks mean; a lone date reads as a typo.
- Fix: in `ProjectView.tsx` add `catalogueNo(position)` above the author (pass `position` from `app/(portfolio)/p/[username]/[slug]/page.tsx`), and replace the bare date with `<Seal />` from `components/brand/Seal.tsx` beside the ticks. Replace the "1 of 2" counter in the page nav with the catalogue number.

**J4. Minor. Section labels are tiny eyebrows.**
[`02-project-gp-desk.png`]
- What: "the question", "process", "findings" are `text-[0.7rem]` (11.2px) slate on white. That is under the 13px caption size in `DESIGN.md`, and lower-case labels above sections are what the "Banned: eyebrow labels" rule describes. Contrast is 4.82:1, so it passes AA, but only just at that size.
- Fix: make them real small headings: 13px, Inter 600, graphite, sentence case ("The question", "How", "What I found"), or drop them and let the content carry the order. File: `ProjectView.tsx` (`LABEL`).

**J5. Minor. On phones, six skills push the title down.**
[`08-project-edge-mob.png`]
- What: with six skills, three rows of chips sit between the author and the title, so the title starts about 230 CSS px down.
- Fix: below `sm`, put the skills after the title and context, or show four with "+2". File: `ProjectView.tsx`.

**J6. Minor. Footer layout with no link to the work.**
[`03-project-library-desk.png`]
- What: an empty `<span />` holds the left slot, so "Confirmed by author" floats alone at the right edge.
- Fix: when there is no evidence, left-align the badge. In the editor, nudge the student: "Add a link to the work so employers can check it" (the badge then gains "Source attached"). Files: `ProjectView.tsx`, `Editor.tsx`.

**J7. Polish. Previous/next leaves an empty half.**
[`02-project-gp-desk.png`, `03-project-library-desk.png`]
- What: with only a "Next", the card sits in the right column and the left is blank; on mobile it is right-aligned text.
- Fix: when only one exists, let it span both columns, left-aligned on mobile. File: `app/(portfolio)/p/[username]/[slug]/page.tsx`.

**J8. Polish. The chart is cramped on phones.**
[`02-project-gp-mob.png`]
- What: on a 412px screen the plot area is about 190px; "6.5% ●–● 7.9%" nearly touch.
- Fix: below 28rem container width, put the row label on its own line above the track so the track takes the full width. File: `components/exhbt/BeforeAfterChart.tsx`.

### Editor: `/exhbts/<id>/edit`

**E1. Major. The live preview scrolls away.**
[`20-editor-draft-desk.png`, `26-editor-published-desk.png`]
- What: the preview column is about 590px tall in a 3,400px page and is not sticky. Editing Findings, Graphs or The work, the preview is off screen.
- Why: the side-by-side preview is the editor's main promise ("see what employers see").
- Fix: in `Editor.tsx`, the preview `<section>`: `lg:sticky lg:top-6 lg:self-start lg:max-h-[calc(100svh-3rem)] lg:overflow-y-auto`. Optionally scroll the preview to the block whose card has focus.

**E2. Major. Publish blockers sit at the bottom, and one is worded wrongly.**
[`22-editor-over-limit-desk.png`, `23-editor-publish-blocked-desk.png`]
- What: the over-limit question card shows "Keep the context to 40 words." The card is called "The question" and there is a separate "Context line" field, so the message points at the wrong thing (`lib/exhbt/blocks.ts`, line 171). On publish, the reasons appear as red text under the button, 2,800px below the card at fault, with no links. The status line at the top shows "105 words" but not "1 thing to fix".
- Why: the student has to hunt for what is wrong, on a page they may already find long.
- Fix: change the message to "Keep the question to 40 words." in `validateForPublish`. In `Editor.tsx`, make each publish reason a link to its card (`#card-gap` etc.), add "N things to fix" to the top status row as a link to the first one, and mark over-limit cards with an error edge.

**E3. Major. Publishing has no payoff and no next step.**
[`26-editor-published-desk.png`]
- What: success is "It's live." in body text under the button. The live link above it uses `break-all`, so it splits "practic / es". There is no "View it", "Copy link" or "Back to your exhbts".
- Why: this is the moment the student has paid for. They should leave it with a link they can paste into an application.
- Fix: in `Editor.tsx`, replace the success line with a small panel: the full address (`break-words`, truncated in the middle if long), a primary "View it live" button, a secondary "Copy link", and "Back to your exhbts". Announce it through the existing `role="status"`.

**E4. Major. Free plan: the screens contradict each other.**
[`30-free-exhbts-list-desk.png`, `31-free-editor-desk.png`, `35-free-glance-desk.png`, `33-free-billing-desk.png`]
- What: after moving to Free, `/exhbts` says "4 of 1 used on Free" and labels three exhbts "Live", while `/p/amara` is "Page not found". The editor shows the "Live" chip, "Live at /p/amara/…", "Publishing to your own link comes with Premium", and an enabled "Publish changes" button, all at once. `docs/phase-2.md` section 7 says Free users see the portfolio as a preview with "Publish with Premium"; that preview does not exist.
- Why: a Free user can't tell what an employer sees, and a downgraded user is told their work is live when it is not. Both undermine trust right where we want an upgrade.
- Fix: in `app/(app)/exhbts/page.tsx` and `Editor.tsx`, derive the chip from plan and status: "Live", "Draft", or "Not public on Free". Replace "4 of 1 used" with "4 exhbts · Free keeps 1 · Upgrade". When the plan can't publish, disable Publish and make "Publish with Premium" the primary action. Add an owner preview of the glance page on the app host (the `/portfolio` page in `docs/phase-2.md` section 7) so Free users can see it; how it is routed is **for the subdomain work**, the page content is not.

**E5. Major. Flowchart boxes have a weak focus indicator and don't look editable.**
[`21-editor-focus-richtext-desk.png`, `focus-order-editor.txt`]
- What: the step and detail `<textarea>`s compute `outline: none`; focus only turns the box's 1px border jade. `DESIGN.md` sets a 3px jade ring for focus. At rest they are plain bold text with no field edge, so "Type in the boxes" is the only cue.
- Why: WCAG 2.4.7 (focus visible) at best borderline; keyboard users lose their place in a column of identical boxes.
- Fix: in `components/editor/FlowEditor.tsx`, give the box `focus-within:` the same ring as `:focus-visible` in `globals.css` (3px jade with white gap), and give the textareas a dashed underline or field-like hover state.

**E6. Minor. Six formatting toolbars on one screen.**
[`20-editor-draft-desk.png`]
- What: every rich-text field (question, each finding, each caption) has its own B / I / link row of 40×36 buttons, always visible.
- Fix: show the toolbar only while that field has focus (keep it in the tab order then), in `components/editor/RichTextField.tsx`. This also removes 9+ tab stops from the page.

**E7. Minor. Small hit areas across the editor.**
[`focus-order-editor.txt`]
- What: 32 buttons are under 44px tall: 40×36 for bold/italic/link, move, remove and "+" in the flowchart; 38×36 for "Remove skill". They pass WCAG 2.2 AA (24px) but miss the 44px target in our accessibility checklist, and on a phone the arrow and × buttons sit 4px apart (`24-editor-draft-mob.png`).
- Fix: `size="sm"` buttons at 44px min on touch (`@media (pointer: coarse)`), or more gap between them. Files: `components/ui/Button.tsx` / `themes/exhbt/exhbtTheme.ts` (then `npm run theme`), `FlowEditor.tsx`, `SkillsInput.tsx`.

**E8. Minor. Disabled flowchart buttons on the ink box look pressed.**
[`20-editor-draft-desk.png`]
- What: in the last (ink) box the disabled "later" and "remove" buttons are solid mid-grey discs, darker and heavier than the enabled white one.
- Fix: on ink, disabled buttons as a faint white outline at 30% with no fill. File: `FlowEditor.tsx`.

**E9. Minor. Mobile: the Edit/Preview switch is only at the top.**
[`24-editor-draft-mob.png`, `25-editor-preview-mob.png`]
- What: the page is 3,970 CSS px tall on a phone; to check the preview from Findings you scroll all the way up.
- Fix: make the Edit / Preview pair and the word count a sticky bar at the top below `lg`. File: `Editor.tsx`.

**E10. Minor. The editor's edges don't line up with the header.**
[`20-editor-draft-desk.png`]
- What: the editor uses `max-w-[90rem]`, so at 1440 its left edge is at 32px while the logo is at 128px (`max-w-[78rem]` in `SiteHeader`).
- Fix: use `max-w-[78rem]` for the editor, or widen the header on app pages to match. File: `Editor.tsx`.

**E11. Minor. Delete is placed beside Publish.**
[`20-editor-draft-desk.png`, `13-exhbts-list-premium-desk.png`]
- What: the pink "Delete exhbt" pill sits in the Publish card; on `/exhbts` every row has a filled "Delete" the same size as "Edit". It is confirmed in two steps, so it is safe, but it is the loudest colour on the page after the mint button.
- Fix: in the editor, move it to a quiet text button at the foot of the page; on the list, put it behind a "More" menu or make it a text button. Files: `Editor.tsx`, `app/(app)/exhbts/page.tsx`.

**E12. Minor. The mock draft ignores the uploaded file.**
[`20-editor-draft-desk.png`]
- What: without an API key the draft is "Development preview: a placeholder draft", one "Placeholder skill", and finding 1 is the first line of the file. It names the env var to users.
- Why: development and preview runs (including Rory's click-through on the preview Worker if the key is missing) show an editor that looks broken, which makes it hard to judge the editor's design.
- Fix: make the mock in `lib/ai/exhbt-draft.ts` build a plausible draft from the text (first sentence as the question, the first numbers as findings, a three-step flow), still labelled as a mock.

**E13. Polish. An empty doc's preview is a set of empty boxes.**
[`27-editor-scratch-desk.png`]
- What: "Start from scratch" previews as "Your title", three empty boxes and two empty bullets.
- Fix: show the field placeholders in the preview in slate ("What you did, and what changed", "A short step") so it reads as a template. File: `Editor.tsx` (`previewDoc`).

**E14. Polish. Images and file attachments are visibly disabled.**
[`20-editor-draft-desk.png`]
- What: "Add an image" is greyed out with "Adding images arrives with file uploads", and The work says "Attaching a file arrives with file uploads."
- Fix: until uploads land, hide both controls rather than showing disabled ones to paying users. File: `Editor.tsx`. (The feature itself is in "missing things".)

### Upload and draft: `/exhbts/new`

**U1. Major. The drafting wait is a bare spinner.**
[`16-new-drafting-desk.png`]
- What: on submit, the button loses its label and shows only a spinner; the line beside it still reads "128 words to draft from". A real Haiku draft takes several seconds or more.
- Why: with no label or estimate, people click again, leave, or assume it failed; this is the first moment the product does its main trick.
- Fix: keep the label ("Drafting…"), replace the left line with "Drafting from 128 words. This usually takes under a minute." in the existing `aria-live` region, and show the indeterminate bar the roadmap building screen uses. File: `app/(app)/exhbts/new/DraftForm.tsx`.

**U2. Minor. The disabled "Draft my exhbt" button looks broken.**
[`14-new-empty-mob.png`, `15-new-file-added-desk.png`]
- What: pale mint with grey text, while "Add a file or a few sentences of notes to start" sits above it.
- Fix: keep the button at full colour and show the reason on press, or keep it disabled but put the hint directly under it, tied with `aria-describedby`. File: `DraftForm.tsx`.

**U3. Polish. The allowance line competes with the heading.**
[`14-new-empty-desk.png`]
- What: "8 of 8 AI drafts left · files up to 20 MB each" is bold 14px between the intro and the drop zone.
- Fix: regular weight, slate, moved under the drop zone with the file-type hint. File: `app/(app)/exhbts/new/page.tsx`.

### Account and billing: `/account`, `/account/portfolio`, `/account/billing`, `/exhbts`

**A1. Major. Signed-in users get the logged-out header.**
[`10-account-desk.png`, `13-exhbts-list-premium-desk.png`, `14-new-empty-mob.png`]
- What: `components/site/SiteHeader.tsx` is static: "For employers, Pricing, For universities", "Log in" and "Build my roadmap" on every app page, even when signed in. There is no link to Your exhbts, the portfolio or Account anywhere in the header or footer.
- Why: a paying user has no way around their own product, and "Log in" while logged in looks like a bug.
- Fix: give `SiteHeader` a signed-in variant from `app/(app)/layout.tsx` (read `getCurrentUser()` there): "Your exhbts", "Portfolio", "Account" (or an avatar menu), no "Log in". Keep the marketing variant on marketing pages.

**A2. Major. `/account` is a dead end.**
[`10-account-desk.png`, `10-account-mob.png`]
- What: the page lists "Portfolio settings" and "Billing" as text links, then Your data and Delete account. No link to Your exhbts, no portfolio address, no usage. The most coloured thing on the page is the pink "Delete my account".
- Fix: open with a summary card: plan, "2 of 4 exhbts live", the portfolio address with "View" and "Copy link", then links to exhbts, portfolio settings and billing. Data and delete stay below. File: `app/(app)/account/page.tsx`.

**A3. Minor. Billing shows an "Upgrade" section to someone already on Premium, and generic features.**
[`12-billing-premium-desk.png`]
- What: with Stripe off, a Premium user sees "Your plan: Premium" then "Upgrade: Payments aren't open yet". The feature list says "Up to 4 exhbts hosted on you.exhbt.co.uk" instead of their address and usage.
- Fix: personalise the list ("2 of 4 exhbts live on amara.exhbt.co.uk"); title the second section "Change plan" for paid users. File: `app/(app)/account/billing/page.tsx`. The address string comes from the existing helper; don't change `lib/hosts.ts` (subdomain work).

**A4. Minor. Portfolio settings: the address isn't a link and the photo is missing.**
[`11-account-portfolio-desk.png`]
- What: the summary card shows "Address amara.exhbt.co.uk" as plain text; "Your initials show until photos arrive."
- Fix: make the address a link with "Copy". Photo: see "missing things". File: `app/(app)/account/portfolio/page.tsx`.

**A5. Minor. The exhbts list doesn't show what employers see.**
[`13b-exhbts-list-3-desk.png`]
- What: rows have a status chip, the title as a link, "Updated" date and four buttons. No headline number, no live link per exhbt, no "View portfolio".
- Fix: add the headline number and, for live ones, a "View" link to the public page; a "View my portfolio" button by the page title. File: `app/(app)/exhbts/page.tsx`.

**A6. Polish. "Untitled exhbt" drafts from "Start from scratch" pile up.**
[`30-free-exhbts-list-desk.png`]
- What: every press of "Start from scratch" creates an exhbt that counts against the plan, even if left empty.
- Fix: don't count empty drafts towards the plan limit, or delete untouched ones on leaving. Files: `app/(app)/exhbts/[id]/actions.ts`, `lib/plan.ts`.

### Cross-cutting

**X1. Major. Two visual languages.**
[`40-home-desk.png`, `42-demo-portfolio-desk.png` vs `01-glance-2-desk.png`, `20-editor-draft-desk.png`]
- What: marketing and the demo use the ink band, catalogue numbers, the seal, the shadowed tiles; the app and the real portfolio use plain white cards on mist. The app pages are calm and consistent with each other, which is right for "Operate", but the public portfolio is a "Persuade" surface and is styled like the app.
- Fix: P1 and J3 cover the portfolio. For the app, reuse the same tile (`ExhbtTile`) in `/exhbts` rows or the account summary so students see their work the way employers will.

**X2. Major. No way to share.**
- What: across the account, the list, the editor and the portfolio there is no "Copy link" and no share target. The only place the full address appears is the settings card and, after publishing, as a relative path in dev.
- Fix: one `CopyLink` client component used on `/account`, `/account/portfolio`, `/exhbts` and the publish panel (E3).

**X3. Minor. The pre-launch banner shows on public portfolios.**
[`01-glance-2-desk.png`]
- What: "Private preview. Exhbt isn't public yet, so please don't share this link widely." from `app/layout.tsx` sits above the candidate's own page.
- Why: on launch day, an employer must never see "don't share this link" above a CV.
- Fix: make sure it goes at launch; hiding it on portfolio hosts before then is **for the subdomain work**.

**X4. Minor. Cards on mist barely separate.**
[`01-glance-2-desk.png`]
- What: white cards with a `line` edge on mist: the edge is 1.16:1 against mist and white is 1.07:1 against mist. On a dim laptop screen the tiles almost vanish into the page.
- Fix: on the public portfolio use the `shadow-pack` the demo tiles use (raised artifacts are allowed shadows in `DESIGN.md`). App pages can stay flat.

**X5. Minor. Mobile headers wrap badly.**
[`14-new-empty-mob.png`, `10-account-mob.png`]
- What: on a phone the nav moves to a second row and "Build my roadmap" disappears; for a signed-in user that row is all marketing links.
- Fix: part of A1: on app pages, the second row becomes the user's own nav.

**X6. Polish. Small grey type.**
- What: 0.7rem section labels (J4), 0.68rem step numbers and 0.72rem step details in `MethodFlow.tsx`, the 12px "1 of 2" counter. All pass contrast (slate 4.82:1 on white, 4.50:1 on mist), but sit under the 13px caption rule.
- Fix: a 13px floor for any text that carries meaning; step numbers can stay small as they are decorative (`aria-hidden`).

**X7. Polish. Ticks use mint fill with an ink edge in the badge but the green check icon elsewhere.**
[`12-billing-premium-desk.png`, `02-project-gp-desk.png`]
- What: same meaning, slightly different drawings (badge tick vs `FeatureList` tick).
- Fix: one tick component. Files: `components/exhbt/TrustBadge.tsx`, `components/site/FeatureList.tsx`.

### Accessibility summary

- axe (WCAG 2.0/2.1 A and AA): **0 violations** on 42 scans covering the glance (1, 2 and 3 projects, long name), three project pages, account, portfolio settings, billing (Premium and Free), the exhbts list, upload, and the editor (AI draft, scratch, published, Free), at both sizes. Results: `audit/axe.json`.
- No horizontal scroll at 375 on `/p/amara`, a project page, `/exhbts`, `/exhbts/new`; none at 412 on any page. (The 375 check of the editor and account pages did not run; at 412 they were fine.)
- Keyboard: the editor's tab order follows the visual order: skip link, header, back link, title, context, headline, skills, toolbar and question, flowchart (step, detail, move, add per box), findings, graph, the work, confirm box, Publish, Delete, footer. Problems: weak focus on flowchart boxes (E5); three toolbar stops before every rich-text field (E6); the move-earlier button for box 1 and move-later for the last box are disabled but skipped correctly.
- Contrast: body and secondary text pass (graphite 9.7:1 on mist; slate 4.82:1 on white, 4.50:1 on mist). Chart: mint dots are 1.54:1 on white, allowed because every value is printed and the hidden table carries the data. Card edges 1.16–1.25:1 (X4; non-text, decorative).
- Touch targets: see E7.

---

## Missing things a paying user would expect

- **Profile photo upload.** The layout puts the photo top left on every exhbt; initials make every portfolio look the same.
- **Link preview images (Open Graph).** There is no `opengraph-image` route. A portfolio pasted into LinkedIn, WhatsApp or an application form shows no card, which is where most shares will land. `docs/phase-2.md` section 7 plans one per exhbt.
- **Copy link / share.** The main job after publishing is pasting the link somewhere (X2).
- **Print / PDF of an exhbt and of the portfolio.** Some applications only accept attachments; a clean print stylesheet would cover most of it.
- **Owner preview and edit mode** (`/portfolio`, phase 2 section 7). Students can't see the glance page as employers do without visiting the public URL, and Free users can't see it at all.
- **Images in exhbts and file attachments as "the work".** Both are disabled in the editor; a design or engineering project without an image will look thin.
- **"Studied" and "Looking for" profile fields.** The demo band has them and they are what a recruiter filters on; the real profile has neither.
- **A contact route** (public email or "Get in touch"), beyond LinkedIn (P5).
- **Basic view counts for the owner.** Planned for Max job links; a simple count on the portfolio is the best evidence the £9 is working.
- **A downloadable CV link** next to LinkedIn, since the roadmap flow already holds a CV.

## Pages checked for consistency only

`/` and `/pricing` [`40-home-desk.png`, `40-home-mob.png`, `41-pricing-desk.png`, `41-pricing-mob.png`] and `/demo` [`42-demo-portfolio-desk.png`]: consistent with `DESIGN.md`. They set the bar the real portfolio should meet (P1, X1).
