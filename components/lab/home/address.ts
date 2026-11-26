import { usernameProblem } from "@/lib/hosts";

/**
 * Home's name field, as an address (the lab's Home screen, decision 0033's sixth thing). Plain
 * functions, safe on the server and in the browser. A helper of this screen only: when the screen
 * is promoted it belongs beside lib/hosts.ts.
 */

/** The longest name the field keeps. */
export const NAME_MAX = 40;

/** The longest address name lib/hosts.ts accepts (USERNAME_RE: 3 to 30 characters). */
const ADDRESS_MAX = 30;

/** What the person typed, tidied for the page: spaces collapsed, at most NAME_MAX characters. */
export function tidyName(typed: string): string {
  return typed.replace(/\s+/g, " ").trimStart().slice(0, NAME_MAX);
}

/**
 * The name part of the address a typed name would give: accents dropped, apostrophes dropped,
 * anything else between words one hyphen, lower case, at most 30 characters (cut at a hyphen where
 * it can). "Priya Shah" gives "priya-shah", "Siobhán O'Brien" gives "siobhan-obrien".
 */
export function addressPart(name: string): string {
  const s = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/['’]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (s.length <= ADDRESS_MAX) return s;
  const cut = s.slice(0, ADDRESS_MAX);
  const at = cut.lastIndexOf("-");
  return (at >= ADDRESS_MAX / 2 ? cut.slice(0, at) : cut).replace(/-+$/, "");
}

/**
 * Where a typed name stands. `address` is set only when lib/hosts.ts would accept it
 * (usernameProblem: the shape, single hyphens, not a reserved name); otherwise `why` says, in a
 * few words, what the address needs. Nothing here says an address is free: that is only known
 * once it has been checked, at sign-up.
 */
export type NameState = { name: string; address: string | null; why: string | null };

export function nameState(typed: string): NameState {
  const name = tidyName(typed).trim();
  if (!name) return { name: "", address: null, why: null };
  const part = addressPart(name);
  if (!part) return { name, address: null, why: "An address uses the letters a to z, numbers and hyphens." };
  if (part.length < 3) return { name, address: null, why: "An address needs at least three letters or numbers." };
  if (usernameProblem(part)) return { name, address: null, why: "That one is kept for Exhbt itself. Try your full name." };
  return { name, address: part, why: null };
}

/** A number of looks as a word, so the count is read from the list of looks rather than typed. */
const WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];
export const inWords = (n: number) => WORDS[n] ?? String(n);
