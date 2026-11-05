export type Plan = "free" | "basic" | "custom" | "institutional";

type Entitlements = { roadmap: boolean; packs: boolean; curatedLinks: boolean };

/** Single source of truth for what each plan unlocks. Institutional students get Custom features. */
export const ENTITLEMENTS: Record<Plan, Entitlements> = {
  free: { roadmap: true, packs: false, curatedLinks: false },
  basic: { roadmap: true, packs: true, curatedLinks: false },
  custom: { roadmap: true, packs: true, curatedLinks: true },
  institutional: { roadmap: true, packs: true, curatedLinks: true },
};

export const PRICES = {
  free: { label: "Free", price: "£0", per: "" },
  basic: { label: "Basic", price: "£9", per: "a year" },
  custom: { label: "Custom", price: "£15", per: "a year" },
} as const;
