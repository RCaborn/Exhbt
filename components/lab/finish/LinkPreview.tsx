/* eslint-disable @next/next/no-img-element -- the picture is drawn on request by a route (preview.png); next/image would only proxy it. */

/**
 * A link as it shows when it is pasted into LinkedIn, WhatsApp or an email: the link's preview
 * picture (the real one, drawn by lib/og/card.tsx), then the page's title, its description and its
 * host, which is what those apps print under the picture. Drawn plain, in no app's colours or marks.
 *
 * The title and description are the ones the exhbt page gives the apps (its generateMetadata,
 * app/(portfolio)/p/[username]/[slug]/page.tsx); the page passes them in.
 */
export function LinkPreview({ src, alt, title, description, host }: { src: string; alt: string; title: string; description: string; host: string }) {
  return (
    <figure className="fin-unfurl">
      <img src={src} alt={alt} width={1200} height={630} className="fin-unfurl-picture" />
      <figcaption className="fin-unfurl-words">
        <span className="fin-unfurl-title">{title}</span>
        {description && <span className="fin-unfurl-description">{description}</span>}
        <span className="fin-unfurl-host">{host}</span>
      </figcaption>
    </figure>
  );
}
