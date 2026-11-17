import { MethodFlow } from "@/components/exhbt/MethodFlow";
import { RichText } from "@/components/exhbt/RichText";
import { Figure, Findings, SectionBlock, type ImageUrls, type Sub } from "@/components/portfolio/exhbt-parts";
import { ImageZoom } from "@/components/portfolio/ImageZoom";
import type { ExhbtDoc, SectionOf } from "@/lib/exhbt/blocks";
import { shownSections } from "@/lib/exhbt/formats";
import { imageRatio, leadRatio } from "@/lib/exhbt/sections";

/**
 * The gallery's main column below the title and the brief (decision 0024): the pictures come
 * first. The page sets where each kind goes, so a gallery always reads the same way: the lead
 * image, "What I did" beside "What happened", the rest of the pictures in justified rows, then
 * feedback, what I'd do next and the links. The person's order only decides which image leads
 * (the first). Draws only the kinds the layout shows, and leaves out an image with no signed URL.
 *
 * No picture is cropped (object-fit: contain), none is lazy (Chrome prints unscrolled lazy
 * pictures blank), and the DOM order is the reading order and the tab order: no CSS columns, no
 * masonry, no `order`. Every colour, corner and rule is an --xp-* variable.
 */
export function GalleryMain({ doc, imageUrls, Sub }: { doc: ExhbtDoc; imageUrls: ImageUrls; Sub: Sub }) {
  const shown = shownSections(doc).map((x) => x.s);
  const images = shown.filter((s): s is SectionOf<"image"> => s.kind === "image" && Boolean(imageUrls[s.fileId]));
  const lead = images[0];
  const rest = images.slice(1);
  const findings = shown.find((s): s is SectionOf<"findings"> => s.kind === "findings");
  const graph = shown.find((s): s is SectionOf<"graph"> => s.kind === "graph");
  const quote = shown.find((s) => s.kind === "quote");
  const reflection = shown.find((s) => s.kind === "reflection");
  const links = shown.filter((s): s is SectionOf<"link"> => s.kind === "link");
  const hasHappened = Boolean(findings || graph);

  return (
    <>
      {lead && (
        <section aria-label="Lead image" data-part="lead" className="xp-section mt-3 @2xl/main:mt-8 print:mt-3">
          <figure className="xp-figure m-0 min-w-0 p-3 break-inside-avoid print:p-2">
            <div className="xp-lead" style={{ aspectRatio: leadRatio(lead) }}>
              <ImageZoom
                src={imageUrls[lead.fileId]!}
                alt={lead.alt}
                caption={lead.caption}
                w={lead.w}
                h={lead.h}
                priority
                className="h-full w-full cursor-zoom-in"
                imgClassName="h-full w-full object-contain"
              />
            </div>
            {lead.caption.length > 0 && (
              <figcaption className="xp-muted mt-2.5 px-1 text-sm leading-snug">
                <RichText value={lead.caption} />
              </figcaption>
            )}
          </figure>
        </section>
      )}

      <div className={`xp-section grid items-start gap-8 ${hasHappened ? "@2xl/main:grid-cols-2 print:grid-cols-2 print:gap-5" : ""}`}>
        <section aria-labelledby="did-h" data-part="did" className="min-w-0 break-inside-avoid">
          <Sub id="did-h" className="xp-found-heading xp-display border-b pb-3 text-[1.5rem] leading-tight print:pb-1.5 print:text-[1.25rem]">
            What I did
          </Sub>
          <div className="mt-4 print:mt-2">
            <MethodFlow steps={doc.flow} variant="page" stack={hasHappened} />
          </div>
        </section>
        {hasHappened && (
          <div data-part="happened" className="min-w-0 space-y-6 print:space-y-3">
            {findings && <Findings s={findings} Sub={Sub} heading="What happened" />}
            {graph && <Figure s={graph} imageUrls={imageUrls} />}
          </div>
        )}
      </div>

      {rest.length > 0 && (
        <ul role="list" aria-label="More images" data-part="grid" className="xp-grid">
          {rest.map((s) => (
            <li key={s.id} className="xp-tile" style={{ "--r": imageRatio(s) } as React.CSSProperties}>
              <figure className="m-0">
                <ImageZoom
                  src={imageUrls[s.fileId]!}
                  alt={s.alt}
                  caption={s.caption}
                  w={s.w}
                  h={s.h}
                  className="w-full cursor-zoom-in"
                  imgClassName="xp-tile-img"
                  imgStyle={{ aspectRatio: "var(--r)" }}
                />
                {s.caption.length > 0 && (
                  <figcaption className="xp-muted mt-1.5 text-[0.8125rem] leading-snug [overflow-wrap:anywhere] print:text-[0.75rem]">
                    <RichText value={s.caption} />
                  </figcaption>
                )}
              </figure>
            </li>
          ))}
        </ul>
      )}

      {quote && <SectionBlock s={quote} Sub={Sub} imageUrls={imageUrls} format="gallery" />}
      {reflection && <SectionBlock s={reflection} Sub={Sub} imageUrls={imageUrls} format="gallery" />}
      {links.length > 0 && (
        <div className={`xp-section grid gap-6 ${links.length > 1 ? "@2xl/main:grid-cols-2 print:grid-cols-2" : ""}`}>
          {links.map((s) => (
            <div key={s.id} className="min-w-0 [&>section]:mt-0">
              <SectionBlock s={s} Sub={Sub} imageUrls={imageUrls} format="gallery" />
            </div>
          ))}
        </div>
      )}
    </>
  );
}
