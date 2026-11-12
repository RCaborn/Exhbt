import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Project, Roadmap, RoadmapInput } from "./ai/schemas";
import type { ExhbtDoc } from "./exhbt/blocks";
import type { Plan } from "./entitlements";

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
};

/** The public face of a person: their portfolio header (docs/phase-2.md section 4). */
export type PortfolioProfile = {
  userId: string;
  username: string | null;
  name: string | null;
  /** One line, about 12 words. */
  headline: string | null;
  /** About 40 words. */
  bio: string | null;
  /** exhbt_files.id of the profile photo, or null for initials. */
  photoFileId: string | null;
  linkedin: string | null;
  hideFromSearch: boolean;
};

/**
 * An exhbt. `doc` is the working copy (always saved, may break limits); `published` is what
 * employers see, replaced only by a successful publish, so live pages never show half-finished edits.
 */
export type ExhbtRecord = {
  id: string;
  userId: string;
  doc: ExhbtDoc;
  published: ExhbtDoc | null;
  status: "draft" | "published";
  /** URL segment on the owner's portfolio, set on first publish. */
  slug: string | null;
  /** Order on the portfolio, lowest first. */
  position: number;
  confirmedAt: string | null;
  publishedAt: string | null;
  updatedAt: string;
};

/** A stored file (exhbt_files): project material, evidence, an image on an exhbt, or a profile photo. */
export type StoredFile = {
  id: string;
  userId: string;
  bucket: "sources" | "evidence";
  path: string;
  mime: string;
  bytes: number;
  kind: "source" | "evidence" | "image" | "photo";
};

export type UsernameLookup = { userId: string; username: string } | { redirectTo: string } | null;

export type AICall = {
  userId: string | null;
  step: "roadmap" | "exhbt_draft" | "exhbt_rewrite" | "originality" | "link_ranking" | "project_ideas" | "cv_read";
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
  | "plan_kept"
  | "cv_read_ai"
  | "cv_read_failed"
  | "login_link_sent"
  | "username_claimed";

export type WaitlistInterest = "premium" | "max" | "university";

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
   * Replaces one idea in place and counts the swap. The last allowed swap also confirms the
   * plan. Returns false, changing nothing, when `limit` swaps have been used (or another swap
   * won a race).
   */
  swapProjectIdea(roadmapId: string, ideaId: string, idea: Project, limit: number): Promise<boolean>;
  /** Keeps the plan as it is: no more swaps. */
  confirmPlan(roadmapId: string): Promise<void>;
  logAICall(call: AICall): Promise<void>;
  logEvent(name: EventName, userId: string | null, props?: Record<string, unknown>): Promise<void>;
  /** How many events with this name carried this ipHash in their props in the last `hours`. For rate limits. */
  countRecentEvents(name: EventName, ipHash: string, hours: number): Promise<number>;
  createLead(lead: { name: string; email: string; institution: string; message: string }): Promise<void>;
  /** Idempotent: joining twice with the same email and interest is a no-op. */
  joinWaitlist(entry: { email: string; interest: WaitlistInterest; source: string }): Promise<void>;
  exportUserData(userId: string): Promise<Record<string, unknown>>;
  deleteUserData(userId: string): Promise<void>;

  /* Phase 2: portfolios and exhbts (docs/phase-2.md) */
  /** The plan that applies now: an active subscription, else an institution licence, else free. */
  planFor(userId: string): Promise<Plan>;
  getPortfolioProfile(userId: string): Promise<PortfolioProfile>;
  /** A username to its owner, or to the name it now redirects to (for 30 days after a change). */
  lookupUsername(username: string): Promise<UsernameLookup>;
  /** Sets or changes the username; the old one redirects for 30 days. "taken" if someone else has it. */
  claimUsername(userId: string, username: string): Promise<"ok" | "taken">;
  updatePortfolioProfile(
    userId: string,
    fields: Partial<Pick<PortfolioProfile, "name" | "headline" | "bio" | "photoFileId" | "linkedin" | "hideFromSearch">>,
  ): Promise<void>;
  createExhbt(userId: string, doc: ExhbtDoc): Promise<string>;
  getExhbt(id: string): Promise<ExhbtRecord | null>;
  /** All of a person's exhbts, drafts included, in portfolio order. */
  listExhbts(userId: string): Promise<ExhbtRecord[]>;
  /** Saves the working copy. Never blocked by limits. False if it isn't theirs. */
  saveExhbtDraft(id: string, userId: string, doc: ExhbtDoc): Promise<boolean>;
  /**
   * Copies the working copy to the live one and marks it published with this slug.
   * Limits and plan checks happen before this is called (lib/plan.ts, validateForPublish).
   */
  publishExhbt(id: string, userId: string, slug: string): Promise<boolean>;
  unpublishExhbt(id: string, userId: string): Promise<boolean>;
  /** Sets portfolio order to the order of `ids`. */
  reorderExhbts(userId: string, ids: string[]): Promise<void>;
  deleteExhbt(id: string, userId: string): Promise<boolean>;
  getFile(id: string): Promise<StoredFile | null>;
}

export const isSupabaseConfigured = () =>
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

export function getStore(): Store {
  return isSupabaseConfigured() ? supabaseStore() : memoryStore();
}

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
      check(await db.from("roadmaps").update({ output_json: output }).eq("id", id));
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
    async swapProjectIdea(roadmapId, ideaId, idea, limit) {
      const row = check(
        await db.from("roadmaps").select("project_swaps_used, plan_confirmed_at").eq("id", roadmapId).maybeSingle(),
      ) as { project_swaps_used: number; plan_confirmed_at: string | null } | null;
      if (!row || row.plan_confirmed_at || row.project_swaps_used >= limit) return false;
      const used = row.project_swaps_used + 1;
      // Count the swap first, conditionally, so two at once can't both pass the limit.
      const won = check(
        await db
          .from("roadmaps")
          .update({ project_swaps_used: used, ...(used >= limit ? { plan_confirmed_at: new Date().toISOString() } : {}) })
          .eq("id", roadmapId)
          .eq("project_swaps_used", row.project_swaps_used)
          .select("id"),
      ) as { id: string }[];
      if (won.length !== 1) return false;
      check(
        await db
          .from("project_ideas")
          .update({ ...ideaFields(idea), source: "swap", updated_at: new Date().toISOString() })
          .eq("id", ideaId)
          .eq("roadmap_id", roadmapId),
      );
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
    async countRecentEvents(name, ipHash, hours) {
      const res = await db
        .from("events")
        .select("id", { count: "exact", head: true })
        .eq("name", name)
        .eq("props->>ipHash", ipHash)
        .gte("created_at", since(hours));
      if (res.error) throw new Error(res.error.message);
      return res.count ?? 0;
    },
    async createLead(lead) {
      check(await db.from("leads").insert(lead));
    },
    async joinWaitlist(entry) {
      check(await db.from("waitlist").upsert(entry, { onConflict: "email,interest", ignoreDuplicates: true }));
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
      // Storage objects under the user's folder are removed by lib/files.ts before this runs.
      const { error } = await db.auth.admin.deleteUser(userId);
      if (error) throw new Error(error.message);
    },

    async planFor(userId) {
      const sub = check(
        await db
          .from("subscriptions")
          .select("plan")
          .eq("user_id", userId)
          .in("status", ["active", "trialing", "past_due"])
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ) as { plan: Plan } | null;
      if (sub?.plan) return sub.plan;
      const prof = check(
        await db.from("profiles").select("institution_id, institutions(licence_end)").eq("id", userId).maybeSingle(),
      ) as { institution_id: string | null; institutions: { licence_end: string | null } | null } | null;
      const end = prof?.institutions?.licence_end;
      if (prof?.institution_id && (!end || Date.parse(end) >= Date.now())) return "institutional";
      return "free";
    },
    async getPortfolioProfile(userId) {
      const row = check(
        await db
          .from("profiles")
          .select("id, username, name, headline, bio, photo_file_id, linkedin_url, hide_from_search")
          .eq("id", userId)
          .maybeSingle(),
      ) as ProfileRow | null;
      return row ? fromProfileRow(row) : emptyProfile(userId);
    },
    async lookupUsername(username) {
      const row = check(await db.from("profiles").select("id, username").eq("username", username).maybeSingle()) as
        | { id: string; username: string }
        | null;
      if (row) return { userId: row.id, username: row.username };
      const red = check(
        await db
          .from("username_redirects")
          .select("user_id, profiles(username)")
          .eq("old_username", username)
          .gt("expires_at", new Date().toISOString())
          .maybeSingle(),
      ) as { user_id: string; profiles: { username: string | null } | null } | null;
      return red?.profiles?.username ? { redirectTo: red.profiles.username } : null;
    },
    async claimUsername(userId, username) {
      const current = check(await db.from("profiles").select("username").eq("id", userId).maybeSingle()) as { username: string | null } | null;
      if (current?.username === username) return "ok";
      const res = await db.rpc("claim_username", { p_user: userId, p_username: username });
      if (res.error) {
        if (/taken|duplicate|unique/i.test(res.error.message)) return "taken";
        throw new Error(res.error.message);
      }
      return "ok";
    },
    async updatePortfolioProfile(userId, f) {
      const row: Record<string, unknown> = {};
      if (f.name !== undefined) row.name = f.name;
      if (f.headline !== undefined) row.headline = f.headline;
      if (f.bio !== undefined) row.bio = f.bio;
      if (f.photoFileId !== undefined) row.photo_file_id = f.photoFileId;
      if (f.linkedin !== undefined) row.linkedin_url = f.linkedin;
      if (f.hideFromSearch !== undefined) row.hide_from_search = f.hideFromSearch;
      if (Object.keys(row).length) check(await db.from("profiles").update(row).eq("id", userId));
    },
    async createExhbt(userId, doc) {
      const last = check(
        await db.from("exhbts").select("position").eq("user_id", userId).order("position", { ascending: false }).limit(1).maybeSingle(),
      ) as { position: number } | null;
      const row = check(
        await db
          .from("exhbts")
          .insert({ user_id: userId, title: doc.title.slice(0, 80), blocks: doc, position: (last?.position ?? -1) + 1 })
          .select("id")
          .single(),
      ) as { id: string };
      return row.id;
    },
    async getExhbt(id) {
      const row = check(await db.from("exhbts").select(EXHBT_COLS).eq("id", id).maybeSingle()) as ExhbtRow | null;
      return row ? fromExhbtRow(row) : null;
    },
    async listExhbts(userId) {
      const rows = check(
        await db.from("exhbts").select(EXHBT_COLS).eq("user_id", userId).order("position", { ascending: true }),
      ) as ExhbtRow[];
      return rows.map(fromExhbtRow);
    },
    async saveExhbtDraft(id, userId, doc) {
      const rows = check(
        await db
          .from("exhbts")
          .update({ blocks: doc, title: doc.title.slice(0, 80), updated_at: new Date().toISOString() })
          .eq("id", id)
          .eq("user_id", userId)
          .select("id"),
      ) as { id: string }[];
      return rows.length > 0;
    },
    async publishExhbt(id, userId, slug) {
      const cur = check(await db.from("exhbts").select("blocks").eq("id", id).eq("user_id", userId).maybeSingle()) as {
        blocks: ExhbtDoc;
      } | null;
      if (!cur) return false;
      const now = new Date().toISOString();
      check(
        await db
          .from("exhbts")
          .update({ published_blocks: cur.blocks, status: "published", public_slug: slug, confirmed_at: now, published_at: now })
          .eq("id", id)
          .eq("user_id", userId),
      );
      return true;
    },
    async unpublishExhbt(id, userId) {
      const rows = check(
        await db.from("exhbts").update({ status: "draft" }).eq("id", id).eq("user_id", userId).select("id"),
      ) as { id: string }[];
      return rows.length > 0;
    },
    async reorderExhbts(userId, ids) {
      await Promise.all(ids.map((id, position) => db.from("exhbts").update({ position }).eq("id", id).eq("user_id", userId)));
    },
    async deleteExhbt(id, userId) {
      const rows = check(await db.from("exhbts").delete().eq("id", id).eq("user_id", userId).select("id")) as { id: string }[];
      return rows.length > 0;
    },
    async getFile(id) {
      const r = check(
        await db.from("exhbt_files").select("id, user_id, bucket, path, mime, bytes, kind").eq("id", id).maybeSingle(),
      ) as { id: string; user_id: string; bucket: StoredFile["bucket"]; path: string; mime: string; bytes: number; kind: StoredFile["kind"] } | null;
      return r ? { id: r.id, userId: r.user_id, bucket: r.bucket, path: r.path, mime: r.mime, bytes: r.bytes, kind: r.kind } : null;
    },
  };
}

type ProfileRow = {
  id: string;
  username: string | null;
  name: string | null;
  headline: string | null;
  bio: string | null;
  photo_file_id: string | null;
  linkedin_url: string | null;
  hide_from_search: boolean | null;
};
const fromProfileRow = (r: ProfileRow): PortfolioProfile => ({
  userId: r.id,
  username: r.username,
  name: r.name,
  headline: r.headline,
  bio: r.bio,
  photoFileId: r.photo_file_id,
  linkedin: r.linkedin_url,
  hideFromSearch: Boolean(r.hide_from_search),
});
const emptyProfile = (userId: string): PortfolioProfile => ({
  userId,
  username: null,
  name: null,
  headline: null,
  bio: null,
  photoFileId: null,
  linkedin: null,
  hideFromSearch: false,
});

const EXHBT_COLS = "id, user_id, blocks, published_blocks, status, public_slug, position, confirmed_at, published_at, updated_at";
type ExhbtRow = {
  id: string;
  user_id: string;
  blocks: ExhbtDoc;
  published_blocks: ExhbtDoc | null;
  status: string;
  public_slug: string | null;
  position: number;
  confirmed_at: string | null;
  published_at: string | null;
  updated_at: string;
};
const fromExhbtRow = (r: ExhbtRow): ExhbtRecord => ({
  id: r.id,
  userId: r.user_id,
  doc: r.blocks,
  published: r.published_blocks,
  status: r.status === "published" ? "published" : "draft",
  slug: r.public_slug,
  position: r.position,
  confirmedAt: r.confirmed_at,
  publishedAt: r.published_at,
  updatedAt: r.updated_at,
});

/* ---------------- In-memory (local development and tests only) ---------------- */

type MemRoadmap = RoadmapRecord & { ipHash: string; marketingOptIn: boolean };
type Mem = {
  roadmaps: Map<string, MemRoadmap>;
  ideas: Map<string, ProjectIdea[]>;
  optIns: Map<string, boolean>;
  aiCalls: AICall[];
  events: { name: string; userId: string | null; props: Record<string, unknown>; at: string }[];
  leads: unknown[];
  waitlist: { email: string; interest: WaitlistInterest; source: string }[];
  profiles: Map<string, PortfolioProfile>;
  usernameRedirects: Map<string, { userId: string; expiresAt: number }>;
  exhbts: Map<string, ExhbtRecord>;
  files: Map<string, StoredFile>;
  /** Development and tests only: a plan per user, set from /dev/plan. */
  plans: Map<string, Plan>;
};
const newMem = (): Mem => ({
  roadmaps: new Map(),
  ideas: new Map(),
  optIns: new Map(),
  aiCalls: [],
  events: [],
  leads: [],
  waitlist: [],
  profiles: new Map(),
  usernameRedirects: new Map(),
  exhbts: new Map(),
  files: new Map(),
  plans: new Map(),
});
const g = globalThis as unknown as { __exhbtMem?: Mem };

function memoryStore(): Store {
  if (process.env.NODE_ENV === "production" && !process.env.EXHBT_ALLOW_MEMORY_STORE) {
    throw new Error("Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  }
  const m = (g.__exhbtMem ??= newMem());
  m.ideas ??= new Map(); // a store created before ideas existed (hot reload in development)
  m.profiles ??= new Map();
  m.usernameRedirects ??= new Map();
  m.exhbts ??= new Map();
  m.files ??= new Map();
  m.plans ??= new Map();
  const profile = (userId: string) => m.profiles.get(userId) ?? emptyProfile(userId);
  const own = (id: string, userId: string) => {
    const e = m.exhbts.get(id);
    return e && e.userId === userId ? e : null;
  };
  const recent = (hours: number, r: MemRoadmap) => Date.parse(r.createdAt) >= Date.now() - hours * 3_600_000;
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
        ideas.slice(0, PLAN_SIZE).map((p, i) => ({ ...p, id: crypto.randomUUID(), position: i, source: "roadmap" as const })),
      );
    },
    async swapProjectIdea(roadmapId, ideaId, idea, limit) {
      const r = m.roadmaps.get(roadmapId);
      const list = m.ideas.get(roadmapId) ?? [];
      const i = list.findIndex((x) => x.id === ideaId);
      if (!r || r.planConfirmedAt || r.projectSwapsUsed >= limit || i === -1) return false;
      r.projectSwapsUsed += 1;
      if (r.projectSwapsUsed >= limit) r.planConfirmedAt = new Date().toISOString();
      list[i] = { ...idea, id: list[i].id, position: list[i].position, source: "swap" };
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
    async countRecentEvents(name, ipHash, hours) {
      const after = Date.now() - hours * 3_600_000;
      return m.events.filter((e) => e.name === name && e.props.ipHash === ipHash && Date.parse(e.at) >= after).length;
    },
    async createLead(lead) {
      m.leads.push(lead);
    },
    async joinWaitlist(entry) {
      m.waitlist ??= [];
      if (!m.waitlist.some((w) => w.email === entry.email && w.interest === entry.interest)) m.waitlist.push(entry);
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
      for (const [id, e] of m.exhbts) if (e.userId === userId) m.exhbts.delete(id);
      m.profiles.delete(userId);
      m.plans.delete(userId);
    },

    async planFor(userId) {
      return m.plans.get(userId) ?? "free";
    },
    async getPortfolioProfile(userId) {
      return { ...profile(userId) };
    },
    async lookupUsername(username) {
      for (const p of m.profiles.values()) if (p.username === username) return { userId: p.userId, username };
      const red = m.usernameRedirects.get(username);
      if (red && red.expiresAt > Date.now()) {
        const now = m.profiles.get(red.userId)?.username;
        if (now) return { redirectTo: now };
      }
      return null;
    },
    async claimUsername(userId, username) {
      const mine = profile(userId);
      if (mine.username === username) return "ok";
      for (const p of m.profiles.values()) if (p.username === username) return "taken";
      const red = m.usernameRedirects.get(username);
      if (red && red.expiresAt > Date.now() && red.userId !== userId) return "taken";
      if (mine.username) m.usernameRedirects.set(mine.username, { userId, expiresAt: Date.now() + 30 * 86_400_000 });
      m.usernameRedirects.delete(username);
      m.profiles.set(userId, { ...mine, username });
      return "ok";
    },
    async updatePortfolioProfile(userId, f) {
      const next = { ...profile(userId) };
      for (const [k, v] of Object.entries(f)) if (v !== undefined) (next as Record<string, unknown>)[k] = v;
      m.profiles.set(userId, next);
    },
    async createExhbt(userId, doc) {
      const id = crypto.randomUUID();
      const mine = [...m.exhbts.values()].filter((e) => e.userId === userId);
      m.exhbts.set(id, {
        id,
        userId,
        doc: structuredClone(doc),
        published: null,
        status: "draft",
        slug: null,
        position: mine.length ? Math.max(...mine.map((e) => e.position)) + 1 : 0,
        confirmedAt: null,
        publishedAt: null,
        updatedAt: new Date().toISOString(),
      });
      return id;
    },
    async getExhbt(id) {
      const e = m.exhbts.get(id);
      return e ? structuredClone(e) : null;
    },
    async listExhbts(userId) {
      return [...m.exhbts.values()].filter((e) => e.userId === userId).sort((a, b) => a.position - b.position).map((e) => structuredClone(e));
    },
    async saveExhbtDraft(id, userId, doc) {
      const e = own(id, userId);
      if (!e) return false;
      e.doc = structuredClone(doc);
      e.updatedAt = new Date().toISOString();
      return true;
    },
    async publishExhbt(id, userId, slug) {
      const e = own(id, userId);
      if (!e) return false;
      const now = new Date().toISOString();
      Object.assign(e, { published: structuredClone(e.doc), status: "published", slug, confirmedAt: now, publishedAt: now });
      return true;
    },
    async unpublishExhbt(id, userId) {
      const e = own(id, userId);
      if (!e) return false;
      e.status = "draft";
      return true;
    },
    async reorderExhbts(userId, ids) {
      ids.forEach((id, position) => {
        const e = own(id, userId);
        if (e) e.position = position;
      });
    },
    async deleteExhbt(id, userId) {
      return own(id, userId) ? m.exhbts.delete(id) : false;
    },
    async getFile(id) {
      return m.files.get(id) ?? null;
    },
  };
}

/** Development and tests only: give a user a plan without Stripe (app/dev/plan). */
export function setPlanForDevelopment(userId: string, plan: Plan) {
  if (process.env.NODE_ENV === "production") throw new Error("Development only.");
  (g.__exhbtMem ??= newMem()).plans ??= new Map();
  g.__exhbtMem!.plans.set(userId, plan);
}

/** Read-only view of the in-memory store, for the dev pages and tests. */
export function memorySnapshot() {
  return g.__exhbtMem;
}
