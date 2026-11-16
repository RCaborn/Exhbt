import { loadPortfolio } from "@/lib/portfolio";
import { initialsOf } from "@/lib/portfolio-profile";

/**
 * The browser-tab icon of a portfolio: the person's initials on their look's initials colours, in
 * the look's photo shape (decision 0016). Like preview.png, a fixed address beside the page, so it
 * works on alex.exhbt.co.uk/initials.svg and /p/alex/initials.svg alike. Only for a live page: an
 * unpublished one keeps Exhbt's own icon.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ username: string }> }) {
  const p = await loadPortfolio((await params).username);
  if (p.status !== "ok" || p.items.length === 0) return new Response("Not found", { status: 404 });
  const letters = (initialsOf(p.displayName) || "?").replace(/[<>&"']/g, "");
  const { bg, text } = p.theme.initials;
  const radius = p.theme.photo === "round" ? 32 : 14;
  const size = letters.length > 1 ? 26 : 32;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64"><rect width="64" height="64" rx="${radius}" fill="${bg}"/><text x="32" y="33" dominant-baseline="central" text-anchor="middle" font-family="Inter, Arial, Helvetica, sans-serif" font-weight="700" font-size="${size}" fill="${text}">${letters}</text></svg>`;
  return new Response(svg, { headers: { "content-type": "image/svg+xml; charset=utf-8", "cache-control": "public, max-age=3600" } });
}
