# Exhbt brand

The product is named after what it makes: an exhibit. The identity borrows from how a museum treats an object. Each piece is framed, labelled, numbered and checked. Everything below follows from that, so if you're unsure about a new use, ask whether a museum would do it.

## Colour and type
Brand kit v1 (9 Nov 2026). Mint `#4FE9B4`, jade `#00755D`, ink `#0E0F12` on a white canvas, with neutral greys. Bricolage Grotesque for display, Inter for everything else. The tokens, ratios and rules are in `DESIGN.md`. Rory's rule: the colours are fixed; the rest can be improved.

## Mark
The kit's **Frame** route: viewfinder brackets put one piece of work in focus, the way a hiring manager scans an exhbt. The dot is the evidence. (The kit also sketched a Stack route; Frame is the one in use because the kit's own in-use example shows it. Swapping is one component.)

- Source: `components/brand/Logo.tsx` (`<Mark />` and `<Logo />`). Favicon: `app/icon.svg`. Apple touch icon: `app/apple-icon.png`. Email: `public/brand/exhbt-mark.png`.
- Three colourways: a mint tile with ink brackets on white and on ink; on mint, `tone="on-mint"` flips it to an ink tile with mint brackets.
- Smallest size 16px as an icon. Clear space: the tile's corner radius on every side.
- Never stretch it, recolour it, add a shadow, or set mint on a mint background.
- The logo is still a sketch. Before paying for final artwork, run a UKIPO search for EXHBT and EXHIBIT in classes 9, 35, 41 and 42.

If the PNGs need regenerating after a change to the mark, render `app/icon.svg` at 96px (email, transparent) and 180px (Apple, on mint).

## Wordmark
`exhbt`, lower case, Bricolage Grotesque 600, tracking −0.04em, always to the right of the mark. Sizes: `sm` (footers and sign-offs), `md` (site header), `lg` (rare).

Lower case because it reads as a product and as the URL people will type. In sentences, the company is "Exhbt" and the pieces of work are "exhbts".

## Catalogue numbers
Every exhbt in a portfolio has a number like a museum accession number: `EX·01`, `EX·02`.

- Derived from its position in the owner's portfolio (`catalogueNo(position)` in `lib/exhbt.ts`). Never stored and never typed by hand.
- Inter with tabular numbers, semibold, ink. On a tile it sits top left; on a full exhbt it sits above the author line.
- Use them only for exhbts. Don't number marketing sections, features or steps with them; DESIGN.md still bans decorative numbering.
- On a job-specific link, the numbers follow that link's order.

## The seal
`components/brand/Seal.tsx`: the mark, "checked by exhbt" and the check date in a hairline pill.

- Wording is "checked", never "verified" or "certified". The checks confirm the author stands behind the work, the work is attached, and it passed an originality check. They don't confirm the results, and the employer guide says so.
- On the full exhbt the seal is a link to `/how-to-read-an-exhbt#checks`. On a tile it's plain (`asLink={false}`, `compact`), because the tile is already a link.
- The three mint ticks stay next to it on the full exhbt.

## Brand band
One coloured surface per portfolio page, at the top: `PortfolioHeader` on the portfolio, the slim `PortfolioBar` above a single exhbt. It is ink unless the person chose another look.

- Text on ink is white, or `#C9CBCF` for secondary text. Keep everything on the band at 7:1 or more.
- No other ink blocks on those pages apart from the site footer.

## Portfolio looks
A small library of band styles for different people (`lib/portfolio-themes.ts`, decision 0012). Each is a fixed combination of band colour, text colours, accent, heading face and photo shape.

- Colours are the kit's: ink, jade, mint, mist, wash, white, graphite. The one addition is **deep jade** `#00513F`, a darker jade used only as a band ground, where white text on it is 9.3:1.
- Heading faces: Bricolage Grotesque (the brand's own), Inter Tight, Space Grotesk, Fraunces. Body text stays Inter everywhere.
- Every text on a band reaches WCAG AA (4.5:1) at least. The ink and deep jade looks keep the 7:1 rule above; the jade and light looks are AA, with white on jade at 5.7:1. A test computes this for every look, so a new one can't land below it.
- The mint looks take ink text and an ink initials tile, never white on mint.
- Photo shapes: round, or a rounded square (the default).

## Sign-off
`components/brand/MadeWith.tsx`: "Portfolio made with exhbt · Build your own roadmap →", at the foot of every public portfolio and exhbt. Employers read these pages, and it's how the next student finds us. Keep it to one quiet line; no banners or pop-ups.
