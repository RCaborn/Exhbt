import type { TileExhbt } from "@/components/exhbt/ExhbtTile";
import type { Plan } from "@/lib/entitlements";
import type { CustomiseState } from "@/lib/portfolio-customise";
import type { ProfileDraft } from "@/lib/portfolio-profile";

/** The builder's steps, in order (decision 0016). `?step=` holds the id. */
export const STEPS = [
  { id: "you", label: "You" },
  { id: "look", label: "Your look" },
  { id: "projects", label: "Your projects" },
  { id: "publish", label: "Publish" },
] as const;
export type Step = (typeof STEPS)[number]["id"];

export const isStep = (s: unknown): s is Step => STEPS.some((x) => x.id === s);

/** Everything the builder autosaves, in one object. */
export type BuilderState = { profile: ProfileDraft; arrangement: CustomiseState };

/** One of the person's exhbts as a tile on their page. */
export type BuilderProject = { id: string; title: string; tile: TileExhbt; live: boolean };

/** Why a look is locked for this person, and which plan opens it (from canUseTheme on the server). */
export type ThemeLock = { reason: string; upgradeTo?: Plan; planName: string };

export type BuilderPlan = {
  name: string;
  isPublic: boolean;
  publishNote: { reason: string; upgradeTo?: Plan } | null;
  extraTiles: boolean;
  extraTilesReason: string | null;
  heldTiles: boolean;
  uploadMb: number;
};
