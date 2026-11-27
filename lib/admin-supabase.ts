import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ADMIN_ROW_CAP,
  accountPlan,
  cleanQuery,
  type AdminAccountDetail,
  type AdminAccountRow,
  type AdminAccountsPage,
  type AdminPublishNumbers,
  type AdminRowMap,
  type AdminRows,
  type AdminTable,
} from "./admin-types";

/**
 * The Supabase side of the admin reads (decision 0021). PostgREST returns at most 1,000 rows a
 * request and can't group, so each table is read in pages of lean columns and counted in
 * lib/admin.ts. Past ADMIN_ROW_CAP rows the read stops and says so (`truncated`).
 */

type Res = { data: unknown; error: { message: string } | null };
type PlanName = AdminRowMap["subscriptions"][number]["plan"];
const PAGE = 1000;

async function readAll<T>(build: (from: number, to: number) => PromiseLike<Res>): Promise<{ rows: T[]; truncated: boolean }> {
  const out: T[] = [];
  for (let from = 0; from < ADMIN_ROW_CAP; from += PAGE) {
    const res = await build(from, from + PAGE - 1);
    if (res.error) throw new Error(res.error.message);
    const page = (res.data ?? []) as T[];
    out.push(...page);
    if (page.length < PAGE) return { rows: out, truncated: false };
  }
  return { rows: out, truncated: true };
}

const num = (v: unknown) => Number(v ?? 0);

const roleChecks = new WeakMap<SupabaseClient, Map<string, Promise<boolean>>>();

/** One role lookup per client and account: every method still checks, but a request pays once. */
export function sbIsAdmin(db: SupabaseClient, userId: string): Promise<boolean> {
  const seen = roleChecks.get(db) ?? new Map<string, Promise<boolean>>();
  roleChecks.set(db, seen);
  let p = seen.get(userId);
  if (!p) {
    p = (async () => {
      const { data } = await db.from("profiles").select("role").eq("id", userId).maybeSingle();
      return (data as { role?: string } | null)?.role === "exhbt_admin";
    })();
    seen.set(userId, p);
  }
  return p;
}

/** N1 and N2 from exhbts.published_at (set on a publish and kept when an exhbt is unpublished), over every account. */
export async function sbPublishNumbers(db: SupabaseClient): Promise<AdminPublishNumbers> {
  const accounts = await db.from("profiles").select("id", { count: "exact", head: true });
  if (accounts.error) throw new Error(accounts.error.message);
  type R = { user_id: string | null };
  const r = await readAll<R>((a, b) => db.from("exhbts").select("user_id").not("published_at", "is", null).order("id").range(a, b));
  const per = new Map<string, number>();
  for (const e of r.rows) if (e.user_id) per.set(e.user_id, (per.get(e.user_id) ?? 0) + 1);
  const counts = [...per.values()];
  return { accounts: accounts.count ?? 0, first: counts.filter((c) => c >= 1).length, second: counts.filter((c) => c >= 2).length, partial: r.truncated };
}

export async function sbAdminRows<T extends AdminTable>(db: SupabaseClient, table: T, since: string | null): Promise<AdminRows<T>> {
  return (await read(db, table, since)) as AdminRows<T>;
}

type Out = { rows: unknown[]; truncated: boolean };

async function read(db: SupabaseClient, table: AdminTable, since: string | null): Promise<Out> {
  // Narrow a query to the date range. Typed loosely: supabase-js builders share this one method.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ranged = (q: any, col = "created_at") => (since ? q.gte(col, since) : q);
  switch (table) {
    case "profiles": {
      type R = { id: string; email: string; created_at: string; username: string | null; role: string; institution_id: string | null; institutions: { licence_end: string | null } | null };
      const r = await readAll<R>((a, b) =>
        db.from("profiles").select("id, email, created_at, username, role, institution_id, institutions(licence_end)").order("created_at", { ascending: false }).order("id").range(a, b),
      );
      return {
        truncated: r.truncated,
        rows: r.rows.map((p): AdminRowMap["profiles"][number] => ({
          id: p.id,
          email: p.email,
          createdAt: p.created_at,
          username: p.username,
          role: p.role,
          institutionActive: Boolean(p.institution_id) && (!p.institutions?.licence_end || Date.parse(p.institutions.licence_end) >= Date.now()),
        })),
      };
    }
    case "subscriptions": {
      type R = { user_id: string; plan: PlanName; status: string; provider_subscription_id: string | null; created_at: string };
      const r = await readAll<R>((a, b) =>
        db.from("subscriptions").select("user_id, plan, status, provider_subscription_id, created_at").order("created_at", { ascending: false }).order("id").range(a, b),
      );
      return { truncated: r.truncated, rows: r.rows.map((s) => ({ userId: s.user_id, plan: s.plan, status: s.status, subscriptionId: s.provider_subscription_id, createdAt: s.created_at })) };
    }
    case "roadmaps": {
      type R = { id: string; user_id: string | null; created_at: string; project_swaps_used: number | null; ideas_failed_at?: string | null };
      const go = (cols: string) => readAll<R>((a, b) => ranged(db.from("roadmaps").select(cols)).order("created_at", { ascending: false }).order("id").range(a, b));
      let hasFailed = true;
      let r: { rows: R[]; truncated: boolean };
      try {
        r = await go("id, user_id, created_at, project_swaps_used, ideas_failed_at");
      } catch {
        // The ideas columns come in a later migration; an older database still gets the rest.
        hasFailed = false;
        r = await go("id, user_id, created_at, project_swaps_used");
      }
      return {
        truncated: r.truncated,
        rows: r.rows.map((x) => ({ id: x.id, userId: x.user_id, createdAt: x.created_at, ideasFailedAt: hasFailed ? (x.ideas_failed_at ?? null) : undefined, swaps: num(x.project_swaps_used) })),
      };
    }
    case "exhbts": {
      type R = { id: string; user_id: string; status: string; created_at: string; published_at: string | null };
      const r = await readAll<R>((a, b) => {
        const q = db.from("exhbts").select("id, user_id, status, created_at, published_at");
        return (since ? q.or(`created_at.gte.${since},published_at.gte.${since}`) : q).order("created_at", { ascending: false }).order("id").range(a, b);
      });
      return {
        truncated: r.truncated,
        rows: r.rows.map((e) => ({ id: e.id, userId: e.user_id, status: e.status === "published" ? "published" : "draft", createdAt: e.created_at, publishedAt: e.published_at })),
      };
    }
    case "events": {
      type R = { name: string; user_id: string | null; created_at: string; cached: string | null; reason: string | null; tin: string | null; tout: string | null };
      const r = await readAll<R>((a, b) =>
        ranged(db.from("events").select("name, user_id, created_at, cached:props->>cached, reason:props->>reason, tin:props->>inputTokens, tout:props->>outputTokens").neq("name", "page_view"))
          .order("created_at", { ascending: false })
          .order("id")
          .range(a, b),
      );
      const n = (v: string | null) => (v === null || !Number.isFinite(Number(v)) ? null : Number(v));
      return {
        truncated: r.truncated,
        rows: r.rows.map((e) => ({ name: e.name, userId: e.user_id, at: e.created_at, cached: e.cached === null ? null : e.cached === "true", reason: e.reason, inputTokens: n(e.tin), outputTokens: n(e.tout) })),
      };
    }
    case "pageViews": {
      type R = { created_at: string; path: string | null; referrer: string | null; portfolio: string | null };
      const r = await readAll<R>((a, b) =>
        ranged(db.from("events").select("created_at, path:props->>path, referrer:props->>referrer, portfolio:props->>is_portfolio").eq("name", "page_view"))
          .order("created_at", { ascending: false })
          .order("id")
          .range(a, b),
      );
      return { truncated: r.truncated, rows: r.rows.map((v) => ({ at: v.created_at, path: v.path ?? "/", referrer: v.referrer ?? "", isPortfolio: v.portfolio === "true" })) };
    }
    case "aiCalls": {
      type R = { user_id: string | null; step: string; model: string; input_tokens: number; output_tokens: number; cost_usd: number | string; created_at: string };
      const r = await readAll<R>((a, b) =>
        ranged(db.from("ai_call_logs").select("user_id, step, model, input_tokens, output_tokens, cost_usd, created_at")).order("created_at", { ascending: false }).order("id").range(a, b),
      );
      return {
        truncated: r.truncated,
        rows: r.rows.map((c) => ({ userId: c.user_id, step: c.step, model: c.model, inputTokens: num(c.input_tokens), outputTokens: num(c.output_tokens), costUsd: num(c.cost_usd), at: c.created_at })),
      };
    }
    case "ideas": {
      const r = await readAll<{ created_at: string; source: "roadmap" | "swap" }>((a, b) =>
        ranged(db.from("project_ideas").select("created_at, source")).order("created_at", { ascending: false }).order("id").range(a, b),
      );
      return { truncated: r.truncated, rows: r.rows.map((i) => ({ at: i.created_at, source: i.source })) };
    }
    case "savedIdeas": {
      const r = await readAll<{ created_at: string }>((a, b) => ranged(db.from("saved_ideas").select("created_at")).order("created_at", { ascending: false }).order("id").range(a, b));
      return { truncated: r.truncated, rows: r.rows.map((i) => ({ at: i.created_at })) };
    }
    case "referrals": {
      type R = { id: string; referrer_id: string; referred_id: string | null; status: "pending" | "earned" | "credited"; created_at: string };
      const r = await readAll<R>((a, b) =>
        ranged(db.from("referrals").select("id, referrer_id, referred_id, status, created_at")).order("created_at", { ascending: false }).order("id").range(a, b),
      );
      return { truncated: r.truncated, rows: r.rows.map((x) => ({ id: x.id, referrerId: x.referrer_id, referredId: x.referred_id, status: x.status, createdAt: x.created_at })) };
    }
    case "waitlist": {
      const r = await readAll<{ email: string; interest: string; source: string; created_at: string }>((a, b) =>
        ranged(db.from("waitlist").select("email, interest, source, created_at")).order("created_at", { ascending: false }).order("id").range(a, b),
      );
      return { truncated: r.truncated, rows: r.rows.map((w) => ({ email: w.email, interest: w.interest, source: w.source, at: w.created_at })) };
    }
    case "leads": {
      const r = await readAll<{ name: string; email: string; institution: string; created_at: string }>((a, b) =>
        ranged(db.from("leads").select("name, email, institution, created_at")).order("created_at", { ascending: false }).order("id").range(a, b),
      );
      return { truncated: r.truncated, rows: r.rows.map((l) => ({ name: l.name, email: l.email, institution: l.institution, at: l.created_at })) };
    }
    case "jobLinks": {
      const r = await readAll<{ user_id: string; status: string; view_count: number | null; created_at: string }>((a, b) =>
        db.from("curated_links").select("user_id, status, view_count, created_at").order("created_at", { ascending: false }).order("id").range(a, b),
      );
      return { truncated: r.truncated, rows: r.rows.map((l) => ({ userId: l.user_id, status: l.status, views: num(l.view_count), createdAt: l.created_at })) };
    }
    case "members": {
      const r = await readAll<{ exhbt_id: string; user_id: string; added_at: string }>((a, b) =>
        db.from("exhbt_members").select("exhbt_id, user_id, added_at").order("added_at", { ascending: false }).order("exhbt_id").order("user_id").range(a, b),
      );
      return { truncated: r.truncated, rows: r.rows.map((m) => ({ exhbtId: m.exhbt_id, userId: m.user_id, addedAt: m.added_at })) };
    }
    case "invites": {
      const r = await readAll<{ accepted_at: string | null; cancelled_at: string | null; created_at: string }>((a, b) =>
        db.from("exhbt_invites").select("accepted_at, cancelled_at, created_at").order("created_at", { ascending: false }).order("id").range(a, b),
      );
      return { truncated: r.truncated, rows: r.rows.map((i) => ({ accepted: Boolean(i.accepted_at), cancelled: Boolean(i.cancelled_at), createdAt: i.created_at })) };
    }
    case "files": {
      const r = await readAll<{ bucket: string; bytes: number }>((a, b) => db.from("exhbt_files").select("bucket, bytes").order("created_at", { ascending: false }).order("id").range(a, b));
      return { truncated: r.truncated, rows: r.rows.map((f) => ({ bucket: f.bucket, bytes: num(f.bytes) })) };
    }
    case "matches": {
      const r = await readAll<{ id: string; outcome: string; created_at: string }>((a, b) =>
        ranged(db.from("duplicate_matches").select("id, outcome, created_at")).order("created_at", { ascending: false }).order("id").range(a, b),
      );
      return { truncated: r.truncated, rows: r.rows.map((m) => ({ id: m.id, outcome: m.outcome, createdAt: m.created_at })) };
    }
  }
}

/* ---------------- Accounts ---------------- */

type Sub = { plan: PlanName; status: string; subscriptionId: string | null };

async function plansFor(db: SupabaseClient, ids: string[], institutional: Set<string>, live: string[]): Promise<Map<string, { plan: PlanName; comp: boolean }>> {
  const out = new Map<string, { plan: PlanName; comp: boolean }>();
  if (!ids.length) return out;
  const res = await db.from("subscriptions").select("user_id, plan, status, provider_subscription_id").in("user_id", ids).order("created_at", { ascending: false });
  if (res.error) throw new Error(res.error.message);
  const by = new Map<string, Sub[]>();
  for (const s of (res.data ?? []) as { user_id: string; plan: PlanName; status: string; provider_subscription_id: string | null }[]) {
    const list = by.get(s.user_id) ?? [];
    list.push({ plan: s.plan, status: s.status, subscriptionId: s.provider_subscription_id });
    by.set(s.user_id, list);
  }
  for (const id of ids) out.set(id, accountPlan(by.get(id) ?? [], institutional.has(id), live));
  return out;
}

const latest = (a: string | null, b: string | null) => (!a ? b : !b ? a : a > b ? a : b);

export async function sbAdminAccounts(db: SupabaseClient, opts: { q: string; page: number; pageSize: number; id?: string }, live: string[]): Promise<AdminAccountsPage> {
  const q = cleanQuery(opts.q);
  const page = Math.max(1, opts.page);
  const from = (page - 1) * opts.pageSize;
  let query = db
    .from("profiles")
    .select("id, email, created_at, username, institution_id, institutions(licence_end)", { count: "exact" })
    .order("created_at", { ascending: false })
    .order("id")
    .range(from, from + opts.pageSize - 1);
  if (opts.id) query = query.eq("id", opts.id);
  else if (q) query = query.or(`email.ilike.%${q}%,username.ilike.%${q}%`);
  const res = await query;
  if (res.error) throw new Error(res.error.message);
  type P = { id: string; email: string; created_at: string; username: string | null; institution_id: string | null; institutions: { licence_end: string | null } | null };
  const people = (res.data ?? []) as unknown as P[];
  const ids = people.map((p) => p.id);
  const institutional = new Set(people.filter((p) => p.institution_id && (!p.institutions?.licence_end || Date.parse(p.institutions.licence_end) >= Date.now())).map((p) => p.id));
  const none = Promise.resolve({ data: [], error: null } as Res);
  const [plans, rm, ex, ev] = await Promise.all([
    plansFor(db, ids, institutional, live),
    ids.length ? db.from("roadmaps").select("user_id, created_at").in("user_id", ids) : none,
    ids.length ? db.from("exhbts").select("user_id, updated_at").in("user_id", ids) : none,
    ids.length ? db.from("events").select("user_id, created_at").in("user_id", ids).neq("name", "page_view").order("created_at", { ascending: false }).limit(2000) : none,
  ]);
  for (const r of [rm, ex, ev]) if (r.error) throw new Error(r.error.message);
  const roadmaps = new Map<string, number>();
  const exhbts = new Map<string, number>();
  const last = new Map<string, string | null>();
  for (const r of (rm.data ?? []) as { user_id: string; created_at: string }[]) {
    roadmaps.set(r.user_id, (roadmaps.get(r.user_id) ?? 0) + 1);
    last.set(r.user_id, latest(last.get(r.user_id) ?? null, r.created_at));
  }
  for (const r of (ex.data ?? []) as { user_id: string; updated_at: string }[]) {
    exhbts.set(r.user_id, (exhbts.get(r.user_id) ?? 0) + 1);
    last.set(r.user_id, latest(last.get(r.user_id) ?? null, r.updated_at));
  }
  for (const r of (ev.data ?? []) as { user_id: string; created_at: string }[]) last.set(r.user_id, latest(last.get(r.user_id) ?? null, r.created_at));
  const rows: AdminAccountRow[] = people.map((p) => ({
    id: p.id,
    email: p.email,
    createdAt: p.created_at,
    plan: plans.get(p.id)?.plan ?? "free",
    comp: plans.get(p.id)?.comp ?? false,
    username: p.username,
    roadmaps: roadmaps.get(p.id) ?? 0,
    exhbts: exhbts.get(p.id) ?? 0,
    lastActive: last.get(p.id) ?? null,
  }));
  return { rows, total: res.count ?? rows.length, page, pageSize: opts.pageSize };
}

export async function sbAdminAccount(db: SupabaseClient, userId: string, live: string[]): Promise<AdminAccountDetail | null> {
  if (!/^[0-9a-f-]{36}$/.test(userId)) return null;
  const one = await db.from("profiles").select("id, email, created_at, username, role").eq("id", userId).maybeSingle();
  if (one.error) throw new Error(one.error.message);
  if (!one.data) return null;
  const p = one.data as { id: string; email: string; created_at: string; username: string | null; role: string };
  // The ideas flag is a later column; an older database gets the list without it.
  const roadmapRows = async (): Promise<{ id: string; created_at: string; ideas_failed_at: string | null | undefined }[]> => {
    const full = await db.from("roadmaps").select("id, created_at, ideas_failed_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(200);
    if (!full.error) return (full.data ?? []) as { id: string; created_at: string; ideas_failed_at: string | null }[];
    const plain = await db.from("roadmaps").select("id, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(200);
    if (plain.error) throw new Error(plain.error.message);
    return ((plain.data ?? []) as { id: string; created_at: string }[]).map((r) => ({ ...r, ideas_failed_at: undefined }));
  };
  const [rm, ex, ev, ai, fl, row] = await Promise.all([
    roadmapRows(),
    db.from("exhbts").select("id, status, created_at, updated_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(200),
    db.from("events").select("name, created_at").eq("user_id", userId).neq("name", "page_view").order("created_at", { ascending: false }).limit(100),
    db.from("ai_call_logs").select("cost_usd").eq("user_id", userId).limit(5000),
    db.from("exhbt_files").select("bytes").eq("user_id", userId).limit(5000),
    sbAdminAccounts(db, { q: "", page: 1, pageSize: 1, id: userId }, live),
  ]);
  for (const r of [ex, ev, ai, fl]) if (r.error) throw new Error(r.error.message);
  const base = row.rows.find((r) => r.id === userId);
  if (!base) return null;
  const files = (fl.data ?? []) as { bytes: number }[];
  const calls = (ai.data ?? []) as { cost_usd: number | string }[];
  return {
    ...base,
    role: p.role,
    roadmapList: rm.map((r) => ({ id: r.id, createdAt: r.created_at, ideasFailed: r.ideas_failed_at === undefined ? null : Boolean(r.ideas_failed_at) })),
    exhbtList: ((ex.data ?? []) as { id: string; status: string; created_at: string }[]).map((e) => ({ id: e.id, status: e.status, createdAt: e.created_at })),
    events: ((ev.data ?? []) as { name: string; created_at: string }[]).map((e) => ({ name: e.name, at: e.created_at })),
    aiCalls: calls.length,
    aiCostUsd: calls.reduce((n, c) => n + num(c.cost_usd), 0),
    files: files.length,
    fileBytes: files.reduce((n, f) => n + num(f.bytes), 0),
  };
}
