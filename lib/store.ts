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

/** One published exhbt chosen for a job link, with the one-line reason shown to the owner. */
export type JobLinkPick = { exhbtId: string; reason: string };

/**
 * A per-job link (curated_links). `slug` is the path on the person's host (collection_slug).
 * The table's public_slug is stored as the row id so it stays globally unique; the path is per person.
 */
export type JobLink = {
  id: string;
  userId: string;
  company: string;
  roleTitle: string;
  slug: string;
  slugStyle: "clean" | "suffix";
  intro: string;
  /** The job description the person pasted. */
  description: string;
  picks: JobLinkPick[];
  status: "live" | "off";
  viewCount: number;
  createdAt: string;
};

export type NewJobLink = {
  id: string;
  userId: string;
  company: string;
  roleTitle: string;
  slug: string;
  slugStyle: "clean" | "suffix";
  intro: string;
  description: string;
  picks: JobLinkPick[];
};

export type JobLinkPatch = {
  intro?: string;
  picks?: JobLinkPick[];
  status?: "live" | "off";
  slug?: string;
  slugStyle?: "clean" | "suffix";
};

export type AICall = {
  userId: string | null;
  step: "roadmap" | "exhbt_draft" | "exhbt_rewrite" | "originality" | "link_ranking" | "project_ideas" | "cv_read" | "file_transcribe";
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
  | "subscription_changed"
  | "username_claimed"
  | "exhbt_drafted"
  | "file_uploaded"
  | "file_read_ai"
  | "job_link_created";

/** A Stripe subscription as we keep it (the `subscriptions` table). No amounts or card details. */
export type SubscriptionRecord = {
  userId: string;
  plan: Plan;
  /** Stripe's status: active, trialing, past_due, canceled, unpaid, incomplete, ... */
  status: string;
  customerId: string | null;
  subscriptionId: string;
  /** End of the current period (ISO), when it renews or, if cancelled, ends. */
  renewsAt: string | null;
  /**
   * When Stripe created the event this came from (ISO). Stripe may deliver events out of order,
   * so an event older than the one already applied is ignored. Null for writes not from an event.
   */
  lastEventAt?: string | null;
};

/** Statuses that keep a paid plan. past_due keeps it while Stripe retries the card. */
export const LIVE_SUBSCRIPTION_STATUSES = ["active", "trialing", "past_due"];

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

  /* billing */
  /**
   * Creates or updates the row for this Stripe subscription (keyed on its id). Safe to repeat.
   * With `lastEventAt`, an event older than the one already stored changes nothing. Returns
   * whether the row was written.
   */
  upsertSubscription(sub: SubscriptionRecord): Promise<boolean>;
  /** The person's current subscription (a live one first, else the latest), or null. */
  getSubscription(userId: string): Promise<SubscriptionRecord | null>;

  /* uploads and drafts */
  /** How many events with this name this user had in the last `hours`. For per-user limits (AI drafts). */
  countRecentEventsForUser(name: EventName, userId: string, hours: number): Promise<number>;
  /** Records an uploaded (or about-to-be-uploaded) file. The id is chosen by the caller, as it is part of the path. */
  createFile(file: StoredFile & { exhbtId?: string | null }): Promise<void>;
  /** Bytes of every file this user has stored, for the plan's storage cap. */
  storageBytesUsed(userId: string): Promise<number>;
  /** Links the user's unattached files to one of their exhbts. Returns how many were attached. */
  attachFiles(userId: string, exhbtId: string, fileIds: string[]): Promise<number>;
  /** Removes the record, if it's theirs, and returns it so the caller can remove the stored object. */
  deleteFile(id: string, userId: string): Promise<StoredFile | null>;

  /* billing polish */
  /** A person's stored files; with `exhbtId`, only those attached to that exhbt. */
  listFiles(userId: string, exhbtId?: string): Promise<StoredFile[]>;

  /* per-job links (docs/phase-2.md section 8, decision 0008) */
  listJobLinks(userId: string): Promise<JobLink[]>;
  getJobLink(id: string): Promise<JobLink | null>;
  /** A live link at this path on this person's host, or null when it is off or missing. */
  getLiveJobLink(userId: string, slug: string): Promise<JobLink | null>;
  createJobLink(link: NewJobLink): Promise<void>;
  /** False when the row is missing or isn't theirs. */
  updateJobLink(id: string, userId: string, patch: JobLinkPatch): Promise<boolean>;
  deleteJobLink(id: string, userId: string): Promise<boolean>;
  /** Counts one opening of a live link. No cookies, and an off link is left as it is. */
  recordJobLinkView(id: string): Promise<void>;
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
      // Rows as stored. Profiles include the portfolio fields; exhbts carry both the working copy
      // (blocks) and the published one (published_blocks). Files are metadata only, never the bytes.
      // Subscriptions hold Stripe ids and status; card details never reach us.
      const [profile, roadmaps, exhbts, files, links, subs] = await Promise.all([
        db.from("profiles").select("*").eq("id", userId).maybeSingle(),
        db.from("roadmaps").select("*").eq("user_id", userId),
        db.from("exhbts").select("*").eq("user_id", userId),
        db.from("exhbt_files").select("id, exhbt_id, bucket, path, mime, bytes, kind, created_at").eq("user_id", userId),
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
        files: files.data,
        curatedLinks: links.data,
        subscriptions: subs.data,
      };
    },
    async deleteUserData(userId) {
      // Deleting the auth user cascades to profiles and everything owned by it.
      // Storage objects are removed first, by deleteAllFiles in lib/uploads.ts (app/api/account/delete).
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

    /* billing */
    async upsertSubscription(sub) {
      const row = {
        user_id: sub.userId,
        plan: sub.plan,
        status: sub.status,
        provider_customer_id: sub.customerId,
        provider_subscription_id: sub.subscriptionId,
        renews_at: sub.renewsAt,
        ...(sub.lastEventAt ? { last_event_at: sub.lastEventAt } : {}),
      };
      if (!sub.lastEventAt) {
        check(await db.from("subscriptions").upsert(row, { onConflict: "provider_subscription_id" }));
        return true;
      }
      // Out-of-order events: update only when this event is as new as the stored one or newer.
      // One conditional update, so two deliveries racing can't let the older one win.
      const newer = async () =>
        (
          check(
            await db
              .from("subscriptions")
              .update(row)
              .eq("provider_subscription_id", sub.subscriptionId)
              .or(`last_event_at.is.null,last_event_at.lte."${sub.lastEventAt}"`)
              .select("id"),
          ) as { id: string }[]
        ).length > 0;
      if (await newer()) return true;
      const exists = check(
        await db.from("subscriptions").select("id").eq("provider_subscription_id", sub.subscriptionId).maybeSingle(),
      ) as { id: string } | null;
      if (exists) return false; // a newer event has already been applied
      const ins = await db.from("subscriptions").insert(row);
      if (!ins.error) return true;
      // Another delivery inserted the row first: compare against it.
      if (ins.error.code === "23505") return newer();
      throw new Error(ins.error.message);
    },
    async getSubscription(userId) {
      const rows = check(
        await db
          .from("subscriptions")
          .select("user_id, plan, status, provider_customer_id, provider_subscription_id, renews_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false }),
      ) as {
        user_id: string;
        plan: Plan;
        status: string;
        provider_customer_id: string | null;
        provider_subscription_id: string | null;
        renews_at: string | null;
      }[];
      const r = rows.find((x) => LIVE_SUBSCRIPTION_STATUSES.includes(x.status)) ?? rows[0];
      if (!r?.provider_subscription_id) return null;
      return {
        userId: r.user_id,
        plan: r.plan,
        status: r.status,
        customerId: r.provider_customer_id,
        subscriptionId: r.provider_subscription_id,
        renewsAt: r.renews_at,
      };
    },
    /* uploads and drafts */
    async countRecentEventsForUser(name, userId, hours) {
      const res = await db
        .from("events")
        .select("id", { count: "exact", head: true })
        .eq("name", name)
        .eq("user_id", userId)
        .gte("created_at", since(hours));
      if (res.error) throw new Error(res.error.message);
      return res.count ?? 0;
    },
    async createFile(f) {
      check(
        await db.from("exhbt_files").insert({
          id: f.id,
          user_id: f.userId,
          exhbt_id: f.exhbtId ?? null,
          bucket: f.bucket,
          path: f.path,
          mime: f.mime,
          bytes: f.bytes,
          kind: f.kind,
        }),
      );
    },
    async storageBytesUsed(userId) {
      const rows = check(await db.from("exhbt_files").select("bytes").eq("user_id", userId)) as { bytes: number }[];
      return rows.reduce((n, r) => n + r.bytes, 0);
    },
    async attachFiles(userId, exhbtId, fileIds) {
      if (!fileIds.length) return 0;
      const rows = check(
        await db
          .from("exhbt_files")
          .update({ exhbt_id: exhbtId })
          .in("id", fileIds)
          .eq("user_id", userId)
          .is("exhbt_id", null)
          .select("id"),
      ) as { id: string }[];
      return rows.length;
    },
    async deleteFile(id, userId) {
      const r = check(
        await db.from("exhbt_files").delete().eq("id", id).eq("user_id", userId).select("id, user_id, bucket, path, mime, bytes, kind").maybeSingle(),
      ) as { id: string; user_id: string; bucket: StoredFile["bucket"]; path: string; mime: string; bytes: number; kind: StoredFile["kind"] } | null;
      return r ? { id: r.id, userId: r.user_id, bucket: r.bucket, path: r.path, mime: r.mime, bytes: r.bytes, kind: r.kind } : null;
    },

    /* billing polish */
    async listFiles(userId, exhbtId) {
      let q = db.from("exhbt_files").select("id, user_id, bucket, path, mime, bytes, kind").eq("user_id", userId);
      if (exhbtId) q = q.eq("exhbt_id", exhbtId);
      const rows = check(await q) as {
        id: string;
        user_id: string;
        bucket: StoredFile["bucket"];
        path: string;
        mime: string;
        bytes: number;
        kind: StoredFile["kind"];
      }[];
      return rows.map((r) => ({ id: r.id, userId: r.user_id, bucket: r.bucket, path: r.path, mime: r.mime, bytes: r.bytes, kind: r.kind }));
    },

    async listJobLinks(userId) {
      const rows = check(
        await db.from("curated_links").select(JOB_LINK_COLS).eq("user_id", userId).order("created_at", { ascending: false }),
      ) as JobLinkRow[];
      return rows.map(fromJobLinkRow);
    },
    async getJobLink(id) {
      const row = check(await db.from("curated_links").select(JOB_LINK_COLS).eq("id", id).maybeSingle()) as JobLinkRow | null;
      return row ? fromJobLinkRow(row) : null;
    },
    async getLiveJobLink(userId, slug) {
      const row = check(
        await db
          .from("curated_links")
          .select(JOB_LINK_COLS)
          .eq("user_id", userId)
          .eq("collection_slug", slug)
          .eq("status", "live")
          .maybeSingle(),
      ) as JobLinkRow | null;
      return row ? fromJobLinkRow(row) : null;
    },
    async createJobLink(link) {
      const picks = link.picks.slice(0, 4);
      check(
        await db.from("curated_links").insert({
          id: link.id,
          user_id: link.userId,
          name: jobLinkName(link.company, link.roleTitle),
          job_listing_text: link.description,
          exhbt_ids: picks.map((p) => p.exhbtId),
          public_slug: link.id,
          collection_slug: link.slug,
          company: link.company,
          role_title: link.roleTitle,
          slug_style: link.slugStyle,
          intro: link.intro,
          ranking: picks,
          status: "live",
          view_count: 0,
        }),
      );
    },
    async updateJobLink(id, userId, patch) {
      const row: Record<string, unknown> = {};
      if (patch.intro !== undefined) row.intro = patch.intro;
      if (patch.status) row.status = patch.status;
      if (patch.slug) row.collection_slug = patch.slug;
      if (patch.slugStyle) row.slug_style = patch.slugStyle;
      if (patch.picks) {
        const picks = patch.picks.slice(0, 4);
        row.ranking = picks;
        row.exhbt_ids = picks.map((p) => p.exhbtId);
      }
      if (Object.keys(row).length === 0) return true;
      const updated = check(
        await db.from("curated_links").update(row).eq("id", id).eq("user_id", userId).select("id").maybeSingle(),
      ) as { id: string } | null;
      return Boolean(updated);
    },
    async deleteJobLink(id, userId) {
      const deleted = check(
        await db.from("curated_links").delete().eq("id", id).eq("user_id", userId).select("id").maybeSingle(),
      ) as { id: string } | null;
      return Boolean(deleted);
    },
    async recordJobLinkView(id) {
      const row = check(
        await db.from("curated_links").select("view_count").eq("id", id).eq("status", "live").maybeSingle(),
      ) as { view_count: number } | null;
      if (!row) return;
      check(await db.from("curated_links").update({ view_count: row.view_count + 1 }).eq("id", id).eq("status", "live"));
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
const JOB_LINK_COLS =
  "id, user_id, company, role_title, collection_slug, slug_style, intro, job_listing_text, ranking, exhbt_ids, status, view_count, created_at";
type JobLinkRow = {
  id: string;
  user_id: string;
  company: string | null;
  role_title: string | null;
  collection_slug: string | null;
  slug_style: string | null;
  intro: string | null;
  job_listing_text: string | null;
  ranking: unknown;
  exhbt_ids: string[] | null;
  status: string | null;
  view_count: number | null;
  created_at: string;
};
const jobLinkName = (company: string, role: string) => `${company} · ${role}`.slice(0, 200);
function picksFromRow(ranking: unknown, ids: string[] | null): JobLinkPick[] {
  if (Array.isArray(ranking)) {
    const picks: JobLinkPick[] = [];
    for (const row of ranking) {
      if (!row || typeof row !== "object") continue;
      const exhbtId = "exhbtId" in row ? String((row as { exhbtId: unknown }).exhbtId) : "";
      const reason = "reason" in row && typeof (row as { reason: unknown }).reason === "string" ? (row as { reason: string }).reason : "";
      if (exhbtId) picks.push({ exhbtId, reason });
    }
    if (picks.length) return picks.slice(0, 4);
  }
  return (ids ?? []).slice(0, 4).map((exhbtId) => ({ exhbtId, reason: "" }));
}
const fromJobLinkRow = (r: JobLinkRow): JobLink => ({
  id: r.id,
  userId: r.user_id,
  company: r.company ?? "",
  roleTitle: r.role_title ?? "",
  slug: r.collection_slug ?? "",
  slugStyle: r.slug_style === "clean" ? "clean" : "suffix",
  intro: r.intro ?? "",
  description: r.job_listing_text ?? "",
  picks: picksFromRow(r.ranking, r.exhbt_ids),
  status: r.status === "off" ? "off" : "live",
  viewCount: r.view_count ?? 0,
  createdAt: r.created_at,
});

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
  /** Stripe subscriptions by subscription id (billing). */
  subscriptions: Map<string, SubscriptionRecord>;
  jobLinks: Map<string, JobLink>;
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
  subscriptions: new Map(),
  jobLinks: new Map(),
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
  m.subscriptions ??= new Map();
  m.jobLinks ??= new Map();
  const liveSubscription = (userId: string): SubscriptionRecord | null => {
    // Newest last in insertion order, so look from the end.
    const mine = [...m.subscriptions.values()].filter((x) => x.userId === userId).reverse();
    const s = mine.find((x) => LIVE_SUBSCRIPTION_STATUSES.includes(x.status)) ?? mine[0];
    return s ? { ...s } : null;
  };
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
      // The same parts as the Supabase export: profile (portfolio fields), exhbts with both copies,
      // file metadata (no bytes) and subscriptions (no card data; we never hold any).
      const roadmaps = [...m.roadmaps.values()].filter((r) => r.userId === userId);
      const p = m.profiles.get(userId);
      return {
        exportedAt: new Date().toISOString(),
        profile: p ? { ...p } : null,
        roadmaps,
        projectIdeas: roadmaps.flatMap((r) => m.ideas.get(r.id) ?? []),
        exhbts: [...m.exhbts.values()]
          .filter((e) => e.userId === userId)
          .sort((a, b) => a.position - b.position)
          .map((e) => structuredClone(e)),
        files: [...m.files.values()].filter((f) => f.userId === userId).map((f) => ({ ...f })),
        subscriptions: [...m.subscriptions.values()].filter((x) => x.userId === userId).map((x) => ({ ...x })),
        curatedLinks: [...m.jobLinks.values()].filter((l) => l.userId === userId).map((l) => ({ ...l, picks: l.picks.map((p) => ({ ...p })) })),
      };
    },
    async deleteUserData(userId) {
      for (const [id, r] of m.roadmaps) {
        if (r.userId === userId) {
          m.roadmaps.delete(id);
          m.ideas.delete(id);
        }
      }
      for (const [id, e] of m.exhbts) if (e.userId === userId) m.exhbts.delete(id);
      // As the database cascade does: subscriptions and file records go with the account.
      for (const [id, s] of m.subscriptions) if (s.userId === userId) m.subscriptions.delete(id);
      for (const [id, f] of m.files) if (f.userId === userId) m.files.delete(id);
      for (const [id, l] of m.jobLinks) if (l.userId === userId) m.jobLinks.delete(id);
      m.profiles.delete(userId);
      m.plans.delete(userId);
    },

    async planFor(userId) {
      // The development override wins, then a live subscription, then free.
      const dev = m.plans.get(userId);
      if (dev) return dev;
      const sub = liveSubscription(userId);
      return sub && LIVE_SUBSCRIPTION_STATUSES.includes(sub.status) ? sub.plan : "free";
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

    /* billing */
    async upsertSubscription(sub) {
      const cur = m.subscriptions.get(sub.subscriptionId);
      if (cur?.lastEventAt && sub.lastEventAt && Date.parse(sub.lastEventAt) < Date.parse(cur.lastEventAt)) return false;
      m.subscriptions.set(sub.subscriptionId, { ...sub, lastEventAt: sub.lastEventAt ?? cur?.lastEventAt ?? null });
      return true;
    },
    async getSubscription(userId) {
      return liveSubscription(userId);
    },
    /* uploads and drafts */
    async countRecentEventsForUser(name, userId, hours) {
      const after = Date.now() - hours * 3_600_000;
      return m.events.filter((e) => e.name === name && e.userId === userId && Date.parse(e.at) >= after).length;
    },
    async createFile(f) {
      m.files.set(f.id, { ...f, exhbtId: f.exhbtId ?? null } as StoredFile);
    },
    async storageBytesUsed(userId) {
      return [...m.files.values()].filter((f) => f.userId === userId).reduce((n, f) => n + f.bytes, 0);
    },
    async attachFiles(userId, exhbtId, fileIds) {
      let n = 0;
      for (const id of fileIds) {
        const f = m.files.get(id) as (StoredFile & { exhbtId?: string | null }) | undefined;
        if (f && f.userId === userId && !f.exhbtId) {
          f.exhbtId = exhbtId;
          n++;
        }
      }
      return n;
    },
    async deleteFile(id, userId) {
      const f = m.files.get(id);
      if (!f || f.userId !== userId) return null;
      m.files.delete(id);
      return f;
    },

    /* billing polish */
    async listFiles(userId, exhbtId) {
      return [...m.files.values()]
        .filter((f) => f.userId === userId && (!exhbtId || (f as StoredFile & { exhbtId?: string | null }).exhbtId === exhbtId))
        .map((f) => ({ ...f }));
    },

    async listJobLinks(userId) {
      return [...m.jobLinks.values()]
        .filter((l) => l.userId === userId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((l) => ({ ...l, picks: l.picks.map((p) => ({ ...p })) }));
    },
    async getJobLink(id) {
      const l = m.jobLinks.get(id);
      return l ? { ...l, picks: l.picks.map((p) => ({ ...p })) } : null;
    },
    async getLiveJobLink(userId, slug) {
      const l = [...m.jobLinks.values()].find((x) => x.userId === userId && x.slug === slug && x.status === "live");
      return l ? { ...l, picks: l.picks.map((p) => ({ ...p })) } : null;
    },
    async createJobLink(link) {
      m.jobLinks.set(link.id, {
        ...link,
        picks: link.picks.slice(0, 4).map((p) => ({ ...p })),
        status: "live",
        viewCount: 0,
        createdAt: new Date().toISOString(),
      });
    },
    async updateJobLink(id, userId, patch) {
      const l = m.jobLinks.get(id);
      if (!l || l.userId !== userId) return false;
      if (patch.intro !== undefined) l.intro = patch.intro;
      if (patch.status) l.status = patch.status;
      if (patch.slug) l.slug = patch.slug;
      if (patch.slugStyle) l.slugStyle = patch.slugStyle;
      if (patch.picks) l.picks = patch.picks.slice(0, 4).map((p) => ({ ...p }));
      return true;
    },
    async deleteJobLink(id, userId) {
      const l = m.jobLinks.get(id);
      if (!l || l.userId !== userId) return false;
      m.jobLinks.delete(id);
      return true;
    },
    async recordJobLinkView(id) {
      const l = m.jobLinks.get(id);
      if (l && l.status === "live") l.viewCount += 1;
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
