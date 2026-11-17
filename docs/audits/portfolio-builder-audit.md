# Portfolio builder audit

16 Nov 2026, on `phase-2`. A new Max user walked from sign-in to a public page at 1440 × 900 and on a Pixel 7, using the dev sign-in and `/dev/plan`, then a seeded Max portfolio with three exhbts for the screens that need work in them. Screenshots were kept outside the repo (`audit-a/before-*.png`).

Rory's verdict was "clunky AF" and "it doesn't feel like theirs". Both hold up. The parts work; the trouble is that a person has to assemble a portfolio from four pages that don't know about each other, and the page they end up with is the same dark card for everyone.

## The flow, step by step

| Step | What happens now | What's wrong | Fix |
|---|---|---|---|
| Find the place to start | "Portfolio" in the nav goes to `/portfolio/customise`; settings live at `/account/portfolio`; exhbts at `/exhbts` | Three addresses for one job, and nothing says which comes first | One hub at `/portfolio`, a guided flow with four steps; the old addresses redirect into it |
| Username | A form with its own "Change username" button, above everything else | Asked before the person has seen what the address is for; a fourth save button on the page | Move it to the last step, "Publish and share", next to the link it makes |
| Photo | Upload button, then a spinner with no words while it uploads | Square crop from the middle with no say in it; no feedback on what's happening | Keep the browser crop; say "Uploading" in the button; show it in the preview at once |
| Name, headline, bio, LinkedIn | One form with a "Save profile" button | Typing and forgetting to press Save loses the change; nothing shows how it will look until the Look section further down | Autosave with a quiet "Saved", and a live preview of the whole page beside the fields |
| Look | 16 small band swatches with "Amara Okafor" in each (not your name), then "Save look" | The same picker exists a second time in the customiser, which autosaves; two ways to save the same setting. Swatches show a name tag, not a page | One picker, in step 2, each look drawn as a small page with the person's own name and photo; autosaves |
| Customise | A separate page with the looks again, two checkboxes, "Add a tile", then a long instruction paragraph and the grid | The preview is the editor, so on a laptop the first tile is two screens down; four extra tiles overlap the profile (About me repeats the bio, Links repeats LinkedIn) | Step 3 is a compact, sortable list of your exhbts with feature, hide and edit; the preview sits beside it |
| Publish | No step. Exhbts publish one by one in the editor; the portfolio is "live" when one is | Nobody is told what is live, what is hidden or what is still a draft | Step 4 lists what's live, hidden and in draft, with the address, a copy button and "View my portfolio" |
| Owner looks at their page before publishing | 404 | Reads as broken, and it's the moment someone most wants to see their page | Owner sees a preview with a note: "This is how your page will look. Publish your first exhbt and it goes live." Visitors still get not found |

## Screens that look wrong

- **Portfolio settings.** One long column, four save buttons, "View my portfolio" and "Customise portfolio" as twin secondary pills with no primary action. On a phone it is 4,000 px of form. The plan box ("Plan: Max, Public: Yes") is account detail, not portfolio detail.
- **Customiser.** The look strip is 17 identical chips reading "Aa"; the checkboxes ("Show the skills strip") describe page parts by their internal names. The instruction paragraph above the preview explains keyboard dragging in prose. The status bar is fine.
- **Public portfolio.** Everything about the person sits inside one rounded card the same as the project tiles, so the page reads as a grid of equal boxes. The skills chip band is the loudest thing after the name. The bio is a single line squashed beside the LinkedIn pill. There's nowhere to say where you are, what you're after or how to reach you except LinkedIn. The browser tab shows Exhbt's favicon.
- **Phone portfolio.** Fine structurally, but the band, the chip strip and the first tile take the whole first screen without anything that says who this person is beyond the name.
- **Editor.** The teammates banner sits above the page heading and pushes it down; "Live" floats at the far right, away from the title; the "Add" skill button looks disabled when it isn't. Section cards are clear. Preview is good.

## What would make it feel like theirs

The page is the same for everyone except the band colour. Things a person could bring that we don't take:

1. A cover picture across the top of the page (cropped to a wide strip in the browser).
2. Their intro, in their own words, leading the page in larger type, instead of a skills band.
3. Where they are, and what they're looking for, as plain lines under the name.
4. A contact block: LinkedIn, GitHub, a website, an email (as text).
5. Their name in the tab, and their initials as the tab icon, in their look's colours.
6. Help to write the intro from what they've already told us (the CV and roadmap), and only that.

Two through six are in the new flow. The cover picture was built and then dropped on 16 Nov (Alex: keep it simple), and the contact block became quiet links rather than a labelled block; decision 0016 has what was decided. Templates that change the whole layout (Classic, Notebook, Exhbt) are separate work; the page reads its colours and heading face from the theme's CSS variables so a template can replace them.
