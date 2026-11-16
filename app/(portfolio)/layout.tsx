/**
 * A person's public portfolio (alex.exhbt.co.uk, routed here by middleware.ts). No site header:
 * it's their page, not ours. Each page sets its own frame: the home page runs edge to edge in the
 * person's look (decision 0016); a project page sits in the framed column of `p/[username]/[slug]/layout.tsx`.
 */
export default function PortfolioLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-svh">{children}</div>;
}
