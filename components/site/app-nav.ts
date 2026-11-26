import type { PortfolioKind } from "@/lib/portfolio-kind";

export type NavItem = { href: string; label: string };

/**
 * The signed-in nav (decision 0031, "The structure"). Account is the corner control, not a nav item, and job
 * links live on the portfolio page.
 * Phase 2 off: Roadmaps only, as there are no exhbts or portfolio yet.
 * "steps": Roadmaps (/roadmap), Your exhbts (/exhbts), Portfolio (/portfolio), as today.
 * "page": Your portfolio (/portfolio), Roadmaps (/roadmap).
 */
export function appNav(kind: PortfolioKind, phase2: boolean): NavItem[] {
  const roadmaps = { href: "/roadmap", label: "Roadmaps" };
  if (!phase2) return [roadmaps];
  if (kind === "page") return [{ href: "/portfolio", label: "Your portfolio" }, roadmaps];
  return [roadmaps, { href: "/exhbts", label: "Your exhbts" }, { href: "/portfolio", label: "Portfolio" }];
}
