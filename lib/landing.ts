import type { PortfolioKind } from "./portfolio-kind";

/**
 * Where someone goes after signing in when no `next` says otherwise: safeNext's fallback (lib/auth.ts).
 * It reads no request: callers pass what they know (the kind from portfolioKindForEveryone(), and
 * isPhase2Enabled()). The landing follows what everyone gets, not an admin's own choice.
 *
 * "steps", or Phase 2 off: today's places (log-in "/roadmap", sign-up "/account", password "/account").
 * "page" with Phase 2 on: "/portfolio" for all three.
 */
export function landingAfterSignIn(how: "log-in" | "sign-up" | "password", kind: PortfolioKind, phase2: boolean): string {
  if (kind === "page" && phase2) return "/portfolio";
  return how === "log-in" ? "/roadmap" : "/account";
}
