import type { Plan } from "./entitlements";

/**
 * The rows the admin panel reads (decision 0021). Each store hands back lean rows, with the
 * columns the panel needs and nothing else (no file contents, no event props beyond the few listed
 * here), and lib/admin.ts does the counting. Dates are ISO strings; days are bucketed in UTC.
 */

export type AdminTable =
  | "profiles"
  | "subscriptions"
  | "roadmaps"
  | "exhbts"
  | "events"
  | "pageViews"
  | "aiCalls"
  | "ideas"
  | "savedIdeas"
  | "referrals"
  | "waitlist"
  | "leads"
  | "jobLinks"
  | "members"
  | "invites"
  | "files"
  | "matches";

/** Tables that are read whole (totals and plan breakdowns need every row), whatever the date range. */
export const ALL_TIME_TABLES: AdminTable[] = ["profiles", "subscriptions", "jobLinks", "members", "invites", "files"];

/** N1 and N2: all accounts, and how many have published a first and a second exhbt (Store.adminPublishNumbers). `partial` when a table was too big to read whole. */
export type AdminPublishNumbers = { accounts: number; first: number; second: number; partial: boolean };

export type AdminRowMap = {
  profiles: { id: string; email: string; createdAt: string; username: string | null; role: string; institutionActive: boolean }[];
  subscriptions: { userId: string; plan: Plan; status: string; subscriptionId: string | null; createdAt: string }[];
  roadmaps: {
    id: string;
    userId: string | null;
    createdAt: string;
    /** Undefined when the database has no such column yet. */
    ideasFailedAt: string | null | undefined;
    swaps: number;
  }[];
  exhbts: { id: string; userId: string; status: "draft" | "published"; createdAt: string; publishedAt: string | null }[];
  /** Named events except page_view. `cached` is only set on roadmap_completed. */
  events: { name: string; userId: string | null; at: string; cached: boolean | null; reason: string | null; inputTokens: number | null; outputTokens: number | null }[];
  pageViews: { at: string; path: string; referrer: string; isPortfolio: boolean }[];
  aiCalls: { userId: string | null; step: string; model: string; inputTokens: number; outputTokens: number; costUsd: number; at: string }[];
  ideas: { at: string; source: "roadmap" | "swap" }[];
  savedIdeas: { at: string }[];
  referrals: { id: string; referrerId: string; referredId: string | null; status: "pending" | "earned" | "credited"; createdAt: string }[];
  waitlist: { email: string; interest: string; source: string; at: string | null }[];
  leads: { name: string; email: string; institution: string; at: string | null }[];
  jobLinks: { userId: string; status: string; views: number; createdAt: string }[];
  members: { exhbtId: string; userId: string; addedAt: string }[];
  invites: { accepted: boolean; cancelled: boolean; createdAt: string }[];
  files: { bucket: string; bytes: number }[];
  matches: { id: string; outcome: string; createdAt: string }[];
};

export type AdminRows<T extends AdminTable> = { rows: AdminRowMap[T]; truncated: boolean };

/** The most rows read from one table in one go. Past it the panel says the figures are partial. */
export const ADMIN_ROW_CAP = 100_000;

/**
 * The plan an account is on and whether it is a comp (a subscription we gave, whose id starts
 * "comp_"). The same order as `planFor` in lib/store.ts: a live subscription, then a university
 * licence, then Free. `subs` newest first; `live` is LIVE_SUBSCRIPTION_STATUSES.
 */
export function accountPlan(
  subs: { plan: Plan; status: string; subscriptionId: string | null }[],
  institutionActive: boolean,
  live: string[],
): { plan: Plan; comp: boolean } {
  const s = subs.find((x) => live.includes(x.status));
  if (s) return { plan: s.plan, comp: (s.subscriptionId ?? "").startsWith("comp_") };
  return { plan: institutionActive ? "institutional" : "free", comp: false };
}

/** Keeps a search box's text to characters that can sit in an email or a username. */
export function cleanQuery(q: string): string {
  return q.toLowerCase().replace(/[^a-z0-9@._+-]/g, "").slice(0, 60);
}

/** One line of the accounts table. */
export type AdminAccountRow = {
  id: string;
  email: string;
  createdAt: string;
  plan: Plan;
  comp: boolean;
  username: string | null;
  roadmaps: number;
  exhbts: number;
  lastActive: string | null;
};

export type AdminAccountsPage = { rows: AdminAccountRow[]; total: number; page: number; pageSize: number };

/** A read-only account page: counts and the person's own events (names and times, no props). */
export type AdminAccountDetail = AdminAccountRow & {
  role: string;
  /** ideasFailed is null where the database has no such column yet. */
  roadmapList: { id: string; createdAt: string; ideasFailed: boolean | null }[];
  exhbtList: { id: string; status: string; createdAt: string }[];
  events: { name: string; at: string }[];
  aiCalls: number;
  aiCostUsd: number;
  files: number;
  fileBytes: number;
};
