import { safeHref, type RichText as RichTextValue } from "@/lib/exhbt/blocks";

/**
 * Renders the stored runs (bold, italic, links) as React elements. Never raw HTML, so
 * nothing a person types can inject markup. Links must be https, open in a new tab, and
 * carry rel="nofollow ugc" because they're user content.
 */
export function RichText({ value }: { value: RichTextValue }) {
  return (
    <>
      {value.map((r, i) => {
        let node: React.ReactNode = r.t;
        if (r.i) node = <em>{node}</em>;
        if (r.b) node = <strong className="font-semibold">{node}</strong>;
        const href = safeHref(r.href);
        if (href) {
          node = (
            <a href={href} rel="nofollow ugc noopener" target="_blank" className="link text-ink">
              {node}
            </a>
          );
        }
        return <span key={i}>{node}</span>;
      })}
    </>
  );
}
