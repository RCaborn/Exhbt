import type { PortfolioPerson } from "@/components/portfolio/PortfolioPage";
import { normaliseLinkedin } from "@/lib/cv-contact";
import { checkTiles } from "@/lib/portfolio-customise";
import { normaliseGithub, normaliseWebsite, tileKindsShownBy } from "@/lib/portfolio-layout";
import { profileProblems, type ProfileDraft } from "@/lib/portfolio-profile";
import type { BuilderState } from "./steps";

/*
 * What the step builder (Builder.tsx) and the one-page portfolio editor (components/portfolio-editor,
 * decision 0031) both work out from the state they share, `BuilderState`: the first thing stopping a
 * save, every problem with where it is, and the person as the page draws them. Pure, with no React in
 * it, so both can import it and the rules stay in one place.
 */

/** The first thing stopping a save, or null. */
export function problemOf(s: BuilderState): string | null {
  return Object.values(profileProblems(s.profile))[0] ?? Object.values(checkTiles(s.arrangement.tiles, tileKindsShownBy(s.arrangement.sections)).problems)[0] ?? null;
}

/** The person as the preview draws them: what's typed, with links only once they're real https addresses. */
export function personOf(p: ProfileDraft, username: string | null, photoUrl: string | null, showLinkedin: boolean): PortfolioPerson {
  const email = p.contactEmail.trim();
  return {
    username,
    name: p.name.trim() || username || "Your name",
    headline: p.headline.trim() || null,
    bio: p.bio.trim() || null,
    location: p.location.trim() || null,
    lookingFor: p.lookingFor.trim() || null,
    photoUrl,
    links: {
      linkedin: showLinkedin && p.linkedin ? normaliseLinkedin(p.linkedin) : null,
      github: p.github ? normaliseGithub(p.github) : null,
      website: p.website ? normaliseWebsite(p.website) : null,
      email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email.toLowerCase() : null,
    },
  };
}

/**
 * The person as the editing page draws them (decision 0031, "The adapter"): `personOf`, but with every
 * word exactly as it is typed. The fields on the page are the page's own words, so a name or a headline
 * that came back trimmed would take the space just typed out from under the cursor, and an empty name
 * shows its placeholder, never the address or "Your name" as if it had been typed. The links are the
 * visitor's (they are not typed on the page).
 */
export function editingPerson(p: ProfileDraft, username: string | null, photoUrl: string | null, showLinkedin: boolean): PortfolioPerson {
  return { ...personOf(p, username, photoUrl, showLinkedin), name: p.name, headline: p.headline, bio: p.bio, location: p.location, lookingFor: p.lookingFor };
}

/**
 * Every problem stopping a save, each at the path of the field it is about (decision 0031, "Fields, and
 * the path each one has"): `profileProblems` key `k` at `profile.k`; `checkTiles` key `kind.field` at
 * `arrangement.tiles.kind.field` (a list's problem, `education.lines`, at the list's own path). In the
 * order `problemOf` reads them, so the first entry is the one the status line names.
 */
export function issuesOf(s: BuilderState): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, message] of Object.entries(profileProblems(s.profile))) if (message) out[`profile.${k}`] = message;
  for (const [k, message] of Object.entries(checkTiles(s.arrangement.tiles, tileKindsShownBy(s.arrangement.sections)).problems)) out[`arrangement.tiles.${k}`] = message;
  return out;
}
