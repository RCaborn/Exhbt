import { z } from "zod/v4";
import type { Plan } from "./entitlements";
import { HeaderBitsSchema, TILE_KINDS, TilesSchema, type HeaderBits, type Tiles } from "./portfolio-layout";

/**
 * What the portfolio customiser (app/(app)/portfolio/customise) sends to be saved, and what the
 * server sends back. Pure, so the page, the action and the tests share one definition
 * (docs/decisions/0014). The server re-checks everything in the action; the client uses the same
 * schema to say what is wrong before it sends.
 */

/** The whole arrangement, as the page holds it. */
export type CustomiseState = {
  /** Every tile on the page, top to bottom: a project's id or an extra tile's name. Hidden and featured projects keep their place. */
  order: string[];
  /** Exhbts left off the glance page. */
  hidden: string[];
  /** The wide first tile, or null. */
  featured: string | null;
  /** The look the person has chosen and saved. */
  themeId: string;
  header: HeaderBits;
  /** The words in each extra tile that is in `order`. */
  tiles: Tiles;
};

/** The most keys an order can hold: every exhbt a plan allows and every extra tile, with room to spare. */
const MAX_KEYS = 40;
const Key = z.string().min(1).max(64);

export const CustomiseSchema = z.object({
  order: z.array(Key).max(MAX_KEYS),
  hidden: z.array(Key).max(MAX_KEYS),
  featured: Key.nullable(),
  themeId: z.string().max(40),
  header: HeaderBitsSchema,
  tiles: TilesSchema,
});

export type SaveResult = { ok: true; savedAt: string } | { ok: false; error: string; upgradeTo?: Plan };

/** Largest request the action reads, in characters of JSON. A full set of tiles is well under 3 000. */
export const MAX_REQUEST_CHARS = 20_000;

/** A problem in one field of one tile, for the tile's editor: "quote.text" and what to say. */
export type TileProblems = Record<string, string>;

/** Checks each tile on its own. `problems` is keyed "kind.field" ("education.lines" for a list); `clean` has the tiles that passed, normalised. */
export function checkTiles(tiles: Tiles, present: readonly string[]): { problems: TileProblems; clean: Tiles } {
  const problems: TileProblems = {};
  const clean: Tiles = {};
  for (const kind of TILE_KINDS) {
    if (!present.includes(kind)) continue;
    const one = TilesSchema.safeParse({ [kind]: tiles[kind] });
    if (one.success) {
      if (one.data[kind]) (clean as Record<string, unknown>)[kind] = one.data[kind];
      continue;
    }
    for (const issue of one.error.issues) {
      const field = issue.path.slice(1).find((p) => typeof p === "string") ?? "";
      const key = `${kind}.${String(field)}`;
      problems[key] ??= issue.message;
    }
  }
  return { problems, clean };
}
