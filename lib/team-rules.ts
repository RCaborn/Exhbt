/**
 * Teammates on an exhbt (decision 0013), as constants and pure checks, safe to import from
 * client components. These are the same on every plan, so they live here and not in
 * lib/entitlements.ts. The server-side flows are lib/team.ts and lib/duplicates.ts.
 */

/** People on one exhbt besides its owner: accepted teammates and open invites together. */
export const TEAMMATES_PER_EXHBT = 6;

/** A teammate's role, such as "Built the model". */
export const ROLE_MAX_CHARS = 40;

/** How long an invite link works. */
export const INVITE_DAYS = 14;

/** Invites (and resends) one person can send in an hour, so invites can't be used to flood an inbox. */
export const INVITES_PER_HOUR = 20;

/** Someone shown on an exhbt besides its author: a byline, not content, so no words are counted. */
export type Teammate = {
  userId: string;
  name: string;
  /** Empty for the original's author, shown on a teammate's own exhbt. */
  role: string;
  photoUrl: string | null;
  /** Their portfolio, if they have a public one. */
  href: string | null;
};

/** Trims and squashes spaces. */
export const cleanRole = (role: string) => role.replace(/\s+/g, " ").trim();

/** A reason the role can't be used, or null. Empty is allowed: the role is optional. */
export function roleProblem(role: string): string | null {
  return cleanRole(role).length > ROLE_MAX_CHARS ? `Keep the role to ${ROLE_MAX_CHARS} characters.` : null;
}

/** "Ana", "Ana and Ben", "Ana, Ben and Cal". */
export function namesList(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}
