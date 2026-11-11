import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Project, Roadmap, RoadmapInput } from "./ai/schemas";

export type RoadmapRecord = {
  id: string;
  userId: string | null;
  /** Known once the person reaches the project-ideas gate, or at creation when signed in. */
  pendingEmail: string | null;
  pendingName: string | null;
  pendingLinkedin: string | null;
  input: RoadmapInput;
  inputHash: string;
  output: Roadmap | null;
  emailSentAt: string | null;
  projectsUnlockedAt: string | null;
  projectSwapsUsed: number;
  /** Set when they keep their plan, or use their last swap. */
  planConfirmedAt: string | null;
  createdAt: string;
};

export type NewRoadmap = {
  /** Null for a signed-out builder: the email is asked for at the project-ideas gate. */
  email: string | null;
  input: RoadmapInput;
  inputHash: string;
  ipHash: string;
};

/** What the project-ideas gate collects (docs/decisions/0004). */
export type UnlockDetails = { email: string; name: string; linkedin: string | null; marketingOptIn: boolean };

/** One of the three ideas in a roadmap's plan. Its own record, so a swap stays with this person. */
export type ProjectIdea = Project & {
  id: string;
  /** The slot in the plan, 0-2. */
  position: number;
  source: "roadmap" | "swap";
  /** How many times this slot has been regenerated. */
  swapsUsed: number;
};

/** Outcome of trying to start AI generation for a roadmap. */
export type GenerationClaim = "run" | "ready" | "busy";

export type AICall = {
  userId: string | null;
  step: "roadmap" | "exhbt_draft" | "originality" | "link_ranking" | "project_ideas";
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
};

export type EventName =
  | "signup_started"
  | "signup_completed"
  | "roadmap_completed"
  | "roadmap_failed"
  | "roadmap_emailed"
  | "upgrade_clicked"
  | "lead_submitted"
  | "waitlist_joined"
  | "unsubscribed"
  | "projects_gate_viewed"
  | "projects_unlocked"
  | "project_swapped"
  | "plan_kept";

export type WaitlistInterest = "plus" | "premium" | "university";

/**
 * Everything the app persists goes through this interface. Two implementations:
 * Supabase (production) and in-memory (local development, tests). Add a method here
 * first, then to both implementations.
 */
export interface Store {
  createRoadmap(r: NewRoadmap): Promise<string>;
  countRecentRoadmaps(email: string, hours: number): Promise<number>;
  countRecentByIpHash(ipHash: string, hours: number): Promise<number>;
  claimPendingRoadmaps(email: string, userId: string): Promise<void>;
  getRoadmap(id: string): Promise<RoadmapRecord | null>;
  latestRoadmapFor(userId: string): Promise<RoadmapRecord | null>;
  findCachedOutput(inputHash: string): Promise<Roadmap | null>;
  saveRoadmapOutput(id: string, output: Roadmap): Promise<void>;
  /**
   * Claims the right to generate for this roadmap. `run` = this caller should call the model;
   * `ready` = output is already saved; `busy` = another caller is generating (retry shortly).
   * Stale claims older than two minutes can be taken over.
   */
  claimGeneration(id: string): Promise<GenerationClaim>;
  /** Clears a generation claim after a failed attempt so a retry can run. */
  clearGenerationClaim(id: string): Promise<void>;
  /** Atomically marks the roadmap email as sent. Returns false if it was already sent. */
  markEmailSent(id: string): Promise<boolean>;
  setMarketingOptIn(email: string, optIn: boolean): Promise<void>;
  /** Records the gate's details. The email is set only if the roadmap has none yet. */
  unlockRoadmap(id: string, details: UnlockDetails): Promise<void>;
  /** A roadmap's plan ideas, in slot order. */
  listProjectIdeas(roadmapId: string): Promise<ProjectIdea[]>;
  /** Adds a roadmap's first ideas (up to three), once: does nothing if it already has some. */
  seedProjectIdeas(roadmapId: string, ideas: Project[]): Promise<void>;
  /**
   * Replaces one idea in place and counts that idea's swap. Returns false when that idea has
   * already used `perIdeaLimit` swaps, the plan is confirmed, or another swap won a race.
   */
  swapProjectIdea(roadmapId: string, ideaId: string, idea: Project, perIdeaLimit: number): Promise<boolean>;
  /** Keeps the plan as it is: no more swaps. */
  confirmPlan(roadmapId: string): Promise<void>;
  logAICall(call: AICall): Promise<void>;
  logEvent(name: EventName, userId: string | null, props?: Record<string, unknown>): Promise<void>;
  createLead(lead: { name: string; email: string; institution: string; message: string }): Promise<void>;
  /** Idempotent: joining twice with the same email and interest is a no-op. */
  joinWaitlist(entry: { email: string; interest: WaitlistInterest; source: string }): Promise<void>;
  /**
   * Shared sliding-window limiter. Records this attempt and returns true when it is still
   * under `limit` inside `windowSeconds`; false when the window is full.
   */
  takeRateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean>;
  exportUserData(userId: string): Promise<Record<string, unknown>>;
  deleteUserData(userId: string): Promise<void>;
}

export const isSupabaseConfigured = () =>
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

export function getStore(): Store {
  return isSupabaseConfigured() ? supabaseStore() : memoryStore();
}

/** Claims older than this can be stolen after a crashed Worker. */
const GENERATION_STALE_MS = 2 * 60_000;

/* ---------------- Supabase (production) ---------------- */

export function supabaseAdmin(): SupabaseClient {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
}

type RoadmapRow = {
  id: string;
  user_id: string | null;
  pending_email: string | null;
  pending_name: string | null;
  pending_linkedin: string | null;
  input_json: RoadmapInput;
  input_hash: string;
  output_json: Roadmap | null;
  email_sent_at: string | null;
  projects_unlocked_at: string | null;
  project_swaps_used: number | null;
  plan_confirmed_at: string | null;
  created_at: string;
};

const fromRow = (r: RoadmapRow): RoadmapRecord => ({
  id: r.id,
  userId: r.user_id,
  pendingEmail: r.pending_email,
  pendingName: r.pending_name ?? null,
  pendingLinkedin: r.pending_linkedin ?? null,
  input: r.input_json,
  inputHash: r.input_hash,
  output: r.output_json,
  emailSentAt: r.email_sent_at,
  projectsUnlockedAt: r.projects_unlocked_at ?? null,
  projectSwapsUsed: r.project_swaps_used ?? 0,
  planConfirmedAt: r.plan_confirmed_at ?? null,
  createdAt: r.created_at,
});

type IdeaRow = {
  id: string;
  position: number;
  title: string;
  brief: string;
  closes_gaps: string[];
  deliverable: string;
  weeks: number;
  source: "roadmap" | "swap";
  swaps_used: number | null;
};

const ideaFromRow = (r: IdeaRow): ProjectIdea => ({
  id: r.id,
  position: r.position,
  title: r.title,
  brief: r.brief,
  closesGaps: r.closes_gaps ?? [],
  deliverable: r.deliverable,
  weeks: r.weeks,
  source: r.source,
  swapsUsed: r.swaps_used ?? 0,
});

/** The plan has three slots. */
export const PLAN_SIZE = 3;

const ideaFields = (p: Project) => ({
  title: p.title.slice(0, 200),
  brief: p.brief.slice(0, 1000),
  closes_gaps: p.closesGaps,
  deliverable: p.deliverable.slice(0, 300),
  weeks: Math.min(12, Math.max(1, Math.round(p.weeks))),
});

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

function supabaseStore(): Store {
  const db = supabaseAdmin();
  const since = (hours: number) => new Date(Date.now() - hours * 3_600_000).toISOString();
  return {
    async createRoadmap(r) {
      const row = check(
        await db
          .from("roadmaps")
          .insert({
            pending_email: r.email,
            input_json: r.input,
            input_hash: r.inputHash,
            creator_ip_hash: r.ipHash,
          })
          .select("id")
          .single(),
      );
      return (row as { id: string }).id;
    },
    async countRecentRoadmaps(email, hours) {
      const res = await db
        .from("roadmaps")
        .select("id", { count: "exact", head: true })
        .eq("pending_email", email)
        .gte("created_at", since(hours));
      if (res.error) throw new Error(res.error.message);
      return res.count ?? 0;
    },
    async countRecentByIpHash(ipHash, hours) {
      const res = await db
        .from("roadmaps")
        .select("id", { count: "exact", head: true })
        .eq("creator_ip_hash", ipHash)
        .gte("created_at", since(hours));
      if (res.error) throw new Error(res.error.message);
      return res.count ?? 0;
    },
    async claimPendingRoadmaps(email, userId) {
      const pending = check(
        await db
          .from("roadmaps")
          .select("pending_marketing_opt_in, pending_name, pending_linkedin")
          .eq("pending_email", email)
          .is("user_id", null)
          .order("created_at", { ascending: false }),
      ) as { pending_marketing_opt_in: boolean; pending_name: string | null; pending_linkedin: string | null }[];
      check(await db.from("roadmaps").update({ user_id: userId }).eq("pending_email", email).is("user_id", null));
      if (pending.some((p) => p.pending_marketing_opt_in)) {
        check(
          await db
            .from("profiles")
            .update({ marketing_opt_in: true, marketing_opt_in_at: new Date().toISOString() })
            .eq("id", userId),
        );
      }
      // The newest name and LinkedIn from the gate fill the profile, without overwriting what's there.
      const name = pending.find((p) => p.pending_name)?.pending_name;
      const linkedin = pending.find((p) => p.pending_linkedin)?.pending_linkedin;
      if (name) check(await db.from("profiles").update({ name }).eq("id", userId).is("name", null));
      if (linkedin) check(await db.from("profiles").update({ linkedin_url: linkedin }).eq("id", userId).is("linkedin_url", null));
    },
    async getRoadmap(id) {
      const row = check(await db.from("roadmaps").select("*").eq("id", id).maybeSingle()) as RoadmapRow | null;
      return row ? fromRow(row) : null;
    },
    async latestRoadmapFor(userId) {
      const row = check(
        await db
          .from("roadmaps")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ) as RoadmapRow | null;
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
      check(
        await db
          .from("roadmaps")
          .update({ output_json: output, generation_started_at: null })
          .eq("id", id),
      );
    },
    async claimGeneration(id) {
      const row = check(
        await db.from("roadmaps").select("output_json, generation_started_at").eq("id", id).maybeSingle(),
      ) as { output_json: Roadmap | null; generation_started_at: string | null } | null;
      if (!row) return "ready";
      if (row.output_json) return "ready";
      const staleBefore = new Date(Date.now() - GENERATION_STALE_MS).toISOString();
      const now = new Date().toISOString();
      let q = db
        .from("roadmaps")
        .update({ generation_started_at: now })
        .eq("id", id)
        .is("output_json", null);
      // Fresh claim, or take over a stuck one.
      if (row.generation_started_at) {
        q = q.lt("generation_started_at", staleBefore);
      } else {
        q = q.is("generation_started_at", null);
      }
      const won = check(await q.select("id")) as { id: string }[];
      if (won.length === 1) return "run";
      const again = check(
        await db.from("roadmaps").select("output_json").eq("id", id).maybeSingle(),
      ) as { output_json: Roadmap | null } | null;
      return again?.output_json ? "ready" : "busy";
    },
    async clearGenerationClaim(id) {
      check(await db.from("roadmaps").update({ generation_started_at: null }).eq("id", id).is("output_json", null));
    },
    async markEmailSent(id) {
      // Conditional update: only one caller wins, so the email is sent once.
      const rows = check(
        await db
          .from("roadmaps")
          .update({ email_sent_at: new Date().toISOString() })
          .eq("id", id)
          .is("email_sent_at", null)
          .select("id"),
      ) as { id: string }[];
      return rows.length === 1;
    },
    async setMarketingOptIn(email, optIn) {
      const at = optIn ? new Date().toISOString() : null;
      check(
        await db.from("profiles").update({ marketing_opt_in: optIn, marketing_opt_in_at: at }).eq("email", email),
      );
      check(
        await db.from("roadmaps").update({ pending_marketing_opt_in: optIn }).eq("pending_email", email).is("user_id", null),
      );
    },
    async unlockRoadmap(id, d) {
      check(
        await db
          .from("roadmaps")
          .update({
            pending_name: d.name,
            pending_linkedin: d.linkedin,
            pending_marketing_opt_in: d.marketingOptIn,
            projects_unlocked_at: new Date().toISOString(),
          })
          .eq("id", id),
      );
      check(await db.from("roadmaps").update({ pending_email: d.email }).eq("id", id).is("pending_email", null));
    },
    async listProjectIdeas(roadmapId) {
      const rows = check(
        await db.from("project_ideas").select("*").eq("roadmap_id", roadmapId).order("position"),
      ) as IdeaRow[];
      return rows.map(ideaFromRow);
    },
    async seedProjectIdeas(roadmapId, ideas) {
      const rows = ideas
        .slice(0, PLAN_SIZE)
        .map((p, i) => ({ roadmap_id: roadmapId, position: i, source: "roadmap", ...ideaFields(p) }));
      if (rows.length === 0) return;
      // Positions are unique per roadmap, so two first visits at once can't seed twice.
      check(await db.from("project_ideas").upsert(rows, { onConflict: "roadmap_id,position", ignoreDuplicates: true }));
    },
    async swapProjectIdea(roadmapId, ideaId, idea, perIdeaLimit) {
      const row = check(
        await db.from("roadmaps").select("project_swaps_used, plan_confirmed_at").eq("id", roadmapId).maybeSingle(),
      ) as { project_swaps_used: number; plan_confirmed_at: string | null } | null;
      if (!row || row.plan_confirmed_at) return false;
      const ideaRow = check(
        await db.from("project_ideas").select("swaps_used").eq("id", ideaId).eq("roadmap_id", roadmapId).maybeSingle(),
      ) as { swaps_used: number } | null;
      if (!ideaRow || ideaRow.swaps_used >= perIdeaLimit) return false;
      const nextIdeaSwaps = ideaRow.swaps_used + 1;
      // Count on the idea first so two parallel swaps of the same slot can't both pass.
      const wonIdea = check(
        await db
          .from("project_ideas")
          .update({
            ...ideaFields(idea),
            source: "swap",
            swaps_used: nextIdeaSwaps,
            updated_at: new Date().toISOString(),
          })
          .eq("id", ideaId)
          .eq("roadmap_id", roadmapId)
          .eq("swaps_used", ideaRow.swaps_used)
          .select("id"),
      ) as { id: string }[];
      if (wonIdea.length !== 1) return false;
      const used = row.project_swaps_used + 1;
      check(await db.from("roadmaps").update({ project_swaps_used: used }).eq("id", roadmapId));
      return true;
    },
    async confirmPlan(roadmapId) {
      check(
        await db
          .from("roadmaps")
          .update({ plan_confirmed_at: new Date().toISOString() })
          .eq("id", roadmapId)
          .is("plan_confirmed_at", null),
      );
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
    async joinWaitlist(entry) {
      check(await db.from("waitlist").upsert(entry, { onConflict: "email,interest", ignoreDuplicates: true }));
    },
    async takeRateLimit(key, limit, windowSeconds) {
      const sinceIso = new Date(Date.now() - windowSeconds * 1000).toISOString();
      const counted = await db
        .from("rate_limit_hits")
        .select("id", { count: "exact", head: true })
        .eq("key", key)
        .gte("created_at", sinceIso);
      if (counted.error) throw new Error(counted.error.message);
      if ((counted.count ?? 0) >= limit) return false;
      const { error } = await db.from("rate_limit_hits").insert({ key });
      if (error) throw new Error(error.message);
      return true;
    },
    async exportUserData(userId) {
      const [profile, roadmaps, exhbts, links, subs] = await Promise.all([
        db.from("profiles").select("*").eq("id", userId).maybeSingle(),
        db.from("roadmaps").select("*").eq("user_id", userId),
        db.from("exhbts").select("*").eq("user_id", userId),
        db.from("curated_links").select("*").eq("user_id", userId),
        db.from("subscriptions").select("*").eq("user_id", userId),
      ]);
      const roadmapIds = ((roadmaps.data ?? []) as { id: string }[]).map((r) => r.id);
      const ideas = roadmapIds.length ? await db.from("project_ideas").select("*").in("roadmap_id", roadmapIds) : { data: [] };
      return {
        exportedAt: new Date().toISOString(),
        profile: profile.data,
        roadmaps: roadmaps.data,
        projectIdeas: ideas.data,
        exhbts: exhbts.data,
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

/* ---------------- In-memory (local development and tests only) ---------------- */

type MemRoadmap = RoadmapRecord & { ipHash: string; marketingOptIn: boolean; generationStartedAt: string | null };
type Mem = {
  roadmaps: Map<string, MemRoadmap>;
  ideas: Map<string, ProjectIdea[]>;
  optIns: Map<string, boolean>;
  aiCalls: AICall[];
  events: { name: string; userId: string | null; props: Record<string, unknown>; at: string }[];
  leads: unknown[];
  waitlist: { email: string; interest: WaitlistInterest; source: string }[];
  rateHits: { key: string; at: number }[];
};
const newMem = (): Mem => ({
  roadmaps: new Map(),
  ideas: new Map(),
  optIns: new Map(),
  aiCalls: [],
  events: [],
  leads: [],
  waitlist: [],
  rateHits: [],
});
const g = globalThis as unknown as { __exhbtMem?: Mem };

function memoryStore(): Store {
  // Production always needs Supabase. The in-memory store is for local development and e2e only.
  if (process.env.NODE_ENV === "production") {
    throw new Error("Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  }
  const m = (g.__exhbtMem ??= newMem());
  m.ideas ??= new Map(); // a store created before ideas existed (hot reload in development)
  m.rateHits ??= [];
  const recent = (hours: number, r: MemRoadmap) => Date.parse(r.createdAt) >= Date.now() - hours * 3_600_000;
  const asRecord = (r: MemRoadmap): RoadmapRecord => ({
    id: r.id,
    userId: r.userId,
    pendingEmail: r.pendingEmail,
    pendingName: r.pendingName,
    pendingLinkedin: r.pendingLinkedin,
    input: r.input,
    inputHash: r.inputHash,
    output: r.output,
    emailSentAt: r.emailSentAt,
    projectsUnlockedAt: r.projectsUnlockedAt,
    projectSwapsUsed: r.projectSwapsUsed,
    planConfirmedAt: r.planConfirmedAt,
    createdAt: r.createdAt,
  });
  return {
    async createRoadmap(r) {
      const id = crypto.randomUUID();
      m.roadmaps.set(id, {
        id,
        userId: null,
        pendingEmail: r.email,
        pendingName: null,
        pendingLinkedin: null,
        input: r.input,
        inputHash: r.inputHash,
        output: null,
        emailSentAt: null,
        projectsUnlockedAt: null,
        projectSwapsUsed: 0,
        planConfirmedAt: null,
        createdAt: new Date().toISOString(),
        ipHash: r.ipHash,
        marketingOptIn: false,
        generationStartedAt: null,
      });
      return id;
    },
    async countRecentRoadmaps(email, hours) {
      return [...m.roadmaps.values()].filter((r) => r.pendingEmail === email && recent(hours, r)).length;
    },
    async countRecentByIpHash(ipHash, hours) {
      return [...m.roadmaps.values()].filter((r) => r.ipHash === ipHash && recent(hours, r)).length;
    },
    async claimPendingRoadmaps(email, userId) {
      for (const r of m.roadmaps.values()) if (r.pendingEmail === email && !r.userId) r.userId = userId;
    },
    async getRoadmap(id) {
      const r = m.roadmaps.get(id);
      return r ? asRecord(r) : null;
    },
    async latestRoadmapFor(userId) {
      const r =
        [...m.roadmaps.values()]
          .filter((x) => x.userId === userId)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null;
      return r ? asRecord(r) : null;
    },
    async findCachedOutput(inputHash) {
      return [...m.roadmaps.values()].find((r) => r.inputHash === inputHash && r.output)?.output ?? null;
    },
    async saveRoadmapOutput(id, output) {
      const r = m.roadmaps.get(id);
      if (r) {
        r.output = output;
        r.generationStartedAt = null;
      }
    },
    async claimGeneration(id) {
      const r = m.roadmaps.get(id);
      if (!r || r.output) return "ready";
      const started = r.generationStartedAt ? Date.parse(r.generationStartedAt) : 0;
      if (started && Date.now() - started < GENERATION_STALE_MS) return "busy";
      r.generationStartedAt = new Date().toISOString();
      return "run";
    },
    async clearGenerationClaim(id) {
      const r = m.roadmaps.get(id);
      if (r && !r.output) r.generationStartedAt = null;
    },
    async markEmailSent(id) {
      const r = m.roadmaps.get(id);
      if (!r || r.emailSentAt) return false;
      r.emailSentAt = new Date().toISOString();
      return true;
    },
    async setMarketingOptIn(email, optIn) {
      m.optIns.set(email, optIn);
    },
    async unlockRoadmap(id, d) {
      const r = m.roadmaps.get(id);
      if (!r) return;
      r.pendingEmail ??= d.email;
      r.pendingName = d.name;
      r.pendingLinkedin = d.linkedin;
      r.marketingOptIn = d.marketingOptIn;
      r.projectsUnlockedAt = new Date().toISOString();
      if (d.marketingOptIn) m.optIns.set(d.email, true);
    },
    async listProjectIdeas(roadmapId) {
      return [...(m.ideas.get(roadmapId) ?? [])].sort((a, b) => a.position - b.position);
    },
    async seedProjectIdeas(roadmapId, ideas) {
      if (ideas.length === 0 || (m.ideas.get(roadmapId)?.length ?? 0) > 0) return;
      m.ideas.set(
        roadmapId,
        ideas.slice(0, PLAN_SIZE).map((p, i) => ({
          ...p,
          id: crypto.randomUUID(),
          position: i,
          source: "roadmap" as const,
          swapsUsed: 0,
        })),
      );
    },
    async swapProjectIdea(roadmapId, ideaId, idea, perIdeaLimit) {
      const r = m.roadmaps.get(roadmapId);
      const list = m.ideas.get(roadmapId) ?? [];
      const i = list.findIndex((x) => x.id === ideaId);
      if (!r || r.planConfirmedAt || i === -1) return false;
      const current = list[i]!;
      if (current.swapsUsed >= perIdeaLimit) return false;
      r.projectSwapsUsed += 1;
      list[i] = {
        ...idea,
        id: current.id,
        position: current.position,
        source: "swap",
        swapsUsed: current.swapsUsed + 1,
      };
      return true;
    },
    async confirmPlan(roadmapId) {
      const r = m.roadmaps.get(roadmapId);
      if (r && !r.planConfirmedAt) r.planConfirmedAt = new Date().toISOString();
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
    async joinWaitlist(entry) {
      m.waitlist ??= [];
      if (!m.waitlist.some((w) => w.email === entry.email && w.interest === entry.interest)) m.waitlist.push(entry);
    },
    async takeRateLimit(key, limit, windowSeconds) {
      const cut = Date.now() - windowSeconds * 1000;
      m.rateHits = m.rateHits.filter((h) => h.at >= cut);
      const n = m.rateHits.filter((h) => h.key === key).length;
      if (n >= limit) return false;
      m.rateHits.push({ key, at: Date.now() });
      return true;
    },
    async exportUserData(userId) {
      const roadmaps = [...m.roadmaps.values()].filter((r) => r.userId === userId);
      return { roadmaps, projectIdeas: roadmaps.flatMap((r) => m.ideas.get(r.id) ?? []) };
    },
    async deleteUserData(userId) {
      for (const [id, r] of m.roadmaps) {
        if (r.userId === userId) {
          m.roadmaps.delete(id);
          m.ideas.delete(id);
        }
      }
    },
  };
}

/** Read-only view of the in-memory store, for the dev pages and tests. */
export function memorySnapshot() {
  return g.__exhbtMem;
}
