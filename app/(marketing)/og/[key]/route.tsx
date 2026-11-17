import { MARKETING_HOST } from "@/lib/hosts";
import { marketingCard } from "@/lib/og/card";
import { MARKETING_PAGES, type MarketingKey } from "@/lib/seo";

/**
 * The link-preview image (Open Graph, 1200×630) for a marketing page: /og/<key>.png, one per entry
 * in MARKETING_PAGES. The words come from that table by key, never from the query string, so the
 * address can't be used to print anything on our brand. Drawn like the portfolio previews
 * (lib/og/card.tsx, bundled fonts), so it runs on the Worker the same way. Not under /api/, which
 * robots.txt disallows.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ key: string }> }) {
  const key = (await params).key.replace(/\.png$/, "");
  if (!Object.hasOwn(MARKETING_PAGES, key)) return new Response("Not found", { status: 404 });
  const { headline, sub } = MARKETING_PAGES[key as MarketingKey].card;
  return marketingCard({ host: MARKETING_HOST, headline, sub });
}
