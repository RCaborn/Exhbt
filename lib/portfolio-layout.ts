import { z } from "zod/v4";
import { normaliseLinkedin } from "./cv-contact";
import { safeHref } from "./exhbt/blocks";

/**
 * How a person has arranged their portfolio's at-a-glance page (docs/decisions/0014).
 *
 * Stored in `profiles.portfolio_layout` (jsonb) as `PortfolioLayout`; the pieces that belong to an
 * exhbt (hidden) or to the profile as a column (featured) live in their own columns. Pure data and
 * rules, no database: the customiser, the server action and the public page all read this file.
 *
 *   slots   where the extra tiles sit among the project tiles, in order. "p" stands for a project;
 *           a tile's name stands for that tile. The projects themselves keep their order in
 *           `exhbts.position`, so the simple up/down buttons on /exhbts and the customiser share it.
 *   tiles   the words in each extra tile that is on the page. A tile is on the page when its name
 *           is in `slots`; removing it deletes its words.
 *   header  the two bits of the top band a person can switch off.
 *
 * A missing, old or damaged value gives today's page: every project in order, no extra tiles, the
 * skills strip and the LinkedIn button showing (`normaliseLayout`).
 */

export const TILE_KINDS = ["about", "education", "experience", "quote", "links"] as const;
export type TileKind = (typeof TILE_KINDS)[number];
export const isTileKind = (k: string): k is TileKind => (TILE_KINDS as readonly string[]).includes(k);

/** What the menu and the tile heading call each tile. */
export const TILE_NAMES: Record<TileKind, string> = {
  about: "About me",
  education: "Education",
  experience: "Experience",
  quote: "Featured quote",
  links: "Links and contact",
};

/** One line saying what goes in the tile, for the "Add a tile" menu. */
export const TILE_HINTS: Record<TileKind, string> = {
  about: "A few lines about you",
  education: "Where you studied",
  experience: "Work you have done",
  quote: "Something a tutor or manager said",
  links: "LinkedIn, GitHub, your site, your email",
};

/** Limits. These tiles are not part of any exhbt's word cap. */
export const TILE_LIMITS = {
  aboutWords: 60,
  lines: 3,
  lineWords: 14,
  lineChars: 100,
  quoteWords: 30,
  nameChars: 60,
  roleChars: 60,
  linkChars: 200,
} as const;

const oneLine = (s: string) => s.trim().replace(/\s+/g, " ");
export const countWords = (s: string) => s.split(/\s+/).filter(Boolean).length;

const words = (max: number, what: string) =>
  z
    .string()
    .transform(oneLine)
    .refine((s) => countWords(s) <= max, `Keep ${what} to ${max} words or fewer.`);
const chars = (max: number, what: string) =>
  z
    .string()
    .transform(oneLine)
    .refine((s) => s.length <= max, `Keep ${what} to ${max} characters or fewer.`);

const LineSchema = z
  .string()
  .transform(oneLine)
  .refine((s) => countWords(s) <= TILE_LIMITS.lineWords && s.length <= TILE_LIMITS.lineChars, `Keep each line to ${TILE_LIMITS.lineWords} words or fewer.`);
const LinesSchema = z
  .array(LineSchema)
  .max(TILE_LIMITS.lines, `Use up to ${TILE_LIMITS.lines} lines.`)
  .transform((a) => a.filter(Boolean));

const SCHEME = /^[a-z][a-z0-9+.-]*:/i;
/** "github.com/amara" or "https://github.com/amara/repo" to the https address, else null. */
export function normaliseGithub(input: string): string | null {
  const m = input.trim().match(/^(?:https:\/\/)?(?:www\.)?github\.com\/([A-Za-z0-9](?:[A-Za-z0-9-]{0,38}))(\/[A-Za-z0-9._-]{1,100})?\/?$/i);
  return m ? `https://github.com/${m[1]}${m[2] ?? ""}` : null;
}
/** "amara.dev" or "https://amara.dev/work" to an https address, else null. A scheme other than https is refused. */
export function normaliseWebsite(input: string): string | null {
  const s = input.trim();
  if (!s || /\s/.test(s)) return null;
  const withScheme = SCHEME.test(s) ? s : `https://${s}`;
  const href = safeHref(withScheme);
  if (!href) return null;
  try {
    const host = new URL(href).hostname;
    return host.includes(".") && !host.endsWith(".") ? href : null;
  } catch {
    return null;
  }
}

const optional = (check: (s: string) => string | null, message: string) =>
  z
    .string()
    .transform((s) => s.trim())
    .refine((s) => s.length <= TILE_LIMITS.linkChars && (!s || check(s) !== null), message)
    .transform((s) => (s ? (check(s) ?? "") : ""));

const EMAIL = z.email();
export const TilesSchema = z.object({
  about: z.object({ text: words(TILE_LIMITS.aboutWords, "this") }).optional(),
  education: z.object({ lines: LinesSchema }).optional(),
  experience: z.object({ lines: LinesSchema }).optional(),
  quote: z
    .object({
      text: words(TILE_LIMITS.quoteWords, "the quote"),
      name: chars(TILE_LIMITS.nameChars, "the name"),
      role: chars(TILE_LIMITS.roleChars, "the role"),
    })
    .optional(),
  links: z
    .object({
      linkedin: optional(normaliseLinkedin, "Use your LinkedIn address, like linkedin.com/in/your-name."),
      github: optional(normaliseGithub, "Use your GitHub address, like github.com/your-name."),
      website: optional(normaliseWebsite, "Use an https address, like https://your-name.co.uk."),
      email: z
        .string()
        .transform((s) => s.trim())
        .refine((s) => !s || (s.length <= 120 && EMAIL.safeParse(s).success), "Use a full email address.")
        .transform((s) => s.toLowerCase()),
    })
    .optional(),
});
export type Tiles = z.infer<typeof TilesSchema>;

export const HeaderBitsSchema = z.object({ skills: z.boolean(), linkedin: z.boolean() });
export type HeaderBits = z.infer<typeof HeaderBitsSchema>;

/** At most this many slots: every exhbt a plan allows, plus each extra tile, with room to spare. */
const MAX_SLOTS = 40;

export const PortfolioLayoutSchema = z.object({
  v: z.literal(1),
  slots: z.array(z.string()).max(MAX_SLOTS),
  tiles: TilesSchema,
  header: HeaderBitsSchema,
});
export type PortfolioLayout = z.infer<typeof PortfolioLayoutSchema>;

export const DEFAULT_HEADER: HeaderBits = { skills: true, linkedin: true };
export const DEFAULT_LAYOUT: PortfolioLayout = { v: 1, slots: [], tiles: {}, header: DEFAULT_HEADER };

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * Whatever is stored, as a valid layout. Never throws and never fails a page: a damaged tile is
 * dropped on its own, a missing value is today's layout.
 */
export function normaliseLayout(raw: unknown): PortfolioLayout {
  if (!isObject(raw)) return { ...DEFAULT_LAYOUT, tiles: {} };
  const slots: string[] = [];
  if (Array.isArray(raw.slots)) {
    for (const s of raw.slots.slice(0, MAX_SLOTS)) {
      if (s === "p") slots.push("p");
      else if (typeof s === "string" && isTileKind(s) && !slots.includes(s)) slots.push(s);
    }
  }
  const tiles: Tiles = {};
  const rawTiles = isObject(raw.tiles) ? raw.tiles : {};
  for (const kind of TILE_KINDS) {
    if (!slots.includes(kind)) continue;
    const one = TilesSchema.safeParse({ [kind]: rawTiles[kind] });
    if (one.success && one.data[kind]) (tiles as Record<string, unknown>)[kind] = one.data[kind];
  }
  const h = isObject(raw.header) ? raw.header : {};
  return {
    v: 1,
    slots,
    tiles,
    header: { skills: h.skills !== false, linkedin: h.linkedin !== false },
  };
}

/** The empty words for a tile that has just been added. */
export function emptyTile<K extends TileKind>(kind: K): NonNullable<Tiles[K]> {
  const blank: Required<Tiles> = {
    about: { text: "" },
    education: { lines: [""] },
    experience: { lines: [""] },
    quote: { text: "", name: "", role: "" },
    links: { linkedin: "", github: "", website: "", email: "" },
  };
  return structuredClone(blank[kind]) as NonNullable<Tiles[K]>;
}

/** True when a tile has any words to show. An empty tile is kept in the customiser but not published. */
export function tileHasContent(kind: TileKind, tiles: Tiles): boolean {
  switch (kind) {
    case "about":
      return Boolean(tiles.about?.text.trim());
    case "education":
    case "experience":
      return (tiles[kind]?.lines ?? []).some((l) => l.trim());
    case "quote":
      return Boolean(tiles.quote?.text.trim());
    case "links": {
      const l = tiles.links;
      return Boolean(l && (l.linkedin || l.github || l.website || l.email));
    }
  }
}

/**
 * The whole order of the page as keys: a project's id, or a tile's name. Hidden projects and the
 * featured one are still in it (so they keep their place for when they come back). `projectIds` are
 * the person's projects in `exhbts.position` order; the layout's "p" slots take them in turn, and
 * any left over go on the end. A "p" slot with no project left is dropped.
 */
export function sequence(layout: PortfolioLayout, projectIds: string[]): string[] {
  const queue = [...projectIds];
  const out: string[] = [];
  for (const s of layout.slots) {
    if (s === "p") {
      const next = queue.shift();
      if (next !== undefined) out.push(next);
    } else if (isTileKind(s) && !out.includes(s)) out.push(s);
  }
  return [...out, ...queue];
}

/** The reverse of `sequence`: where the tiles sit, and the projects' order. */
export function splitOrder(order: string[]): { slots: string[]; projectIds: string[] } {
  const slots: string[] = [];
  const projectIds: string[] = [];
  for (const k of order) {
    if (isTileKind(k)) slots.push(k);
    else {
      slots.push("p");
      projectIds.push(k);
    }
  }
  return { slots, projectIds };
}

/**
 * What the page shows, top to bottom: `order` without the hidden projects, with the featured
 * project hoisted to the front. The customiser and the public page both call this.
 */
export function shownKeys(order: string[], hidden: ReadonlySet<string>, featuredId: string | null): string[] {
  const shown = order.filter((k) => !hidden.has(k));
  if (featuredId && shown.includes(featuredId)) return [featuredId, ...shown.filter((k) => k !== featuredId)];
  return shown;
}

/**
 * Which of the shown tiles span both columns (md and up). The featured project is always wide.
 * Otherwise, with an odd count, the first is wide, so no tile sits alone beside a gap. With a
 * featured project and an odd number of others, the last of them is wide for the same reason.
 */
export function wideIndexes(count: number, hasFeatured: boolean): Set<number> {
  const wide = new Set<number>();
  if (count === 0) return wide;
  if (hasFeatured) {
    wide.add(0);
    if ((count - 1) % 2 === 1) wide.add(count - 1);
  } else if (count % 2 === 1) {
    wide.add(0);
  }
  return wide;
}

/** The layout to store for this order: the slots from the order, the header and tiles kept as given. */
export function layoutFromOrder(order: string[], tiles: Tiles, header: HeaderBits): PortfolioLayout {
  const { slots } = splitOrder(order);
  const kept: Tiles = {};
  for (const kind of TILE_KINDS) if (slots.includes(kind) && tiles[kind]) (kept as Record<string, unknown>)[kind] = tiles[kind];
  return { v: 1, slots, tiles: kept, header };
}
