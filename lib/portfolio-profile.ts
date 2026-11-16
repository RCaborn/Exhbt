import { z } from "zod/v4";
import { normaliseLinkedin } from "./cv-contact";
import { normaliseGithub, normaliseWebsite } from "./portfolio-layout";

/**
 * The "You" part of a portfolio (docs/decisions/0016): who the person is, in their words, and how to
 * reach them. Pure, so the builder's fields, its autosave and the server action share one check.
 * The server parses every save with `ProfileDraftSchema` again; the page only shows the rules.
 */

export const PROFILE_LIMITS = {
  nameChars: 60,
  headlineWords: 12,
  /** The intro that leads the page. The database allows 700 characters. */
  introWords: 60,
  introChars: 700,
  locationChars: 60,
  lookingForWords: 16,
  lookingForChars: 140,
  emailChars: 120,
  linkChars: 200,
} as const;

export const countWords = (s: string) => s.split(/\s+/).filter(Boolean).length;
const oneLine = (s: string) => s.trim().replace(/\s+/g, " ");
/** The intro keeps its paragraph breaks (at most one blank line between them) but no runs of spaces. */
const paragraphs = (s: string) =>
  s
    .replace(/\r/g, "")
    .split(/\n{2,}/)
    .map((p) => oneLine(p))
    .filter(Boolean)
    .join("\n\n");

const L = PROFILE_LIMITS;

const link = (check: (s: string) => string | null, message: string) =>
  z
    .string()
    .transform((s) => s.trim())
    .refine((s) => !s || (s.length <= L.linkChars && check(s) !== null), message)
    .transform((s) => (s ? check(s) : null));

/** Everything the builder's "You" step saves, as the page holds it (strings, empty for none). */
export const ProfileDraftSchema = z.object({
  name: z
    .string()
    .transform(oneLine)
    .refine((s) => s.length <= L.nameChars, `Keep your name to ${L.nameChars} characters or fewer.`),
  headline: z
    .string()
    .transform(oneLine)
    .refine((s) => countWords(s) <= L.headlineWords, `Keep the headline to ${L.headlineWords} words or fewer.`),
  bio: z
    .string()
    .transform(paragraphs)
    .refine((s) => countWords(s) <= L.introWords, `Keep your intro to ${L.introWords} words or fewer.`)
    .refine((s) => s.length <= L.introChars, `Keep your intro to ${L.introChars} characters or fewer.`),
  location: z
    .string()
    .transform(oneLine)
    .refine((s) => s.length <= L.locationChars, `Keep this to ${L.locationChars} characters or fewer.`),
  lookingFor: z
    .string()
    .transform(oneLine)
    .refine((s) => countWords(s) <= L.lookingForWords && s.length <= L.lookingForChars, `Keep this to ${L.lookingForWords} words or fewer.`),
  linkedin: link(normaliseLinkedin, "Use your LinkedIn profile address, like linkedin.com/in/your-name."),
  github: link(normaliseGithub, "Use your GitHub address, like github.com/your-name."),
  website: link(normaliseWebsite, "Use an https address, like https://your-name.co.uk."),
  contactEmail: z
    .string()
    .transform((s) => s.trim().toLowerCase())
    .refine((s) => !s || (s.length <= L.emailChars && z.email().safeParse(s).success), "Use a full email address, like you@example.com."),
  hideFromSearch: z.boolean(),
});

export type ProfileDraft = z.input<typeof ProfileDraftSchema>;
export type ProfileField = keyof Omit<ProfileDraft, "hideFromSearch">;

/** The first problem with each field, for the field's error line. Empty when it all passes. */
export function profileProblems(d: ProfileDraft): Partial<Record<ProfileField, string>> {
  const r = ProfileDraftSchema.safeParse(d);
  const out: Partial<Record<ProfileField, string>> = {};
  if (r.success) return out;
  for (const issue of r.error.issues) {
    const key = issue.path[0] as ProfileField;
    out[key] ??= issue.message;
  }
  return out;
}

/** The stored profile as the builder holds it. */
export function draftFromProfile(p: {
  name: string | null;
  headline: string | null;
  bio: string | null;
  location: string | null;
  lookingFor: string | null;
  linkedin: string | null;
  github: string | null;
  website: string | null;
  contactEmail: string | null;
  hideFromSearch: boolean;
}): ProfileDraft {
  return {
    name: p.name ?? "",
    headline: p.headline ?? "",
    bio: p.bio ?? "",
    location: p.location ?? "",
    lookingFor: p.lookingFor ?? "",
    linkedin: p.linkedin ?? "",
    github: p.github ?? "",
    website: p.website ?? "",
    contactEmail: p.contactEmail ?? "",
    hideFromSearch: p.hideFromSearch,
  };
}

/** Initials for the photo stand-in and the tab icon: "Amara Okafor" to "AO". */
export function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => [...w][0]!.toUpperCase())
    .join("");
}
