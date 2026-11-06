# Exhbt brand

The product is named after what it makes: an exhibit. The identity borrows from how a museum treats an object. Each piece is framed, labelled, numbered and checked. Everything below follows from that, so if you're unsure about a new use, ask whether a museum would do it.

## Mark
An exhibit frame, broken at the lower right by its label.

- Source: `components/brand/Logo.tsx` (`<Mark />` and `<Logo />`). Favicon: `app/icon.svg`. Apple touch icon: `app/apple-icon.png`. Email: `public/brand/exhbt-mark.png`.
- The frame uses `currentColor`: navy on white or light blue, white on navy. The label is always the light-blue token with a navy edge. On navy the edge disappears into the background, which is intended.
- Minimum size 14px. Below that the gap in the frame closes up.
- Clear space: at least half the mark's width on every side.
- Don't rotate it, recolour the label, add a shadow, or put it in a circle or tile.

If the PNGs need regenerating after a change to the mark, render `app/icon.svg` at 96px (email, transparent) and 180px (Apple, white background with 16% padding).

## Wordmark
`exhbt`, lower case, Schibsted Grotesk 800, tracking −0.045em, always to the right of the mark. Sizes: `sm` (footers and sign-offs), `md` (site header), `lg` (rare).

Lower case because it reads as a product and as the URL people will type. In sentences, the company is "Exhbt" and the pieces of work are "exhbts".

## Catalogue numbers
Every exhbt in a portfolio has a number like a museum accession number: `EX·01`, `EX·02`.

- Derived from its position in the owner's portfolio (`catalogueNo(position)` in `lib/exhbt.ts`). Never stored and never typed by hand.
- IBM Plex Mono, semibold, ink. On a tile it sits top left; on a full exhbt it sits above the author line.
- Use them only for exhbts. Don't number marketing sections, features or steps with them; DESIGN.md still bans decorative numbering.
- On a job-specific link, the numbers follow that link's order.

## The seal
`components/brand/Seal.tsx`: the mark, "checked by exhbt" and the check date in a hairline pill.

- Wording is "checked", never "verified" or "certified". The checks confirm the author stands behind the work, the work is attached, and it passed an originality check. They don't confirm the results, and the employer guide says so.
- On the full exhbt the seal is a link to `/how-to-read-an-exhbt#checks`. On a tile it's plain (`asLink={false}`, `compact`), because the tile is already a link.
- The three green ticks stay next to it on the full exhbt. Green is used for ticks only.

## Brand band
One navy surface per portfolio page, at the top: `PortfolioHeader` on the portfolio, the slim `PortfolioBar` above a single exhbt.

- Text on navy is white (about 14:1), `#c9d7e8` for secondary text, or the light-blue token for labels (both above 9:1). Keep everything on the band at 7:1 or more.
- No other navy blocks on those pages apart from the site footer.

## Sign-off
`components/brand/MadeWith.tsx`: "Portfolio made with exhbt · Build your own roadmap →", at the foot of every public portfolio and exhbt. Employers read these pages, and it's how the next student finds us. Keep it to one quiet line; no banners or pop-ups.
