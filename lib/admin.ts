import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import { getCurrentUser, type SessionUser } from "./auth";
import { accountPlan, ALL_TIME_TABLES, type AdminAccountDetail, type AdminAccountsPage, type AdminRowMap, type AdminTable } from "./admin-types";
import type { Plan } from "./entitlements";
import { getStore, LIVE_SUBSCRIPTION_STATUSES } from "./store";

/**
 * The admin panel's reads (decision 0021). Only accounts whose profiles.role is exhbt_admin get
 * anything: everyone else, signed in or not, gets notFound(), the same 404 as a page that was
 * never there. Every export here checks the role itself, and the store checks it once more, so a
 * page that forgets cannot leak data.
 */

/** Cached for the request, so the layout, the page and the data functions check once between them. */
export const requireAdmin = cache(async (): Promise<SessionUser> => {
  const user = await getCurrentUser();
  if (!user || !(await getStore().isAdmin(user.id))) notFound();
  return user;
});

export const RANGES = ["7d", "30d", "90d", "all"] as const;
export type Range = (typeof RANGES)[number];
export const RANGE_LABEL: Record<Range, string> = { "7d": "7 days", "30d": "30 days", "90d": "90 days", all: "All time" };
export const parseRange = (v: string | string[] | undefined): Range => (RANGES as readonly string[]).includes(String(v)) ? (String(v) as Range) : "30d";

/** Longest daily chart: all time shows the latest this many days. */
const MAX_DAYS = 120;

const DAY = 86_400_000;
const dayOf = (iso: string) => iso.slice(0, 10);
const startOfDay = (t: number) => new Date(Math.floor(t / DAY) * DAY);

/** The days a range covers, oldest first, UTC. `all` runs from the earliest date seen. */
export function daysFor(range: Range, earliest: string | null, now = Date.now()): string[] {
  const n = range === "all" ? Math.min(MAX_DAYS, Math.max(1, earliest ? Math.floor((now - Date.parse(earliest)) / DAY) + 1 : 1)) : Number.parseInt(range, 10);
  const today = startOfDay(now).getTime();
  return Array.from({ length: n }, (_, i) => new Date(today - (n - 1 - i) * DAY).toISOString().slice(0, 10));
}

export type Day = { day: string; n: number };
const series = (days: string[], dates: string[]): Day[] => {
  const by = new Map<string, number>();
  for (const d of dates) by.set(dayOf(d), (by.get(dayOf(d)) ?? 0) + 1);
  return days.map((day) => ({ day, n: by.get(day) ?? 0 }));
};
const top = <K>(items: K[], n: number): { key: K; n: number }[] => {
  const by = new Map<K, number>();
  for (const i of items) by.set(i, (by.get(i) ?? 0) + 1);
  return [...by.entries()].map(([key, c]) => ({ key, n: c })).sort((a, b) => b.n - a.n).slice(0, n);
};

/** A part of the overview that loaded, or why it didn't. One missing table never blanks the page. */
export type Section<T> = { ok: true; data: T; partial: boolean } | { ok: false; note: string };

export type Overview = {
  range: Range;
  /** First day of the range (ISO date), or null for all time. */
  since: string | null;
  days: string[];
  accounts: Section<{ total: number; inRange: number; daily: Day[]; byPlan: { plan: Plan; total: number; comp: number }[] }>;
  roadmaps: Section<{
    total: number;
    daily: Day[];
    /** People with exactly 1, 2 and 3 or more roadmaps in the range. */
    perPerson: { one: number; two: number; threePlus: number; signedOut: number };
    topUsers: { userId: string; email: string; n: number }[];
    cached: number;
    fresh: number;
    failures: number;
  }>;
  ideas: Section<{ generated: number; swaps: number; saved: number; failures: number; roadmapsFailed: number | null }>;
  exhbts: Section<{ drafted: number; published: number; people: number; perPerson: { one: number; two: number; threePlus: number }; aiDrafts: number; aiRewrites: number }>;
  ai: Section<{
    calls: number;
    costUsd: number;
    inputTokens: number;
    outputTokens: number;
    dailyCost: { day: string; n: number }[];
    steps: { step: string; calls: number; costUsd: number; inputTokens: number; outputTokens: number }[];
    byDay: { day: string; steps: { step: string; calls: number; costUsd: number }[] }[];
  }>;
  subscriptions: Section<{ active: { plan: Plan; paying: number; comp: number }[]; activeTotal: number }>;
  referrals: Section<{ pending: number; earned: number; credited: number; list: { id: string; referrer: string; referred: string; status: string; createdAt: string }[] }>;
  waitlist: Section<{ total: number; list: { email: string; interest: string; source: string; at: string | null }[] }>;
  leads: Section<{ total: number; list: { name: string; email: string; institution: string; at: string | null }[] }>;
  jobLinks: Section<{ total: number; live: number; views: number }>;
  teammates: Section<{ members: number; invitesOpen: number; invitesAccepted: number; invitesCancelled: number }>;
  files: Section<{ buckets: { bucket: string; count: number; bytes: number }[] }>;
  matches: Section<{ total: number; list: { id: string; outcome: string; createdAt: string }[] }>;
  pageViews: Section<{ total: number; portfolio: number; daily: Day[]; paths: { key: string; n: number }[]; referrers: { key: string; n: number }[] }>;
};

const LIST = 50;

export async function adminOverview(range: Range, now = Date.now()): Promise<Overview> {
  const admin = await requireAdmin();
  const store = getStore();
  const sinceDay = range === "all" ? null : daysFor(range, null, now)[0]!;
  const since = sinceDay ? `${sinceDay}T00:00:00.000Z` : null;

  // Each table loads on its own, so one that is missing on this database says so and the rest show.
  const load = async <T extends AdminTable>(t: T): Promise<{ rows: AdminRowMap[T]; truncated: boolean } | { error: string }> => {
    try {
      const r = await store.adminRows(admin.id, t, ALL_TIME_TABLES.includes(t) ? null : since);
      return { rows: r.rows as AdminRowMap[T], truncated: r.truncated };
    } catch (e) {
      // Shown as "could not load" and logged, so a timeout is not mistaken for a missing table.
      console.error(`admin: could not read ${t}:`, (e as Error).message);
      return { error: (e as Error).message };
    }
  };
  const [profiles, subs, roadmaps, exhbts, events, views, calls, ideas, saved, refs, wait, leads, links, members, invites, files, matches] = await Promise.all([
    load("profiles"), load("subscriptions"), load("roadmaps"), load("exhbts"), load("events"), load("pageViews"), load("aiCalls"), load("ideas"), load("savedIdeas"),
    load("referrals"), load("waitlist"), load("leads"), load("jobLinks"), load("members"), load("invites"), load("files"), load("matches"),
  ]);

  type Loaded = { rows: unknown; truncated: boolean } | { error: string };
  const build = <T>(needs: Loaded[], make: () => T): Section<T> => {
    for (const n of needs) if ("error" in n) return { ok: false, note: "Could not load this part. It may need a database update; the server log has the reason." };
    return { ok: true, data: make(), partial: needs.some((n) => "truncated" in n && n.truncated) };
  };
  const rowsOf = <R extends unknown[]>(l: { rows: R; truncated: boolean } | { error: string }): R => ("rows" in l ? l.rows : ([] as unknown as R));

  const emailOf = new Map(rowsOf(profiles).map((p) => [p.id, p.email]));
  const earliest = rowsOf(profiles).map((p) => p.createdAt).sort()[0] ?? null;
  const days = daysFor(range, earliest, now);
  const inRange = (at: string | null | undefined) => !since || (at ?? "") >= since;
  const evs = rowsOf(events);
  const count = (name: string) => evs.filter((e) => e.name === name).length;

  const planOfUser = (userId: string, institutionActive: boolean) => {
    const mine = rowsOf(subs).filter((s) => s.userId === userId); // newest first
    return accountPlan(mine, institutionActive, LIVE_SUBSCRIPTION_STATUSES);
  };

  const accounts = build([profiles, subs], () => {
    const plans: Plan[] = ["free", "premium", "max", "institutional"];
    const tally = new Map<Plan, { total: number; comp: number }>(plans.map((p) => [p, { total: 0, comp: 0 }]));
    for (const p of rowsOf(profiles)) {
      const { plan, comp } = planOfUser(p.id, p.institutionActive);
      const t = tally.get(plan)!;
      t.total += 1;
      if (comp) t.comp += 1;
    }
    return {
      total: rowsOf(profiles).length,
      inRange: rowsOf(profiles).filter((p) => inRange(p.createdAt)).length,
      daily: series(days, rowsOf(profiles).filter((p) => inRange(p.createdAt)).map((p) => p.createdAt)),
      byPlan: plans.map((plan) => ({ plan, ...tally.get(plan)! })),
    };
  });

  const roadmapSection = build([roadmaps, events, profiles], () => {
    const rs = rowsOf(roadmaps);
    const per = new Map<string, number>();
    for (const r of rs) if (r.userId) per.set(r.userId, (per.get(r.userId) ?? 0) + 1);
    const counts = [...per.values()];
    const done = evs.filter((e) => e.name === "roadmap_completed");
    return {
      total: rs.length,
      daily: series(days, rs.map((r) => r.createdAt)),
      perPerson: {
        one: counts.filter((c) => c === 1).length,
        two: counts.filter((c) => c === 2).length,
        threePlus: counts.filter((c) => c >= 3).length,
        signedOut: rs.filter((r) => !r.userId).length,
      },
      topUsers: [...per.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, 10)
        .map(([userId, n]) => ({ userId, email: emailOf.get(userId) ?? "unknown", n })),
      cached: done.filter((e) => e.cached === true).length,
      fresh: done.filter((e) => e.cached === false).length,
      failures: count("roadmap_failed"),
    };
  });

  const ideasSection = build([ideas, saved, events, roadmaps], () => {
    const rs = rowsOf(roadmaps);
    const known = rs.length === 0 || rs.some((r) => r.ideasFailedAt !== undefined);
    return {
      generated: rowsOf(ideas).length,
      swaps: count("project_swapped"),
      saved: rowsOf(saved).length,
      failures: count("ideas_failed"),
      roadmapsFailed: known ? rs.filter((r) => r.ideasFailedAt).length : null,
    };
  });

  const exhbtSection = build([exhbts, events], () => {
    const es = rowsOf(exhbts);
    const per = new Map<string, number>();
    for (const e of es.filter((x) => inRange(x.createdAt))) per.set(e.userId, (per.get(e.userId) ?? 0) + 1);
    const counts = [...per.values()];
    return {
      drafted: es.filter((e) => inRange(e.createdAt)).length,
      published: es.filter((e) => e.status === "published" && inRange(e.publishedAt)).length,
      people: per.size,
      perPerson: { one: counts.filter((c) => c === 1).length, two: counts.filter((c) => c === 2).length, threePlus: counts.filter((c) => c >= 3).length },
      aiDrafts: count("exhbt_drafted"),
      aiRewrites: count("exhbt_rewritten"),
    };
  });

  const aiSection = build([calls], () => {
    const cs = rowsOf(calls);
    const steps = new Map<string, { calls: number; costUsd: number; inputTokens: number; outputTokens: number }>();
    const byDay = new Map<string, Map<string, { calls: number; costUsd: number }>>();
    const cost = new Map<string, number>();
    for (const c of cs) {
      const s = steps.get(c.step) ?? { calls: 0, costUsd: 0, inputTokens: 0, outputTokens: 0 };
      s.calls += 1;
      s.costUsd += c.costUsd;
      s.inputTokens += c.inputTokens;
      s.outputTokens += c.outputTokens;
      steps.set(c.step, s);
      const d = dayOf(c.at);
      const m = byDay.get(d) ?? new Map();
      const x = m.get(c.step) ?? { calls: 0, costUsd: 0 };
      x.calls += 1;
      x.costUsd += c.costUsd;
      m.set(c.step, x);
      byDay.set(d, m);
      cost.set(d, (cost.get(d) ?? 0) + c.costUsd);
    }
    return {
      calls: cs.length,
      costUsd: cs.reduce((n, c) => n + c.costUsd, 0),
      inputTokens: cs.reduce((n, c) => n + c.inputTokens, 0),
      outputTokens: cs.reduce((n, c) => n + c.outputTokens, 0),
      dailyCost: days.map((day) => ({ day, n: cost.get(day) ?? 0 })),
      steps: [...steps.entries()].map(([step, v]) => ({ step, ...v })).sort((a, b) => b.costUsd - a.costUsd),
      byDay: [...byDay.entries()]
        .sort((a, b) => b[0].localeCompare(a[0]))
        .map(([day, m]) => ({ day, steps: [...m.entries()].map(([step, v]) => ({ step, ...v })).sort((a, b) => a.step.localeCompare(b.step)) })),
    };
  });

  const subsSection = build([subs], () => {
    // Newest subscription per account counts once, as in planFor.
    const seen = new Set<string>();
    const live = rowsOf(subs).filter((s) => {
      if (!LIVE_SUBSCRIPTION_STATUSES.includes(s.status) || seen.has(s.userId)) return false;
      seen.add(s.userId);
      return true;
    });
    const plans: Plan[] = ["premium", "max", "institutional", "free"];
    const active = plans
      .map((plan) => ({
        plan,
        paying: live.filter((s) => s.plan === plan && !(s.subscriptionId ?? "").startsWith("comp_")).length,
        comp: live.filter((s) => s.plan === plan && (s.subscriptionId ?? "").startsWith("comp_")).length,
      }))
      .filter((r) => r.paying + r.comp > 0);
    return { active, activeTotal: live.length };
  });

  const refSection = build([refs, profiles], () => {
    const rs = rowsOf(refs);
    return {
      pending: rs.filter((r) => r.status === "pending").length,
      earned: rs.filter((r) => r.status === "earned").length,
      credited: rs.filter((r) => r.status === "credited").length,
      list: rs.slice(0, LIST).map((r) => ({ id: r.id, referrer: emailOf.get(r.referrerId) ?? "unknown", referred: r.referredId ? (emailOf.get(r.referredId) ?? "unknown") : "deleted account", status: r.status, createdAt: r.createdAt })),
    };
  });

  const sortByAt = <T extends { at: string | null }>(l: T[]) => [...l].sort((a, b) => (b.at ?? "").localeCompare(a.at ?? ""));

  return {
    range,
    since,
    days,
    accounts,
    roadmaps: roadmapSection,
    ideas: ideasSection,
    exhbts: exhbtSection,
    ai: aiSection,
    subscriptions: subsSection,
    referrals: refSection,
    waitlist: build([wait], () => ({ total: rowsOf(wait).length, list: sortByAt(rowsOf(wait)).slice(0, LIST) })),
    leads: build([leads], () => ({ total: rowsOf(leads).length, list: sortByAt(rowsOf(leads)).slice(0, LIST) })),
    jobLinks: build([links], () => ({ total: rowsOf(links).length, live: rowsOf(links).filter((l) => l.status === "live").length, views: rowsOf(links).reduce((n, l) => n + l.views, 0) })),
    teammates: build([members, invites], () => ({
      members: rowsOf(members).length,
      invitesOpen: rowsOf(invites).filter((i) => !i.accepted && !i.cancelled).length,
      invitesAccepted: rowsOf(invites).filter((i) => i.accepted).length,
      invitesCancelled: rowsOf(invites).filter((i) => i.cancelled).length,
    })),
    files: build([files], () => {
      const by = new Map<string, { count: number; bytes: number }>();
      for (const f of rowsOf(files)) {
        const b = by.get(f.bucket) ?? { count: 0, bytes: 0 };
        b.count += 1;
        b.bytes += f.bytes;
        by.set(f.bucket, b);
      }
      return { buckets: [...by.entries()].map(([bucket, v]) => ({ bucket, ...v })).sort((a, b) => a.bucket.localeCompare(b.bucket)) };
    }),
    matches: build([matches], () => ({ total: rowsOf(matches).length, list: rowsOf(matches).slice(0, LIST) })),
    pageViews: build([views], () => {
      const vs = rowsOf(views);
      return {
        total: vs.length,
        portfolio: vs.filter((v) => v.isPortfolio).length,
        daily: series(days, vs.map((v) => v.at)),
        paths: top(vs.map((v) => v.path), 10),
        referrers: top(vs.filter((v) => v.referrer).map((v) => v.referrer), 10),
      };
    }),
  };
}

export const ACCOUNTS_PAGE_SIZE = 25;

export async function adminAccountsPage(q: string, page: number): Promise<AdminAccountsPage> {
  const admin = await requireAdmin();
  return getStore().adminAccounts(admin.id, { q, page: Math.max(1, Math.floor(page) || 1), pageSize: ACCOUNTS_PAGE_SIZE });
}

export async function adminAccountDetail(userId: string): Promise<AdminAccountDetail | null> {
  const admin = await requireAdmin();
  return getStore().adminAccount(admin.id, userId);
}
