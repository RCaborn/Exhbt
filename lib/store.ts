import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Roadmap, RoadmapInput } from "./ai/schemas";

export type RoadmapRecord = {
  id: string;
  userId: string | null;
  pendingEmail: string | null;
  input: RoadmapInput;
  inputHash: string;
  output: Roadmap | null;
  createdAt: string;
};

export type AICall = {
  userId: string | null;
  step: "roadmap" | "pack_draft" | "originality" | "link_ranking";
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
};

export type EventName =
  | "signup_started"
  | "signup_completed"
  | "roadmap_completed"
  | "upgrade_clicked"
  | "lead_submitted";

export interface Store {
  createPendingRoadmap(email: string, input: RoadmapInput, inputHash: string): Promise<string>;
  countRecentRoadmaps(email: string, hours: number): Promise<number>;
  claimPendingRoadmaps(email: string, userId: string): Promise<void>;
  getRoadmap(id: string): Promise<RoadmapRecord | null>;
  latestRoadmapFor(userId: string): Promise<RoadmapRecord | null>;
  findCachedOutput(inputHash: string): Promise<Roadmap | null>;
  saveRoadmapOutput(id: string, output: Roadmap): Promise<void>;
  logAICall(call: AICall): Promise<void>;
  logEvent(name: EventName, userId: string | null, props?: Record<string, unknown>): Promise<void>;
  createLead(lead: { name: string; email: string; institution: string; message: string }): Promise<void>;
  exportUserData(userId: string): Promise<Record<string, unknown>>;
  deleteUserData(userId: string): Promise<void>;
}

export const isSupabaseConfigured = () =>
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

export function getStore(): Store {
  return isSupabaseConfigured() ? supabaseStore() : memoryStore();
}

/* ---------------- Supabase (production) ---------------- */

function admin(): SupabaseClient {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
}

type RoadmapRow = {
  id: string;
  user_id: string | null;
  pending_email: string | null;
  input_json: RoadmapInput;
  input_hash: string;
  output_json: Roadmap | null;
  created_at: string;
};

const fromRow = (r: RoadmapRow): RoadmapRecord => ({
  id: r.id,
  userId: r.user_id,
  pendingEmail: r.pending_email,
  input: r.input_json,
  inputHash: r.input_hash,
  output: r.output_json,
  createdAt: r.created_at,
});

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

function supabaseStore(): Store {
  const db = admin();
  return {
    async createPendingRoadmap(email, input, inputHash) {
      const row = check(
        await db
          .from("roadmaps")
          .insert({ pending_email: email, input_json: input, input_hash: inputHash })
          .select("id")
          .single(),
      );
      return (row as { id: string }).id;
    },
    async countRecentRoadmaps(email, hours) {
      const since = new Date(Date.now() - hours * 3_600_000).toISOString();
      const res = await db
        .from("roadmaps")
        .select("id", { count: "exact", head: true })
        .eq("pending_email", email)
        .gte("created_at", since);
      if (res.error) throw new Error(res.error.message);
      return res.count ?? 0;
    },
    async claimPendingRoadmaps(email, userId) {
      check(await db.from("roadmaps").update({ user_id: userId }).eq("pending_email", email).is("user_id", null));
    },
    async getRoadmap(id) {
      const res = await db.from("roadmaps").select("*").eq("id", id).maybeSingle();
      const row = check(res) as RoadmapRow | null;
      return row ? fromRow(row) : null;
    },
    async latestRoadmapFor(userId) {
      const res = await db
        .from("roadmaps")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const row = check(res) as RoadmapRow | null;
      return row ? fromRow(row) : null;
    },
    async findCachedOutput(inputHash) {
      const res = await db
        .from("roadmaps")
        .select("output_json")
        .eq("input_hash", inputHash)
        .not("output_json", "is", null)
        .limit(1)
        .maybeSingle();
      return (check(res) as { output_json: Roadmap } | null)?.output_json ?? null;
    },
    async saveRoadmapOutput(id, output) {
      check(await db.from("roadmaps").update({ output_json: output }).eq("id", id));
    },
    async logAICall(c) {
      check(
        await db.from("ai_call_logs").insert({
          user_id: c.userId,
          step: c.step,
          model: c.model,
          input_tokens: c.inputTokens,
          output_tokens: c.outputTokens,
          cost_usd: c.costUsd,
        }),
      );
    },
    async logEvent(name, userId, props = {}) {
      // Analytics must never break a user flow.
      const { error } = await db.from("events").insert({ name, user_id: userId, props });
      if (error) console.error("event log failed", error.message);
    },
    async createLead(lead) {
      check(await db.from("leads").insert(lead));
    },
    async exportUserData(userId) {
      const [profile, roadmaps, packs, links, subs] = await Promise.all([
        db.from("profiles").select("*").eq("id", userId).maybeSingle(),
        db.from("roadmaps").select("*").eq("user_id", userId),
        db.from("packs").select("*").eq("user_id", userId),
        db.from("curated_links").select("*").eq("user_id", userId),
        db.from("subscriptions").select("*").eq("user_id", userId),
      ]);
      return {
        exportedAt: new Date().toISOString(),
        profile: profile.data,
        roadmaps: roadmaps.data,
        packs: packs.data,
        curatedLinks: links.data,
        subscriptions: subs.data,
      };
    },
    async deleteUserData(userId) {
      // Deleting the auth user cascades to profiles and everything owned by it.
      const { error } = await db.auth.admin.deleteUser(userId);
      if (error) throw new Error(error.message);
    },
  };
}

/* ---------------- In-memory (local development only) ---------------- */

type Mem = {
  roadmaps: Map<string, RoadmapRecord>;
  aiCalls: AICall[];
  events: { name: string; userId: string | null; props: Record<string, unknown>; at: string }[];
  leads: unknown[];
};
const newMem = (): Mem => ({ roadmaps: new Map(), aiCalls: [], events: [], leads: [] });
const g = globalThis as unknown as { __exhbtMem?: Mem };

function memoryStore(): Store {
  if (process.env.NODE_ENV === "production" && !process.env.EXHBT_ALLOW_MEMORY_STORE) {
    throw new Error("Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  }
  const m = (g.__exhbtMem ??= newMem());
  return {
    async createPendingRoadmap(email, input, inputHash) {
      const id = crypto.randomUUID();
      m.roadmaps.set(id, {
        id,
        userId: null,
        pendingEmail: email,
        input,
        inputHash,
        output: null,
        createdAt: new Date().toISOString(),
      });
      return id;
    },
    async countRecentRoadmaps(email, hours) {
      const since = Date.now() - hours * 3_600_000;
      return [...m.roadmaps.values()].filter(
        (r) => r.pendingEmail === email && Date.parse(r.createdAt) >= since,
      ).length;
    },
    async claimPendingRoadmaps(email, userId) {
      for (const r of m.roadmaps.values()) if (r.pendingEmail === email && !r.userId) r.userId = userId;
    },
    async getRoadmap(id) {
      return m.roadmaps.get(id) ?? null;
    },
    async latestRoadmapFor(userId) {
      return (
        [...m.roadmaps.values()]
          .filter((r) => r.userId === userId)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null
      );
    },
    async findCachedOutput(inputHash) {
      return [...m.roadmaps.values()].find((r) => r.inputHash === inputHash && r.output)?.output ?? null;
    },
    async saveRoadmapOutput(id, output) {
      const r = m.roadmaps.get(id);
      if (r) r.output = output;
    },
    async logAICall(c) {
      m.aiCalls.push(c);
    },
    async logEvent(name, userId, props = {}) {
      m.events.push({ name, userId, props, at: new Date().toISOString() });
    },
    async createLead(lead) {
      m.leads.push(lead);
    },
    async exportUserData(userId) {
      return { roadmaps: [...m.roadmaps.values()].filter((r) => r.userId === userId) };
    },
    async deleteUserData(userId) {
      for (const [id, r] of m.roadmaps) if (r.userId === userId) m.roadmaps.delete(id);
    },
  };
}

/** Debug view for local tests only. */
export function memorySnapshot() {
  return g.__exhbtMem;
}
