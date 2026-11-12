import { z } from "zod/v4";
import { normaliseLinkedin } from "@/lib/cv-contact";

/** Profile limits (docs/phase-2.md section 4). Shared by the form's counters and the server check. */
export const NAME_MAX_CHARS = 60;
export const HEADLINE_MAX_WORDS = 12;
export const BIO_MAX_WORDS = 40;

/** Username claims (changes included) a person can make in an hour. */
export const USERNAME_CLAIMS_PER_HOUR = 5;

export const countWords = (s: string) => s.split(/\s+/).filter(Boolean).length;
const oneLine = (s: string) => s.trim().replace(/\s+/g, " ");

export const profileSchema = z.object({
  name: z.string().transform(oneLine).pipe(z.string().max(NAME_MAX_CHARS, `Keep your name to ${NAME_MAX_CHARS} characters or fewer.`)),
  headline: z
    .string()
    .transform(oneLine)
    .refine((s) => countWords(s) <= HEADLINE_MAX_WORDS, `Keep the headline to ${HEADLINE_MAX_WORDS} words or fewer.`),
  bio: z
    .string()
    .transform(oneLine)
    .refine((s) => countWords(s) <= BIO_MAX_WORDS, `Keep the bio to ${BIO_MAX_WORDS} words or fewer.`),
  linkedin: z
    .string()
    .trim()
    .refine((s) => !s || normaliseLinkedin(s) !== null, "Use your LinkedIn profile address, like linkedin.com/in/your-name.")
    .transform((s) => (s ? normaliseLinkedin(s) : null)),
  hideFromSearch: z.boolean(),
});

export type ProfileField = "name" | "headline" | "bio" | "linkedin";
