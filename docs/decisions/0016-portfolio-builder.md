Status: accepted
Date: 16 Nov 2026
Amends: 0012 (where the looks are picked, a new default look), 0014 (where the customiser lives, what it arranges)
Amended by: 0018 (the look's variables are one set shared with the exhbt page; graphs take the look's shades); 0031 (the step builder gives way to the page itself, edited where it sits, when the switch is on)

# One guided portfolio builder, and a page that reads as the person's own

Rory, 16 Nov 2026: "The portfolio building part is clunky AF and the UI does not look good." And: "I want the website to feel deeply personal, in their portfolio. It needs to really feel like it's theirs." The audit behind this is `docs/audits/portfolio-builder-audit.md`.

Building a portfolio meant visiting three addresses (settings, the customiser, the exhbts list) with four save buttons between them, and the same look picker in two places with two ways of saving. The page itself was the same dark card for everyone, led by a chip band of skills.

## The builder

`/portfolio` is one flow in four steps, in this order, with the step in the URL (`?step=`):

1. **You**: name, photo, headline, a short intro in their own words, where they're based, what they're looking for, and how to reach them (LinkedIn, GitHub, a website, an email).
2. **Your look**: every look (decision 0012) drawn as a small page with the person's own name, photo and headline in it.
3. **Your page**: the exhbts as a list (drag by the grip, star one for the band, hide one, open one in the editor), then the page's sections: add one, write its words, take one off.
4. **Publish**: the address, what's live, hidden and in draft, the link to copy, and the search-engine setting.

A progress rail sits on top; Back and Continue at the foot of each step. A live preview of the whole page sits beside the steps on a wide screen and under them on a phone. Everything saves itself about half a second after a change, with one quiet status line ("Saved") and one Undo. The server checks every save again (`saveBuilderAction` in `app/(app)/portfolio/actions.ts`): the field limits and https rules (`lib/portfolio-profile.ts`), the arrangement rules from decision 0014, and the plan rules.

`/account/portfolio` and `/portfolio/customise` redirect into the builder, so each setting has one place.

## The home page: Rory's layout, arranged by the person

Rory's spec (`docs/design/portfolio-and-exhbt-layouts.pdf`, page 1) is the default arrangement and the default look:

- **Fixed at the top**: a bar with the address on the left and "Work", "About" and "Get in touch" on the right; then the hero, with the photo in a circle, "Hi, I'm", the name very large, and the intro in one paragraph. Where they are and what they're looking for sit quietly under it when filled in.
- **Sections below, in any order**: "My best piece of work" (the starred exhbt, or the first, in the look's band: a small label, the title, one sentence, "See how I did it" and "Source attached and checked", and its key figure in a card); "More of my work" (the others as cards: key figure on top, title, one sentence); "About me" (two or three sentences beside rows of education with years, and Tools); "Experience"; "A quote"; "Get in touch" (the links and email from the first step). The default is band, cards, About me, Get in touch.
- **Drag and drop**: the live preview is where the page is arranged. Each section has a grip and a remove button; drag with the mouse, a short press on touch, or Space, the arrow keys and Space; the steps are read out. Sections are added and their words written in the Your page step. Removing one can be undone.
- **No catalogue numbers and no headline figures on the home page.** A card's key figure is the exhbt's first graph, else its first image, else its process steps. Its sentence is the exhbt's own summary once the exhbt page adds one (`doc.summary`), else its first finding (`summaryOf` in `lib/portfolio-home.ts`).
- **Stored in the customiser's model** (decision 0014): `portfolio_layout.slots` now holds section keys (`featured`, `work`, `about`, `experience`, `quote`, `contact`); `tiles` keeps the words (About me reads `about` and `education`, which gains `tools`); the exhbts keep `exhbts.position`, `hidden_on_portfolio` and `featured_exhbt_id`. A layout saved by the old customiser reads as the default plus the experience or quote it had (`sectionsOf`). Experience and a quote come with extra tiles (`extraTiles`); after a downgrade they are held, not deleted.
- The skills strip is gone; its stored switch (`layout.header.skills`) is kept and unused.
- Phones: everything stacks, nothing scrolls sideways. The page lays itself out by its own width (container queries), so the preview column shows what a visitor at that width would see.

## Looks restyle the whole page

Every colour, corner and face on the home page is a CSS custom property set by the look (`themeStyle` in `components/portfolio/themeFonts.ts`), never a fixed brand class, so the coming layout templates can restyle everything, and the exhbt pages can read the same names:

| Variable | What it is | Exhbt look |
|---|---|---|
| `--font-display` | heading face | Bricolage Grotesque |
| `--pf-ground` | page ground | white |
| `--pf-ink`, `--pf-soft`, `--pf-faint` | text, secondary, captions | ink, graphite, slate |
| `--pf-line` | hairlines and card edges | line |
| `--pf-card`, `--pf-well` | card ground, the well a key figure sits in | white, mist |
| `--pf-button-bg`, `--pf-button-text` | the top bar's button | ink, white |
| `--pf-accent` | links on the ground | jade |
| `--pf-radius`, `--pf-radius-lg` | card and panel corners | 16px, 24px |
| `--band-bg`, `--band-text`, `--band-soft`, `--band-accent`, `--band-edge` | the one coloured surface (the best-work band; its button is band-text on band-bg) | wash, ink, graphite, jade |
| `--band-initials-bg`, `--band-initials-text` | the photo's stand-in | jade, white |

A look sets the page part with the optional `page` field in `lib/portfolio-themes.ts` (`PageLook`); without it the brand's white page applies. Two things on the page are not themed: graphs keep the brand's one-hue ramp (decision 0011), drawn on `--pf-card`, so a dark look must keep its cards light or give the graphs variables of their own; and the exhbt mark in the sign-off keeps its colours (`docs/brand.md`). The default look is a new first entry, **Exhbt** (Rory's spec: white page, wash band, Bricolage, round photo). It went in at the top of the list, so `portfolioThemes` for Premium went up by one to keep the same set; Free's one look is now Exhbt instead of Ink.

## Feeling like theirs

- **The intro leads.** The bio became an intro of up to 60 words (it was 40), with paragraphs, under "Hi, I'm" and the name.
- **Few labels**: a pin icon for where they are (the words "Based in" for screen readers), "Looking for…" as a sentence. Rory and Alex, 16 Nov: far fewer labels, keep location, links and "looking for" only if subtle.
- **No cover picture.** It was built and taken out the same day (Alex: keep it simple).
- **Name first in the tab** ("Amara Okafor · Data analyst"), and the tab icon is their initials in their look's colours and photo shape (`initials.svg` beside the page, live pages only).
- **"Suggest an intro"** drafts one from what the person has already given us: their newest roadmap's answers and CV, their exhbts' titles and skills, and the fields on screen (`lib/ai/portfolio-intro.ts`). The prompt allows only those facts and first person, plain British English, no hype words. It fills the field; nothing is saved until autosave keeps what they leave there. Ten a day per person, logged like every AI call.

## The owner's empty page

At their own address, an owner with nothing live (no exhbt published, every exhbt hidden, or on Free) sees the page as it will look with a note saying why visitors can't see it yet and what to do. Everyone else still gets not found, and the preview is never indexed. Sign-in cookies stay on the app host, so this works where the app and the portfolio share an origin (`/p/<username>`); on a portfolio subdomain the owner gets not found like anyone else.

## An address is a paid feature

Rory and Alex, 16 Nov: Free accounts can't claim a username. `canClaimUsername` in `lib/plan-rules.ts` reads `publicPortfolio` from `lib/entitlements.ts`; the claim action and the live availability check both refuse, and the Publish step shows the upgrade offer instead of the form. A username someone already has stays theirs after a downgrade, and they can't change it until they're on a paid plan again.

## Small consistency fixes

- One tick everywhere (`components/ui/Tick.tsx`: an ink check on mint with an ink edge).
- Project tiles lifted with a jade edge on hover while job-link cards used ink and their own card. Job pages now use the portfolio tile, and every linked card uses `.card-link` (ink).

## Stored

Migration `20261121000000_portfolio_personal.sql`: `profiles.location`, `looking_for`, `github_url`, `website_url`, `contact_email` (nullable, length-checked), the bio's check raised to 700 characters, and `portfolio_intro` added to the AI call log's steps (every existing step kept). The account export selects the whole profile row, so it includes them. Row-level security is unchanged.

## Not decided here

Layout templates (Classic, Notebook, Exhbt) are separate work. Per-job pages keep their own header.
