import { serialiseJsonLd } from "@/lib/seo";

/** Structured data for search engines. The text is escaped by serialiseJsonLd, so it can't close the tag. */
export function JsonLd({ data }: { data: unknown }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serialiseJsonLd(data) }} />;
}
