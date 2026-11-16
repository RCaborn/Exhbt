import { safeHref } from "@/lib/exhbt/blocks";
import type { PortfolioLayout } from "@/lib/portfolio-layout";
import type { PortfolioProfile } from "@/lib/store";

/**
 * Who a portfolio belongs to, as its home page (`PortfolioHome`) shows them: the "You" step of the
 * builder (decision 0016). Plain data, safe in the browser.
 */
export type PortfolioPerson = {
  username: string | null;
  name: string;
  headline?: string | null;
  /** The intro, in their words. Paragraphs are separated by a blank line. */
  bio?: string | null;
  location?: string | null;
  lookingFor?: string | null;
  photoUrl?: string | null;
  /** Checked https addresses, or null. The email is shown as text, never as a mailto. */
  links?: { linkedin?: string | null; github?: string | null; website?: string | null; email?: string | null };
};

/** The person from their stored profile. LinkedIn only while they have it switched on. */
export function personFrom(
  profile: Pick<PortfolioProfile, "username" | "headline" | "bio" | "linkedin" | "location" | "lookingFor" | "github" | "website" | "contactEmail">,
  displayName: string,
  photoUrl: string | null,
  layout: Pick<PortfolioLayout, "header">,
): PortfolioPerson {
  return {
    username: profile.username,
    name: displayName,
    headline: profile.headline,
    bio: profile.bio,
    location: profile.location,
    lookingFor: profile.lookingFor,
    photoUrl,
    links: {
      linkedin: layout.header.linkedin ? safeHref(profile.linkedin ?? undefined) : null,
      github: safeHref(profile.github ?? undefined),
      website: safeHref(profile.website ?? undefined),
      email: profile.contactEmail,
    },
  };
}
