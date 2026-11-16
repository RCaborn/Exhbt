Status: accepted
Date: 16 Nov 2026
Amends: 0012 (where the looks are picked), 0014 (where the customiser lives, which extra tiles are offered), 0015 (which section headings show)

# One guided portfolio builder, and a page that reads as the person's own

Rory, 16 Nov 2026: "The portfolio building part is clunky AF and the UI does not look good." And: "I want the website to feel deeply personal, in their portfolio. It needs to really feel like it's theirs." The audit behind this is `docs/audits/portfolio-builder-audit.md`.

Building a portfolio meant visiting three addresses (settings, the customiser, the exhbts list) with four save buttons between them, and the same look picker in two places with two ways of saving. The page itself was the same dark card for everyone, led by a chip band of skills.

## The builder

`/portfolio` is one flow in four steps, in this order, with the step in the URL (`?step=`):

1. **You**: name, photo, headline, a short intro in their own words, where they're based, what they're looking for, and how to reach them (LinkedIn, GitHub, a website, an email).
2. **Your look**: every look (decision 0012) drawn as a small page with the person's own name, photo and headline in it.
3. **Your projects**: the page's tiles as a list. Drag by the grip, feature one, hide one, open one in the editor, and add the extra tiles (decision 0014).
4. **Publish**: the address, what's live, hidden and in draft, the link to copy, and the search-engine setting.

A progress rail sits on top; Back and Continue at the foot of each step. A live preview of the whole page sits beside the steps on a wide screen and under them on a phone. Everything saves itself about half a second after a change, with one quiet status line ("Saved") and one Undo. The server checks every save again (`saveBuilderAction` in `app/(app)/portfolio/actions.ts`): the field limits and https rules (`lib/portfolio-profile.ts`), the arrangement rules from decision 0014, and the plan rules.

`/account/portfolio` and `/portfolio/customise` redirect into the builder, so each setting has one place.

## Feeling like theirs

- **The intro leads.** The bio became an intro of up to 60 words (it was 40), with paragraphs, set larger than the rest of the page and directly under the name. About me and Links and contact are no longer offered as extra tiles, since the intro and the contact lines do their job; a tile saved before still shows.
- **Photo and words top left**, with generous space between the name, the intro and the contact lines, and few labels: no "Based in" heading (a pin icon, and the words "Based in" for screen readers), "Looking for…" as a sentence, contact as short links. Rory and Alex, 16 Nov: far fewer labels, keep location, links and "looking for" only if subtle.
- **No cover picture.** It was built and taken out the same day (Alex: keep it simple).
- **Name first in the tab** ("Amara Okafor · Data analyst"), and the tab icon is their initials in their look's colours and photo shape (`initials.svg` beside the page, live pages only).
- **The skills strip is gone** from the top of the page; each tile still shows its skills. The stored switch (`layout.header.skills`) is kept and unused, so nothing is lost if it comes back.
- **"Suggest an intro"** drafts one from what the person has already given us: their newest roadmap's answers and CV, their exhbts' titles and skills, and the fields on screen (`lib/ai/portfolio-intro.ts`). The prompt allows only those facts and first person, plain British English, no hype words. It fills the field; nothing is saved until autosave keeps what they leave there. Ten a day per person, logged like every AI call.

The page's colours and heading face are read only from the look's CSS variables (`--band-*`, `--font-display`), and the top of the page is one component (`components/portfolio/PortfolioPage.tsx`), so layout templates can replace it later.

## The owner's empty page

At their own address, an owner with nothing live (no exhbt published, every exhbt hidden, or on Free) sees the page as it will look with a note saying why visitors can't see it yet and what to do. Everyone else still gets not found, and the preview is never indexed. Sign-in cookies stay on the app host, so this works where the app and the portfolio share an origin (`/p/<username>`); on a portfolio subdomain the owner gets not found like anyone else.

## An address is a paid feature

Rory and Alex, 16 Nov: Free accounts can't claim a username. `canClaimUsername` in `lib/plan-rules.ts` reads `publicPortfolio` from `lib/entitlements.ts`; the claim action and the live availability check both refuse, and the Publish step shows the upgrade offer instead of the form. A username someone already has stays theirs after a downgrade, and they can't change it until they're on a paid plan again.

## Fewer labels on an exhbt

The flowchart, the findings and a quote explain themselves on sight, so their headings ("Process", "Findings", "Feedback") are kept for screen readers and the page outline but not shown. "The question" and "What I'd do next" still show. Sections get a little more space between them. The catalogue number and the seal stay: employers use them (`docs/brand.md`).

## Small consistency fixes

- One tick everywhere (`components/ui/Tick.tsx`: an ink check on mint with an ink edge).
- Project tiles lifted with a jade edge on hover while job-link cards used ink and their own card. Job pages now use the portfolio tile, and every linked card uses `.card-link` (ink).

## Stored

Migration `20261121000000_portfolio_personal.sql`: `profiles.location`, `looking_for`, `github_url`, `website_url`, `contact_email` (nullable, length-checked), the bio's check raised to 700 characters, and `portfolio_intro` added to the AI call log's steps (every existing step kept). The account export selects the whole profile row, so it includes them. Row-level security is unchanged.

## Not decided here

Layout templates (Classic, Notebook, Exhbt) are separate work. Per-job pages keep their own header.
