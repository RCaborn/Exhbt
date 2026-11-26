import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { forgetDevPassword } from "./passwords";
import type { Project, Roadmap, RoadmapInput } from "./ai/schemas";
import { normaliseDoc, publicDoc, validateForPublish, type ExhbtDoc } from "./exhbt/blocks";
import { fileIdsIn, looksLikeFileId, withoutFiles } from "./exhbt/doc-files";
import type { Plan } from "./entitlements";
import { normaliseLayout, type PortfolioLayout } from "./portfolio-layout";
import { accountPlan, cleanQuery, type AdminAccountDetail, type AdminAccountRow, type AdminAccountsPage, type AdminRows, type AdminTable } from "./admin-types";
import { sbAdminAccount, sbAdminAccounts, sbAdminRows, sbIsAdmin } from "./admin-supabase";

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
  /** When the plan's ideas were last started (docs/decisions/0019). Null: never. */
  ideasStartedAt: string | null;
  /** When the last try failed. Counts only if it is not before `ideasStartedAt`. */
  ideasFailedAt: string | null;
  /** How many times they've been started, for the retry limit. */
  ideasAttempts: number;
  createdAt: string;
};

/** How `claimIdeasRun` answered. */
export type IdeasClaim = "claimed" | "running" | "failed" | "limit";

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

/** What each person can keep in their saved list. An abuse guard, not a plan figure. */
export const SAVED_IDEAS_CAP = 200;

/**
 * A project idea someone saved, as a copy: it keeps its words, the job it came from and (while
 * it exists) the roadmap, so a swap or a deleted roadmap never changes it.
 */
export type SavedIdea = Project & {
  id: string;
  userId: string;
  /** The roadmap it was saved from; null once that roadmap is gone. */
  roadmapId: string | null;
  /** The target job of that roadmap, as the person typed it. */
  targetRole: string;
  createdAt: string;
};

/** The profile fields a person sets themselves (the portfolio builder, decision 0016). */
export type PortfolioProfileField =
  | "name"
  | "headline"
  | "bio"
  | "photoFileId"
  | "linkedin"
  | "github"
  | "website"
  | "contactEmail"
  | "location"
  | "lookingFor"
  | "hideFromSearch"
  | "themeId";

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
  /** Where they are, in their words ("Leeds", "London or remote"). */
  location: string | null;
  /** One line on what they want next. */
  lookingFor: string | null;
  /** An https github.com address. */
  github: string | null;
  /** An https address of their own site. */
  website: string | null;
  /** An email shown as text on the page (never a mailto). Not the sign-in address unless they type it. */
  contactEmail: string | null;
  /** The chosen portfolio look (lib/portfolio-themes.ts), kept even if the plan later drops it. Null: the default. */
  themeId: string | null;
  /** The exhbt shown first, as a wide tile (decision 0014). Null: none. */
  featuredExhbtId: string | null;
  /** How the at-a-glance page is arranged: where the extra tiles sit, their words, the header bits (lib/portfolio-layout.ts). */
  layout: PortfolioLayout;
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
  /** The team project this was made from, for a teammate's own exhbt (decision 0013). Null otherwise. */
  teamOf?: string | null;
  /** Left off the at-a-glance page by the person. Still live at its own link (decision 0014). Absent means false. */
  hiddenOnPortfolio?: boolean;
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
  /** SHA-256 of the bytes (hex), set once the upload has landed. Null before then, and for helper files. */
  sha256?: string | null;
};

/** A file with the same fingerprint on another account: which exhbt it's attached to, and when it was stored. */
export type HashedFile = { file: StoredFile; exhbtId: string; createdAt: string };

/** An accepted teammate on an exhbt (exhbt_members). A byline, not content: no words are counted. */
export type TeamMember = { exhbtId: string; userId: string; role: string; addedAt: string };

/** An invite to join an exhbt (exhbt_invites). Open while neither accepted nor cancelled; usable until it expires. */
export type TeamInvite = {
  id: string;
  exhbtId: string;
  email: string;
  role: string;
  /** SHA-256 of the signed token in the link; the token itself is never stored. */
  tokenHash: string;
  createdAt: string;
  expiresAt: string;
  acceptedAt: string | null;
  cancelledAt: string | null;
};

export type DuplicateOutcome = "shown" | "asked" | "approved" | "declined" | "mine" | "repeat";

/** One match between an upload and a file on another account's exhbt (duplicate_matches). Never public. */
export type DuplicateMatch = {
  id: string;
  sha256: string;
  uploaderId: string;
  uploaderFileId: string | null;
  ownerId: string;
  ownerFileId: string | null;
  ownerExhbtId: string | null;
  outcome: DuplicateOutcome;
  /** What the uploader said they did, when they asked to join. */
  role: string | null;
  createdAt: string;
  /** When the uploader answered (asked or mine). */
  answeredAt: string | null;
  /** When the owner answered (approved or declined). */
  decidedAt: string | null;
};

export type NewDuplicateMatch = Pick<DuplicateMatch, "sha256" | "uploaderId" | "uploaderFileId" | "ownerId" | "ownerFileId" | "ownerExhbtId" | "outcome">;

export type UsernameLookup = { userId: string; username: string } | { redirectTo: string } | null;

export type AICall = {
  userId: string | null;
  step: "roadmap" | "exhbt_draft" | "exhbt_rewrite" | "originality" | "link_ranking" | "project_ideas" | "cv_read" | "file_transcribe" | "portfolio_intro" | "figure_pick";
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
  | "ideas_completed"
  | "ideas_failed"
  | "cv_read_ai"
  | "cv_read_failed"
  | "login_link_sent"
  | "login_attempt"
  | "subscription_changed"
  | "username_claimed"
  | "exhbt_drafted"
  | "file_uploaded"
  | "file_read_ai"
  | "figure_picked"
  | "figure_added"
  | "job_link_created"
  | "job_link_fetched"
  | "exhbt_rewritten"
  | "teammate_invited"
  | "teammate_joined"
  | "file_matched"
  | "intro_suggested"
  | "referral_recorded"
  | "referral_credited"
  | "page_view"
  // Failed AI calls (lib/ai-failures.ts, decision 0029): feature, reason, status and tokens, never any text.
  | "exhbt_draft_failed"
  | "exhbt_rewrite_failed"
  | "figure_pick_failed"
  | "job_match_failed"
  | "intro_failed"
  | "swap_failed"
  | "file_read_failed";

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

/** A referral (decision 0020): pending until the referred person's first payment, then earned, then credited. */
export type ReferralStatus = "pending" | "earned" | "credited";
export type ReferralRecord = {
  id: string;
  referrerId: string;
  /** Null once the referred person has deleted their account. */
  referredId: string | null;
  status: ReferralStatus;
  createdAt: string;
  earnedAt: string | null;
  creditedAt: string | null;
  /** Stripe's balance transaction id once credited. */
  creditRef: string | null;
};

/** Statuses that keep a paid plan. past_due keeps it while Stripe retries the card. */
export const LIVE_SUBSCRIPTION_STATUSES = ["active", "trialing", "past_due"];

export type WaitlistInterest = "premium" | "max" | "university";

/** One exhbt picked for a job link, with the one-line reason it fits. */
export type JobLinkPick = { exhbtId: string; reason: string };

/**
 * A per-job link (curated_links; docs/phase-2.md section 8, decision 0008): a page on the
 * person's portfolio host for one job, showing their best-fitting exhbts in the order they chose.
 */
export type JobLink = {
  id: string;
  userId: string;
  company: string;
  roleTitle: string;
  /** The path after the person's host, unique among their exhbt and job-link slugs (lib/slugs.ts). */
  slug: string;
  slugStyle: "clean" | "suffix";
  intro: string;
  /** In the order shown, at most EXHBTS_PER_JOB_LINK. */
  picks: JobLinkPick[];
  listingText: string | null;
  listingUrl: string | null;
  status: "live" | "off";
  viewCount: number;
  createdAt: string;
};

export type NewJobLink = Omit<JobLink, "id" | "status" | "viewCount" | "createdAt">;

export type JobLinkChanges = Partial<
  Pick<JobLink, "company" | "roleTitle" | "slug" | "slugStyle" | "intro" | "picks" | "status" | "listingText" | "listingUrl">
>;

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
  /**
   * Saves a roadmap's output if it has none yet. Returns false, and changes nothing, when another
   * generation saved one first (a reload or a second tab): the first result saved wins.
   */
  saveRoadmapOutput(id: string, output: Roadmap): Promise<boolean>;
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
   * Takes the one right to make a roadmap's ideas, so two requests racing never pay for two
   * calls. "running": another try started less than `staleMs` ago and hasn't failed. "failed": the
   * last try failed and `retry` is false. "limit": `maxAttempts` tries used. Otherwise "claimed".
   */
  claimIdeasRun(roadmapId: string, opts: { staleMs: number; maxAttempts: number; retry: boolean }): Promise<IdeasClaim>;
  /** Records that the try ended in failure (success needs no record: the ideas exist). */
  failIdeasRun(roadmapId: string): Promise<void>;
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
  /** `email`: the account's address, so invites sent to it are included. */
  exportUserData(userId: string, email?: string): Promise<Record<string, unknown>>;
  /** `email`: the account's address, so open invites sent to it go too. */
  deleteUserData(userId: string, email?: string): Promise<void>;

  /* Phase 2: portfolios and exhbts (docs/phase-2.md) */
  /** The plan that applies now: an active subscription, else an institution licence, else free. */
  planFor(userId: string): Promise<Plan>;
  getPortfolioProfile(userId: string): Promise<PortfolioProfile>;
  /** A username to its owner, or to the name it now redirects to (for 30 days after a change). */
  lookupUsername(username: string): Promise<UsernameLookup>;
  /** The account email for a username, including one that still redirects. Null if nobody has that name. */
  loginEmailForUsername(username: string): Promise<string | null>;
  /** Sets or changes the username; the old one redirects for 30 days. "taken" if someone else has it. */
  claimUsername(userId: string, username: string): Promise<"ok" | "taken">;
  updatePortfolioProfile(
    userId: string,
    fields: Partial<Pick<PortfolioProfile, PortfolioProfileField>>,
  ): Promise<void>;
  /**
   * `createExhbt` and `saveExhbtDraft` are the only ways a doc is written, and both drop any image
   * or work file that isn't the person's own (stripped, never refused: see lib/exhbt/doc-files.ts).
   * `teamOf`: the team project a teammate's own exhbt is made from (decision 0013).
   */
  createExhbt(userId: string, doc: ExhbtDoc, opts?: { teamOf?: string | null }): Promise<string>;
  getExhbt(id: string): Promise<ExhbtRecord | null>;
  /** All of a person's exhbts, drafts included, in portfolio order. */
  listExhbts(userId: string): Promise<ExhbtRecord[]>;
  /** Saves the working copy. Never blocked by limits. False if it isn't theirs. */
  saveExhbtDraft(id: string, userId: string, doc: ExhbtDoc): Promise<boolean>;
  /**
   * Copies the working copy to the live one and marks it published with this slug.
   * The plan check happens before this is called (lib/plan.ts). The doc that is copied is checked here
   * (validateForPublish, and no flagged numbers left), whatever was checked before, so a save that lands
   * between the caller's check and this cannot slip past it: false, and nothing is published.
   * `unchecked` is for the development seeding routes (app/dev/*) only, which publish fixtures as they are.
   */
  publishExhbt(id: string, userId: string, slug: string, opts?: { unchecked?: boolean }): Promise<boolean>;
  unpublishExhbt(id: string, userId: string): Promise<boolean>;
  /** Sets portfolio order to the order of `ids`. */
  reorderExhbts(userId: string, ids: string[]): Promise<void>;
  /**
   * Saves the customiser's arrangement in one go (decision 0014): the layout and the featured exhbt
   * on the profile, which of their exhbts are hidden, and the portfolio order (`order` is every one
   * of their exhbts' ids). The caller has checked it all against the plan and ownership.
   */
  savePortfolioLayout(userId: string, change: { layout: PortfolioLayout; featuredExhbtId: string | null; hiddenIds: string[]; order: string[] }): Promise<void>;
  deleteExhbt(id: string, userId: string): Promise<boolean>;
  getFile(id: string): Promise<StoredFile | null>;
  /** Which of these file ids are stored records belonging to this user. The one ownership question. */
  ownedFileIds(userId: string, ids: string[]): Promise<Set<string>>;

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
  /**
   * Takes back the one event of this user's that was logged with `claim` in its props. For a limit
   * that is counted before the work is done (a figure pick) and given back when the work never
   * happened. It names its own event by the claim, never "the latest", which with requests that
   * overlap is another request's. A failure is reported and leaves the event counted.
   */
  returnEvent(name: EventName, userId: string, claim: string): Promise<void>;
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

  /* draft tools */
  /** Events with this name for one exhbt (props.exhbtId), all time. Counts rewrites against the plan's limit. */
  countEventsForExhbt(name: EventName, userId: string, exhbtId: string): Promise<number>;

  /* job links */
  createJobLink(link: NewJobLink): Promise<string>;
  /** A person's job links, newest first. */
  listJobLinks(userId: string): Promise<JobLink[]>;
  getJobLink(id: string): Promise<JobLink | null>;
  getJobLinkBySlug(userId: string, slug: string): Promise<JobLink | null>;
  /** Changes the fields given. False if the link isn't theirs. */
  updateJobLink(id: string, userId: string, changes: JobLinkChanges): Promise<boolean>;
  deleteJobLink(id: string, userId: string): Promise<boolean>;
  /** Links that are switched on, for the plan's jobLinksActive cap. */
  countActiveJobLinks(userId: string): Promise<number>;
  /** One more view of a live link. A count only: no cookie, no visitor record. */
  incrementJobLinkViews(id: string): Promise<void>;

  /* saved ideas */
  /** Every roadmap this person owns, newest first. */
  listRoadmapsFor(userId: string): Promise<RoadmapRecord[]>;
  /**
   * Keeps a copy of an idea. "already" if this roadmap's idea with the same title is saved,
   * "full" at SAVED_IDEAS_CAP; either way nothing is added.
   */
  saveIdea(
    userId: string,
    saved: { roadmapId: string | null; targetRole: string; idea: Project },
  ): Promise<"saved" | "already" | "full">;
  /** The person's saved ideas, newest first. */
  listSavedIdeas(userId: string): Promise<SavedIdea[]>;
  /** One saved idea, only if it is theirs. */
  getSavedIdea(id: string, userId: string): Promise<SavedIdea | null>;
  /** Which of a roadmap's ideas (by title) the person has saved: the batch lookup behind the stars. */
  savedTitlesForRoadmap(userId: string, roadmapId: string): Promise<string[]>;
  /** Removes a saved idea, only if it is theirs. */
  removeSavedIdea(id: string, userId: string): Promise<boolean>;

  /* teammates (decision 0013) */
  /** The account's email address, for team emails. Null if unknown. */
  emailFor(userId: string): Promise<string | null>;
  /** An exhbt's accepted teammates, earliest first. */
  listMembers(exhbtId: string): Promise<TeamMember[]>;
  /** The exhbts a person is a teammate on (not their own), earliest first. */
  listMembershipsFor(userId: string): Promise<TeamMember[]>;
  /** Adds a teammate. "already" if they're on it, changing nothing. The cap is checked by the caller (lib/team.ts). */
  addMember(m: Omit<TeamMember, "addedAt">): Promise<"added" | "already">;
  /**
   * Takes a teammate off an exhbt. Their own exhbts made from it stop pointing at it (team_of
   * cleared), so neither page shows the other. False if they weren't on it.
   */
  removeMember(exhbtId: string, userId: string): Promise<boolean>;
  /** Exhbts made from this team project by teammates (team_of = rootId). */
  listTeamVersions(rootId: string): Promise<ExhbtRecord[]>;
  /** Records an invite. The id is chosen by the caller, as the signed token carries it. */
  createInvite(i: Omit<TeamInvite, "createdAt" | "acceptedAt" | "cancelledAt">): Promise<void>;
  getInvite(id: string): Promise<TeamInvite | null>;
  /** An exhbt's open invites (neither accepted nor cancelled, expired included), newest first. */
  listInvites(exhbtId: string): Promise<TeamInvite[]>;
  /** A fresh token and expiry for an open invite ("Resend"). False if it isn't open or isn't on that exhbt. */
  renewInvite(id: string, exhbtId: string, tokenHash: string, expiresAt: string): Promise<boolean>;
  /** False if it isn't open or isn't on that exhbt. */
  cancelInvite(id: string, exhbtId: string): Promise<boolean>;
  /** Marks an open invite accepted, once: a second caller gets false. */
  markInviteAccepted(id: string): Promise<boolean>;

  /* private duplicate matching (decision 0013) */
  /** Stores the upload's fingerprint, if the file is theirs. */
  setFileHash(fileId: string, userId: string, sha256: string): Promise<void>;
  /** Files with this fingerprint on other accounts, attached to an exhbt, oldest first. */
  findFilesByHash(sha256: string, exceptUserId: string): Promise<HashedFile[]>;
  createDuplicateMatch(m: NewDuplicateMatch): Promise<string>;
  getDuplicateMatch(id: string): Promise<DuplicateMatch | null>;
  /** The most recent match between this uploader and this exhbt, if any. */
  latestDuplicateMatch(uploaderId: string, ownerExhbtId: string): Promise<DuplicateMatch | null>;
  /**
   * Moves a match on, only from the outcome given, so a double click or two tabs change it once.
   * Sets answered_at (asked, mine) or decided_at (approved, declined). False if it had moved on.
   */
  updateDuplicateMatch(id: string, from: DuplicateOutcome, to: DuplicateOutcome, role?: string | null): Promise<boolean>;
  /** Requests to join waiting on this owner (outcome asked), oldest first; with `exhbtId`, only that exhbt's. */
  listJoinRequests(ownerId: string, exhbtId?: string): Promise<DuplicateMatch[]>;

  /* referrals (decision 0020) */
  /** The person's referral code, made on first ask. Never changes. */
  getReferralCode(userId: string): Promise<string>;
  /** Whose code this is, or null. */
  findUserByReferralCode(code: string): Promise<string | null>;
  /** Records that referrer brought in referred. False if referred already has a referrer, or they are the same account. */
  recordReferral(referrerId: string, referredId: string): Promise<boolean>;
  /** The referral where this person is the referred one. */
  getReferralByReferred(referredId: string): Promise<ReferralRecord | null>;
  /** Pending to earned, once. Returns the referral if it is earned afterwards (so a retry carries on), else null. */
  markReferralEarned(referredId: string): Promise<ReferralRecord | null>;
  /** Earned referrals waiting on this referrer being a Stripe customer. */
  listEarnedReferrals(referrerId: string): Promise<ReferralRecord[]>;
  /** Earned to credited, once. False if it had already moved on. */
  markReferralCredited(id: string, creditRef: string): Promise<boolean>;
  /** The referrer's own side, for the account box. Never says who the referred person is. */
  referralSummary(referrerId: string): Promise<{ credited: number; waiting: number }>;

  /* admin (decision 0021). Every method re-checks that `actorId` is an exhbt_admin and throws "forbidden" if not. */
  /** Whether this account's profiles.role is exhbt_admin. */
  isAdmin(userId: string): Promise<boolean>;
  /** Lean rows of one table for the overview. `since` (ISO) narrows the tables that have a date, except the all-time ones (ALL_TIME_TABLES). */
  adminRows<T extends AdminTable>(actorId: string, table: T, since: string | null): Promise<AdminRows<T>>;
  /** The accounts table: newest first, searched by email or username, one page. */
  adminAccounts(actorId: string, opts: { q: string; page: number; pageSize: number }): Promise<AdminAccountsPage>;
  /** One account, read-only; null if there is none. */
  adminAccount(actorId: string, userId: string): Promise<AdminAccountDetail | null>;
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
  ideas_started_at: string | null;
  ideas_failed_at: string | null;
  ideas_attempts: number | null;
  created_at: string;
};

/** The claim decision, shared by both stores: null means "go ahead and claim". */
function ideasClaimBlock(
  r: { ideasStartedAt: string | null; ideasFailedAt: string | null; ideasAttempts: number },
  o: { staleMs: number; maxAttempts: number; retry: boolean },
): Exclude<IdeasClaim, "claimed"> | null {
  const started = r.ideasStartedAt ? Date.parse(r.ideasStartedAt) : null;
  const failed = started !== null && r.ideasFailedAt !== null && Date.parse(r.ideasFailedAt) >= started;
  if (started !== null && !failed && Date.now() - started < o.staleMs) return "running";
  if (r.ideasAttempts >= o.maxAttempts) return "limit";
  if (failed && !o.retry) return "failed";
  return null;
}

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
  ideasStartedAt: r.ideas_started_at ?? null,
  ideasFailedAt: r.ideas_failed_at ?? null,
  ideasAttempts: r.ideas_attempts ?? 0,
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

type SavedIdeaRow = {
  id: string;
  user_id: string;
  roadmap_id: string | null;
  target_role: string;
  title: string;
  brief: string;
  closes_gaps: string[];
  deliverable: string;
  weeks: number;
  created_at: string;
};

const savedFromRow = (r: SavedIdeaRow): SavedIdea => ({
  id: r.id,
  userId: r.user_id,
  roadmapId: r.roadmap_id,
  targetRole: r.target_role,
  title: r.title,
  brief: r.brief,
  closesGaps: r.closes_gaps ?? [],
  deliverable: r.deliverable,
  weeks: r.weeks,
  createdAt: r.created_at,
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
  const ownedIds = async (userId: string, ids: string[]): Promise<Set<string>> => {
    const valid = ids.filter(looksLikeFileId);
    if (!valid.length) return new Set();
    const rows = check(await db.from("exhbt_files").select("id").eq("user_id", userId).in("id", valid)) as { id: string }[];
    return new Set(rows.map((r) => r.id));
  };
  /** The doc without any file that isn't theirs: the one place a write is checked. */
  const ownDocOnly = async (doc: ExhbtDoc, userId: string): Promise<ExhbtDoc> => {
    const ids = fileIdsIn(doc);
    return ids.length ? withoutFiles(doc, await ownedIds(userId, ids)) : doc;
  };
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
      // Conditional update: only the first generation to finish saves its output.
      const rows = check(await db.from("roadmaps").update({ output_json: output }).eq("id", id).is("output_json", null).select("id")) as { id: string }[];
      return rows.length === 1;
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
    async claimIdeasRun(roadmapId, opts) {
      const row = check(
        await db
          .from("roadmaps")
          .select("ideas_started_at, ideas_failed_at, ideas_attempts")
          .eq("id", roadmapId)
          .maybeSingle(),
      ) as Pick<RoadmapRow, "ideas_started_at" | "ideas_failed_at" | "ideas_attempts"> | null;
      if (!row) return "limit";
      const state = {
        ideasStartedAt: row.ideas_started_at,
        ideasFailedAt: row.ideas_failed_at,
        ideasAttempts: row.ideas_attempts ?? 0,
      };
      const blocked = ideasClaimBlock(state, opts);
      if (blocked) return blocked;
      // Compare-and-set on the attempt count, which only ever goes up: of two callers that read the
      // same row, only one update matches.
      const won = check(
        await db
          .from("roadmaps")
          .update({ ideas_started_at: new Date().toISOString(), ideas_failed_at: null, ideas_attempts: state.ideasAttempts + 1 })
          .eq("id", roadmapId)
          .eq("ideas_attempts", state.ideasAttempts)
          .select("id"),
      ) as { id: string }[];
      return won.length === 1 ? "claimed" : "running";
    },
    async failIdeasRun(roadmapId) {
      check(await db.from("roadmaps").update({ ideas_failed_at: new Date().toISOString() }).eq("id", roadmapId));
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
    async exportUserData(userId, email) {
      // Rows as stored. Profiles include the portfolio fields; exhbts carry both the working copy
      // (blocks) and the published one (published_blocks). Files are metadata only, never the bytes.
      // Subscriptions hold Stripe ids and status; card details never reach us.
      const [profile, roadmaps, exhbts, files, links, subs, saved, memberships] = await Promise.all([
        db.from("profiles").select("*").eq("id", userId).maybeSingle(),
        db.from("roadmaps").select("*").eq("user_id", userId),
        db.from("exhbts").select("*").eq("user_id", userId),
        db.from("exhbt_files").select("id, exhbt_id, bucket, path, mime, bytes, kind, sha256, created_at").eq("user_id", userId),
        db.from("curated_links").select("*").eq("user_id", userId),
        db.from("subscriptions").select("*").eq("user_id", userId),
        db.from("saved_ideas").select("*").eq("user_id", userId),
        db.from("exhbt_members").select("exhbt_id, role, added_at").eq("user_id", userId),
      ]);
      const roadmapIds = ((roadmaps.data ?? []) as { id: string }[]).map((r) => r.id);
      const exhbtIds = ((exhbts.data ?? []) as { id: string }[]).map((r) => r.id);
      const address = email ?? (profile.data as { email?: string } | null)?.email ?? null;
      const none = { data: [] };
      const [ideas, teammates, sent, received, uploads, owned] = await Promise.all([
        roadmapIds.length ? db.from("project_ideas").select("*").in("roadmap_id", roadmapIds) : none,
        exhbtIds.length ? db.from("exhbt_members").select("exhbt_id, user_id, role, added_at").in("exhbt_id", exhbtIds) : none,
        exhbtIds.length ? db.from("exhbt_invites").select(INVITE_EXPORT_COLS).in("exhbt_id", exhbtIds) : none,
        address ? db.from("exhbt_invites").select(INVITE_EXPORT_COLS).eq("email", address.toLowerCase()) : none,
        // File matches: only this person's side of each one, never who the other account is.
        db.from("duplicate_matches").select("sha256, uploader_file_id, outcome, role, created_at, answered_at, decided_at").eq("uploader_id", userId),
        db
          .from("duplicate_matches")
          .select("sha256, owner_file_id, owner_exhbt_id, outcome, created_at, decided_at")
          .eq("owner_id", userId)
          .in("outcome", ["asked", "approved", "declined"]),
      ]);
      // Referrals: only this person's side. Who they referred, and who referred them, stays out.
      const [referralsMade, referredBy] = await Promise.all([
        db.from("referrals").select("status, created_at, earned_at, credited_at").eq("referrer_id", userId),
        db.from("referrals").select("status, created_at").eq("referred_id", userId).maybeSingle(),
      ]);
      return {
        exportedAt: new Date().toISOString(),
        profile: profile.data,
        referralsYouMade: referralsMade.data,
        referralOnYourAccount: referredBy.data,
        roadmaps: roadmaps.data,
        projectIdeas: ideas.data,
        exhbts: exhbts.data,
        files: files.data,
        curatedLinks: links.data,
        subscriptions: subs.data,
        savedIdeas: saved.data,
        teamMemberships: memberships.data,
        teammatesOnYourExhbts: teammates.data,
        invitesYouSent: sent.data,
        invitesToYou: received.data,
        fileMatchesOnYourUploads: uploads.data,
        joinRequestsOnYourExhbts: owned.data,
      };
    },
    async deleteUserData(userId, email) {
      // Deleting the auth user cascades to profiles and everything owned by it: exhbts (with their
      // invites and teammates), memberships, and file matches on either side. Invites sent to this
      // address aren't owned by the account, so they go first. A teammate's own exhbt made from one
      // of theirs keeps its copied files and loses the link (team_of on delete set null).
      // Storage objects are removed first, by deleteAllFiles in lib/uploads.ts (app/api/account/delete).
      const address =
        email ?? (check(await db.from("profiles").select("email").eq("id", userId).maybeSingle()) as { email: string | null } | null)?.email;
      if (address) check(await db.from("exhbt_invites").delete().eq("email", address.toLowerCase()));
      // Referrals: one still waiting on this person's first payment goes with them. An earned or
      // credited one stays with the link to them cleared (referred_id on delete set null), so the
      // referrer keeps what they earned.
      check(await db.from("referrals").delete().eq("referred_id", userId).eq("status", "pending"));
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
          .select(
            "id, username, name, headline, bio, photo_file_id, linkedin_url, hide_from_search, portfolio_theme, featured_exhbt_id, portfolio_layout, location, looking_for, github_url, website_url, contact_email",
          )
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
    async loginEmailForUsername(username) {
      const row = check(await db.from("profiles").select("email").eq("username", username).maybeSingle()) as { email: string } | null;
      if (row?.email) return row.email;
      const red = check(
        await db
          .from("username_redirects")
          .select("user_id")
          .eq("old_username", username)
          .gt("expires_at", new Date().toISOString())
          .maybeSingle(),
      ) as { user_id: string } | null;
      if (!red) return null;
      const owner = check(await db.from("profiles").select("email").eq("id", red.user_id).maybeSingle()) as { email: string } | null;
      return owner?.email ?? null;
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
      if (f.themeId !== undefined) row.portfolio_theme = f.themeId;
      if (f.location !== undefined) row.location = f.location;
      if (f.lookingFor !== undefined) row.looking_for = f.lookingFor;
      if (f.github !== undefined) row.github_url = f.github;
      if (f.website !== undefined) row.website_url = f.website;
      if (f.contactEmail !== undefined) row.contact_email = f.contactEmail;
      if (Object.keys(row).length) check(await db.from("profiles").update(row).eq("id", userId));
    },
    async createExhbt(userId, doc, opts) {
      const last = check(
        await db.from("exhbts").select("position").eq("user_id", userId).order("position", { ascending: false }).limit(1).maybeSingle(),
      ) as { position: number } | null;
      const row = check(
        await db
          .from("exhbts")
          .insert({
            user_id: userId,
            title: doc.title.slice(0, 80),
            blocks: await ownDocOnly(doc, userId),
            position: (last?.position ?? -1) + 1,
            team_of: opts?.teamOf ?? null,
          })
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
      doc = await ownDocOnly(doc, userId);
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
    async publishExhbt(id, userId, slug, opts) {
      const cur = check(await db.from("exhbts").select("blocks").eq("id", id).eq("user_id", userId).maybeSingle()) as {
        blocks: ExhbtDoc;
      } | null;
      if (!cur) return false;
      if (!opts?.unchecked && !publishable(cur.blocks)) return false;
      const now = new Date().toISOString();
      check(
        await db
          .from("exhbts")
          // The public copy: a graph with protected numbers keeps only its index (decision 0011).
          // publicDoc reads an old (pre-sections) doc as sections first (decision 0015).
          .update({ published_blocks: publicDoc(cur.blocks), status: "published", public_slug: slug, confirmed_at: now, published_at: now })
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
    async savePortfolioLayout(userId, c) {
      check(await db.from("profiles").update({ portfolio_layout: c.layout, featured_exhbt_id: c.featuredExhbtId }).eq("id", userId));
      // Unhide whatever is not in the list, then hide what is (never everything at once, so a reader never sees a gap).
      const unhide = db.from("exhbts").update({ hidden_on_portfolio: false }).eq("user_id", userId).eq("hidden_on_portfolio", true);
      check(c.hiddenIds.length ? await unhide.not("id", "in", `(${c.hiddenIds.join(",")})`) : await unhide);
      if (c.hiddenIds.length) check(await db.from("exhbts").update({ hidden_on_portfolio: true }).eq("user_id", userId).in("id", c.hiddenIds));
      await Promise.all(c.order.map((id, position) => db.from("exhbts").update({ position }).eq("id", id).eq("user_id", userId)));
    },
    async deleteExhbt(id, userId) {
      const rows = check(await db.from("exhbts").delete().eq("id", id).eq("user_id", userId).select("id")) as { id: string }[];
      return rows.length > 0;
    },
    async ownedFileIds(userId, ids) {
      return ownedIds(userId, ids);
    },
    async getFile(id) {
      const r = check(await db.from("exhbt_files").select(FILE_COLS).eq("id", id).maybeSingle()) as FileRow | null;
      return r ? fromFileRow(r) : null;
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
    async returnEvent(name, userId, claim) {
      // As logEvent: it must never break a user flow.
      const { error } = await db.from("events").delete().eq("name", name).eq("user_id", userId).eq("props->>claim", claim);
      if (error) console.error("event return failed", error.message);
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
          sha256: f.sha256 ?? null,
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
      const r = check(await db.from("exhbt_files").delete().eq("id", id).eq("user_id", userId).select(FILE_COLS).maybeSingle()) as FileRow | null;
      return r ? fromFileRow(r) : null;
    },

    /* billing polish */
    async listFiles(userId, exhbtId) {
      let q = db.from("exhbt_files").select(FILE_COLS).eq("user_id", userId);
      if (exhbtId) q = q.eq("exhbt_id", exhbtId);
      return (check(await q.order("created_at", { ascending: true })) as FileRow[]).map(fromFileRow);
    },

    /* draft tools */
    async countEventsForExhbt(name, userId, exhbtId) {
      const res = await db
        .from("events")
        .select("id", { count: "exact", head: true })
        .eq("name", name)
        .eq("user_id", userId)
        .eq("props->>exhbtId", exhbtId);
      if (res.error) throw new Error(res.error.message);
      return res.count ?? 0;
    },

    /* job links */
    async createJobLink(l) {
      const row = check(
        await db
          .from("curated_links")
          .insert({ user_id: l.userId, ...jobLinkColumns(l) })
          .select("id")
          .single(),
      ) as { id: string };
      return row.id;
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
    async getJobLinkBySlug(userId, slug) {
      const row = check(
        await db.from("curated_links").select(JOB_LINK_COLS).eq("user_id", userId).eq("collection_slug", slug).maybeSingle(),
      ) as JobLinkRow | null;
      return row ? fromJobLinkRow(row) : null;
    },
    async updateJobLink(id, userId, changes) {
      const cur = check(
        await db.from("curated_links").select(JOB_LINK_COLS).eq("id", id).eq("user_id", userId).maybeSingle(),
      ) as JobLinkRow | null;
      if (!cur) return false;
      const next = { ...fromJobLinkRow(cur), ...changes };
      const rows = check(
        await db.from("curated_links").update(jobLinkColumns(next)).eq("id", id).eq("user_id", userId).select("id"),
      ) as { id: string }[];
      return rows.length > 0;
    },
    async deleteJobLink(id, userId) {
      const rows = check(await db.from("curated_links").delete().eq("id", id).eq("user_id", userId).select("id")) as { id: string }[];
      return rows.length > 0;
    },
    async countActiveJobLinks(userId) {
      const res = await db.from("curated_links").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("status", "live");
      if (res.error) throw new Error(res.error.message);
      return res.count ?? 0;
    },
    async incrementJobLinkViews(id) {
      // Atomic in the database (20261116000000_job_links.sql). A failed count never breaks the page.
      const { error } = await db.rpc("increment_job_link_views", { link_id: id });
      if (error) console.error("job link view count failed", error.message);
    },

    /* saved ideas */
    async listRoadmapsFor(userId) {
      const rows = check(
        await db.from("roadmaps").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
      ) as RoadmapRow[];
      return rows.map(fromRow);
    },
    async saveIdea(userId, { roadmapId, targetRole, idea }) {
      const count = await db.from("saved_ideas").select("id", { count: "exact", head: true }).eq("user_id", userId);
      if (count.error) throw new Error(count.error.message);
      if ((count.count ?? 0) >= SAVED_IDEAS_CAP) return "full";
      // Unique on (user, roadmap, title): a double click saves once.
      const row = {
        user_id: userId,
        roadmap_id: roadmapId,
        target_role: targetRole.slice(0, 300),
        ...ideaFields(idea),
      };
      const res = check(
        await db
          .from("saved_ideas")
          .upsert(row, { onConflict: "user_id,roadmap_id,title", ignoreDuplicates: true })
          .select("id"),
      ) as { id: string }[];
      return res.length === 1 ? "saved" : "already";
    },
    async listSavedIdeas(userId) {
      const rows = check(
        await db.from("saved_ideas").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
      ) as SavedIdeaRow[];
      return rows.map(savedFromRow);
    },
    async getSavedIdea(id, userId) {
      const row = check(
        await db.from("saved_ideas").select("*").eq("id", id).eq("user_id", userId).maybeSingle(),
      ) as SavedIdeaRow | null;
      return row ? savedFromRow(row) : null;
    },
    async savedTitlesForRoadmap(userId, roadmapId) {
      const rows = check(
        await db.from("saved_ideas").select("title").eq("user_id", userId).eq("roadmap_id", roadmapId),
      ) as { title: string }[];
      return rows.map((r) => r.title);
    },
    async removeSavedIdea(id, userId) {
      const rows = check(
        await db.from("saved_ideas").delete().eq("id", id).eq("user_id", userId).select("id"),
      ) as { id: string }[];
      return rows.length === 1;
    },

    /* teammates */
    async emailFor(userId) {
      const row = check(await db.from("profiles").select("email").eq("id", userId).maybeSingle()) as { email: string | null } | null;
      return row?.email ?? null;
    },
    async listMembers(exhbtId) {
      const rows = check(
        await db.from("exhbt_members").select(MEMBER_COLS).eq("exhbt_id", exhbtId).order("added_at", { ascending: true }),
      ) as MemberRow[];
      return rows.map(fromMemberRow);
    },
    async listMembershipsFor(userId) {
      const rows = check(
        await db.from("exhbt_members").select(MEMBER_COLS).eq("user_id", userId).order("added_at", { ascending: true }),
      ) as MemberRow[];
      return rows.map(fromMemberRow);
    },
    async addMember(m) {
      const rows = check(
        await db
          .from("exhbt_members")
          .upsert({ exhbt_id: m.exhbtId, user_id: m.userId, role: m.role.slice(0, 40) }, { onConflict: "exhbt_id,user_id", ignoreDuplicates: true })
          .select("exhbt_id"),
      ) as { exhbt_id: string }[];
      return rows.length === 1 ? "added" : "already";
    },
    async removeMember(exhbtId, userId) {
      const rows = check(
        await db.from("exhbt_members").delete().eq("exhbt_id", exhbtId).eq("user_id", userId).select("exhbt_id"),
      ) as { exhbt_id: string }[];
      if (!rows.length) return false;
      check(await db.from("exhbts").update({ team_of: null }).eq("team_of", exhbtId).eq("user_id", userId));
      return true;
    },
    async listTeamVersions(rootId) {
      const rows = check(
        await db.from("exhbts").select(EXHBT_COLS).eq("team_of", rootId).order("created_at", { ascending: true }),
      ) as ExhbtRow[];
      return rows.map(fromExhbtRow);
    },
    async createInvite(i) {
      check(
        await db.from("exhbt_invites").insert({
          id: i.id,
          exhbt_id: i.exhbtId,
          email: i.email.toLowerCase(),
          role: i.role.slice(0, 40),
          token_hash: i.tokenHash,
          expires_at: i.expiresAt,
        }),
      );
    },
    async getInvite(id) {
      const row = check(await db.from("exhbt_invites").select(INVITE_COLS).eq("id", id).maybeSingle()) as InviteRow | null;
      return row ? fromInviteRow(row) : null;
    },
    async listInvites(exhbtId) {
      const rows = check(
        await db
          .from("exhbt_invites")
          .select(INVITE_COLS)
          .eq("exhbt_id", exhbtId)
          .is("accepted_at", null)
          .is("cancelled_at", null)
          .order("created_at", { ascending: false }),
      ) as InviteRow[];
      return rows.map(fromInviteRow);
    },
    async renewInvite(id, exhbtId, tokenHash, expiresAt) {
      const rows = check(
        await db
          .from("exhbt_invites")
          .update({ token_hash: tokenHash, expires_at: expiresAt })
          .eq("id", id)
          .eq("exhbt_id", exhbtId)
          .is("accepted_at", null)
          .is("cancelled_at", null)
          .select("id"),
      ) as { id: string }[];
      return rows.length === 1;
    },
    async cancelInvite(id, exhbtId) {
      const rows = check(
        await db
          .from("exhbt_invites")
          .update({ cancelled_at: new Date().toISOString() })
          .eq("id", id)
          .eq("exhbt_id", exhbtId)
          .is("accepted_at", null)
          .is("cancelled_at", null)
          .select("id"),
      ) as { id: string }[];
      return rows.length === 1;
    },
    async markInviteAccepted(id) {
      const rows = check(
        await db
          .from("exhbt_invites")
          .update({ accepted_at: new Date().toISOString() })
          .eq("id", id)
          .is("accepted_at", null)
          .is("cancelled_at", null)
          .select("id"),
      ) as { id: string }[];
      return rows.length === 1;
    },

    /* private duplicate matching */
    async setFileHash(fileId, userId, sha256) {
      check(await db.from("exhbt_files").update({ sha256 }).eq("id", fileId).eq("user_id", userId));
    },
    async findFilesByHash(sha256, exceptUserId) {
      const rows = check(
        await db
          .from("exhbt_files")
          .select(`${FILE_COLS}, exhbt_id, created_at`)
          .eq("sha256", sha256)
          .neq("user_id", exceptUserId)
          .not("exhbt_id", "is", null)
          .order("created_at", { ascending: true })
          .limit(20),
      ) as (FileRow & { exhbt_id: string; created_at: string })[];
      return rows.map((r) => ({ file: fromFileRow(r), exhbtId: r.exhbt_id, createdAt: r.created_at }));
    },
    async createDuplicateMatch(m) {
      const row = check(
        await db
          .from("duplicate_matches")
          .insert({
            sha256: m.sha256,
            uploader_id: m.uploaderId,
            uploader_file_id: m.uploaderFileId,
            owner_id: m.ownerId,
            owner_file_id: m.ownerFileId,
            owner_exhbt_id: m.ownerExhbtId,
            outcome: m.outcome,
          })
          .select("id")
          .single(),
      ) as { id: string };
      return row.id;
    },
    async getDuplicateMatch(id) {
      const row = check(await db.from("duplicate_matches").select("*").eq("id", id).maybeSingle()) as MatchRow | null;
      return row ? fromMatchRow(row) : null;
    },
    async latestDuplicateMatch(uploaderId, ownerExhbtId) {
      const row = check(
        await db
          .from("duplicate_matches")
          .select("*")
          .eq("uploader_id", uploaderId)
          .eq("owner_exhbt_id", ownerExhbtId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ) as MatchRow | null;
      return row ? fromMatchRow(row) : null;
    },
    async updateDuplicateMatch(id, from, to, role) {
      const now = new Date().toISOString();
      const rows = check(
        await db
          .from("duplicate_matches")
          .update({
            outcome: to,
            ...(to === "asked" || to === "mine" ? { answered_at: now } : { decided_at: now }),
            ...(role !== undefined ? { role: role ? role.slice(0, 40) : null } : {}),
          })
          .eq("id", id)
          .eq("outcome", from)
          .select("id"),
      ) as { id: string }[];
      return rows.length === 1;
    },
    async listJoinRequests(ownerId, exhbtId) {
      let q = db.from("duplicate_matches").select("*").eq("owner_id", ownerId).eq("outcome", "asked");
      if (exhbtId) q = q.eq("owner_exhbt_id", exhbtId);
      return (check(await q.order("answered_at", { ascending: true })) as MatchRow[]).map(fromMatchRow);
    },

    /* referrals */
    async getReferralCode(userId) {
      const read = async () =>
        (check(await db.from("profiles").select("referral_code").eq("id", userId).maybeSingle()) as { referral_code: string | null } | null)
          ?.referral_code ?? null;
      const have = await read();
      if (have) return have;
      for (let i = 0; i < 5; i++) {
        // Only fills an empty code, so two first visits can't give different codes.
        const res = await db.from("profiles").update({ referral_code: newReferralCode() }).eq("id", userId).is("referral_code", null);
        if (res.error && res.error.code !== "23505") throw new Error(res.error.message);
        const now = await read();
        if (now) return now;
      }
      throw new Error("Could not make a referral code.");
    },
    async findUserByReferralCode(code) {
      const r = check(await db.from("profiles").select("id").eq("referral_code", code).maybeSingle()) as { id: string } | null;
      return r?.id ?? null;
    },
    async recordReferral(referrerId, referredId) {
      if (referrerId === referredId) return false;
      const res = await db.from("referrals").insert({ referrer_id: referrerId, referred_id: referredId });
      if (!res.error) return true;
      if (res.error.code === "23505") return false; // the referred account already has a referrer
      throw new Error(res.error.message);
    },
    async getReferralByReferred(referredId) {
      const r = check(await db.from("referrals").select(REFERRAL_COLS).eq("referred_id", referredId).maybeSingle()) as ReferralRow | null;
      return r ? fromReferralRow(r) : null;
    },
    async markReferralEarned(referredId) {
      // One conditional update: only a pending row moves, so two deliveries change it once.
      check(
        await db
          .from("referrals")
          .update({ status: "earned", earned_at: new Date().toISOString() })
          .eq("referred_id", referredId)
          .eq("status", "pending")
          .select("id"),
      );
      const r = check(await db.from("referrals").select(REFERRAL_COLS).eq("referred_id", referredId).maybeSingle()) as ReferralRow | null;
      return r && r.status === "earned" ? fromReferralRow(r) : null;
    },
    async listEarnedReferrals(referrerId) {
      const rows = check(
        await db.from("referrals").select(REFERRAL_COLS).eq("referrer_id", referrerId).eq("status", "earned").order("earned_at", { ascending: true }),
      ) as ReferralRow[];
      return rows.map(fromReferralRow);
    },
    async markReferralCredited(id, creditRef) {
      const rows = check(
        await db
          .from("referrals")
          .update({ status: "credited", credited_at: new Date().toISOString(), credit_ref: creditRef })
          .eq("id", id)
          .eq("status", "earned")
          .select("id"),
      ) as { id: string }[];
      return rows.length > 0;
    },
    async referralSummary(referrerId) {
      const rows = check(await db.from("referrals").select("status").eq("referrer_id", referrerId)) as { status: ReferralStatus }[];
      return { credited: rows.filter((r) => r.status === "credited").length, waiting: rows.filter((r) => r.status !== "credited").length };
    },

    /* admin */
    isAdmin: (userId) => sbIsAdmin(db, userId),
    async adminRows(actorId, table, since) {
      if (!(await sbIsAdmin(db, actorId))) throw new Error("forbidden");
      return sbAdminRows(db, table, since);
    },
    async adminAccounts(actorId, opts) {
      if (!(await sbIsAdmin(db, actorId))) throw new Error("forbidden");
      return sbAdminAccounts(db, opts, LIVE_SUBSCRIPTION_STATUSES);
    },
    async adminAccount(actorId, userId) {
      if (!(await sbIsAdmin(db, actorId))) throw new Error("forbidden");
      return sbAdminAccount(db, userId, LIVE_SUBSCRIPTION_STATUSES);
    },
  };
}

const REFERRAL_COLS = "id, referrer_id, referred_id, status, created_at, earned_at, credited_at, credit_ref";
type ReferralRow = {
  id: string;
  referrer_id: string;
  referred_id: string | null;
  status: ReferralStatus;
  created_at: string;
  earned_at: string | null;
  credited_at: string | null;
  credit_ref: string | null;
};
const fromReferralRow = (r: ReferralRow): ReferralRecord => ({
  id: r.id,
  referrerId: r.referrer_id,
  referredId: r.referred_id,
  status: r.status,
  createdAt: r.created_at,
  earnedAt: r.earned_at,
  creditedAt: r.credited_at,
  creditRef: r.credit_ref,
});

/** Eight characters, no look-alikes (no 0, o, 1, l, i). Short enough to read out. */
const CODE_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
function newReferralCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
}

const FILE_COLS = "id, user_id, bucket, path, mime, bytes, kind, sha256";
type FileRow = {
  id: string;
  user_id: string;
  bucket: StoredFile["bucket"];
  path: string;
  mime: string;
  bytes: number;
  kind: StoredFile["kind"];
  sha256: string | null;
};
const fromFileRow = (r: FileRow): StoredFile => ({
  id: r.id,
  userId: r.user_id,
  bucket: r.bucket,
  path: r.path,
  mime: r.mime,
  bytes: r.bytes,
  kind: r.kind,
  sha256: r.sha256 ?? null,
});

const MEMBER_COLS = "exhbt_id, user_id, role, added_at";
type MemberRow = { exhbt_id: string; user_id: string; role: string | null; added_at: string };
const fromMemberRow = (r: MemberRow): TeamMember => ({ exhbtId: r.exhbt_id, userId: r.user_id, role: r.role ?? "", addedAt: r.added_at });

const INVITE_COLS = "id, exhbt_id, email, role, token_hash, created_at, expires_at, accepted_at, cancelled_at";
/** What the account export shows of an invite: everything but the token's hash. */
const INVITE_EXPORT_COLS = "id, exhbt_id, email, role, created_at, expires_at, accepted_at, cancelled_at";
type InviteRow = {
  id: string;
  exhbt_id: string;
  email: string;
  role: string | null;
  token_hash: string;
  created_at: string;
  expires_at: string;
  accepted_at: string | null;
  cancelled_at: string | null;
};
const fromInviteRow = (r: InviteRow): TeamInvite => ({
  id: r.id,
  exhbtId: r.exhbt_id,
  email: r.email,
  role: r.role ?? "",
  tokenHash: r.token_hash,
  createdAt: r.created_at,
  expiresAt: r.expires_at,
  acceptedAt: r.accepted_at,
  cancelledAt: r.cancelled_at,
});

type MatchRow = {
  id: string;
  sha256: string;
  uploader_id: string;
  uploader_file_id: string | null;
  owner_id: string;
  owner_file_id: string | null;
  owner_exhbt_id: string | null;
  outcome: DuplicateOutcome;
  role: string | null;
  created_at: string;
  answered_at: string | null;
  decided_at: string | null;
};
const fromMatchRow = (r: MatchRow): DuplicateMatch => ({
  id: r.id,
  sha256: r.sha256,
  uploaderId: r.uploader_id,
  uploaderFileId: r.uploader_file_id,
  ownerId: r.owner_id,
  ownerFileId: r.owner_file_id,
  ownerExhbtId: r.owner_exhbt_id,
  outcome: r.outcome,
  role: r.role,
  createdAt: r.created_at,
  answeredAt: r.answered_at,
  decidedAt: r.decided_at,
});

type JobLinkRow = {
  id: string;
  user_id: string;
  company: string | null;
  role_title: string | null;
  collection_slug: string | null;
  slug_style: "clean" | "suffix";
  intro: string | null;
  exhbt_ids: string[] | null;
  ranking: JobLinkPick[] | null;
  job_listing_text: string | null;
  job_listing_url: string | null;
  status: "live" | "off";
  view_count: number | null;
  created_at: string;
};
const JOB_LINK_COLS =
  "id, user_id, company, role_title, collection_slug, slug_style, intro, exhbt_ids, ranking, job_listing_text, job_listing_url, status, view_count, created_at";

const fromJobLinkRow = (r: JobLinkRow): JobLink => {
  // `ranking` holds the picks with their reasons; exhbt_ids keeps the same order for the database's own check (at most 4).
  const reasons = new Map((r.ranking ?? []).map((p) => [p.exhbtId, p.reason]));
  return {
    id: r.id,
    userId: r.user_id,
    company: r.company ?? "",
    roleTitle: r.role_title ?? "",
    slug: r.collection_slug ?? r.id,
    slugStyle: r.slug_style === "clean" ? "clean" : "suffix",
    intro: r.intro ?? "",
    picks: (r.exhbt_ids ?? []).map((exhbtId) => ({ exhbtId, reason: reasons.get(exhbtId) ?? "" })),
    listingText: r.job_listing_text,
    listingUrl: r.job_listing_url,
    status: r.status === "off" ? "off" : "live",
    viewCount: r.view_count ?? 0,
    createdAt: r.created_at,
  };
};

/** A job link's fields as curated_links columns (everything but user_id). */
function jobLinkColumns(l: Omit<NewJobLink, "userId"> & { status?: JobLink["status"] }) {
  return {
    name: `${l.company} · ${l.roleTitle}`.slice(0, 250),
    company: l.company.slice(0, 120),
    role_title: l.roleTitle.slice(0, 120),
    collection_slug: l.slug,
    slug_style: l.slugStyle,
    intro: l.intro.slice(0, 400),
    exhbt_ids: l.picks.map((p) => p.exhbtId),
    ranking: l.picks,
    job_listing_text: l.listingText,
    job_listing_url: l.listingUrl,
    ...(l.status ? { status: l.status } : {}),
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
  portfolio_theme: string | null;
  featured_exhbt_id: string | null;
  portfolio_layout: unknown;
  location?: string | null;
  looking_for?: string | null;
  github_url?: string | null;
  website_url?: string | null;
  contact_email?: string | null;
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
  themeId: r.portfolio_theme,
  featuredExhbtId: r.featured_exhbt_id ?? null,
  layout: normaliseLayout(r.portfolio_layout),
  location: r.location ?? null,
  lookingFor: r.looking_for ?? null,
  github: r.github_url ?? null,
  website: r.website_url ?? null,
  contactEmail: r.contact_email ?? null,
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
  themeId: null,
  featuredExhbtId: null,
  layout: normaliseLayout(null),
  location: null,
  lookingFor: null,
  github: null,
  website: null,
  contactEmail: null,
});

/** Whether a stored doc may be copied to the live page: it passes validateForPublish and has no flagged numbers left. */
const publishable = (stored: ExhbtDoc): boolean => {
  const doc = normaliseDoc(stored);
  return validateForPublish(doc).length === 0 && ((doc as { unverified?: string[] }).unverified ?? []).length === 0;
};

const EXHBT_COLS = "id, user_id, blocks, published_blocks, status, public_slug, position, confirmed_at, published_at, updated_at, team_of, hidden_on_portfolio";
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
  team_of: string | null;
  hidden_on_portfolio: boolean | null;
};
/**
 * Both copies in the current shape: rows saved before sections (decision 0015) read as sections
 * here, so nothing after the store sees the old layout. The stored jsonb isn't changed.
 */
const fromExhbtRow = (r: ExhbtRow): ExhbtRecord => ({
  id: r.id,
  userId: r.user_id,
  doc: normaliseDoc(r.blocks),
  published: r.published_blocks ? normaliseDoc(r.published_blocks) : null,
  status: r.status === "published" ? "published" : "draft",
  slug: r.public_slug,
  position: r.position,
  confirmedAt: r.confirmed_at,
  publishedAt: r.published_at,
  updatedAt: r.updated_at,
  teamOf: r.team_of ?? null,
  hiddenOnPortfolio: Boolean(r.hidden_on_portfolio),
});

/* ---------------- In-memory (local development and tests only) ---------------- */

/** A copy of a stored exhbt with both copies in the current shape, as fromExhbtRow does for Supabase. */
const readCopies = (e: ExhbtRecord): ExhbtRecord => {
  const c = structuredClone(e);
  return { ...c, doc: normaliseDoc(c.doc), published: c.published ? normaliseDoc(c.published) : null };
};

type MemRoadmap = RoadmapRecord & { ipHash: string; marketingOptIn: boolean };
type Mem = {
  roadmaps: Map<string, MemRoadmap>;
  ideas: Map<string, ProjectIdea[]>;
  optIns: Map<string, boolean>;
  aiCalls: (AICall & { at?: string })[];
  events: { name: string; userId: string | null; props: Record<string, unknown>; at: string }[];
  leads: unknown[];
  waitlist: { email: string; interest: WaitlistInterest; source: string; at?: string }[];
  profiles: Map<string, PortfolioProfile>;
  usernameRedirects: Map<string, { userId: string; expiresAt: number }>;
  exhbts: Map<string, ExhbtRecord>;
  files: Map<string, StoredFile>;
  /** Development and tests only: a plan per user, set from /dev/plan. */
  plans: Map<string, Plan>;
  /** Stripe subscriptions by subscription id (billing). */
  subscriptions: Map<string, SubscriptionRecord>;
  jobLinks: Map<string, JobLink>;
  savedIdeas: Map<string, SavedIdea>;
  /** Teammates, keyed `${exhbtId}:${userId}` (decision 0013). */
  members: Map<string, TeamMember>;
  invites: Map<string, TeamInvite>;
  matches: Map<string, DuplicateMatch>;
  /** Referral codes by user id, and referrals by id (decision 0020). */
  referralCodes: Map<string, string>;
  referrals: Map<string, ReferralRecord>;
  /** Development and tests only: accounts whose role is exhbt_admin (the Supabase profiles.role). Set from /dev/admin. */
  admins?: Set<string>;
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
  savedIdeas: new Map(),
  members: new Map(),
  invites: new Map(),
  matches: new Map(),
  referralCodes: new Map(),
  referrals: new Map(),
});
/** A file as the in-memory store keeps it: the record, the exhbt it's attached to, and when it was made. */
type MemFile = StoredFile & { exhbtId?: string | null; createdAt?: string };
const g = globalThis as unknown as { __exhbtMem?: Mem };

function emailFromDevUser(userId: string): string | null {
  if (!userId.startsWith("dev-") || !userId.includes("@")) return null;
  return userId.slice(4);
}

function memoryStore(): Store {
  if (process.env.NODE_ENV === "production" && !process.env.EXHBT_ALLOW_MEMORY_STORE) {
    throw new Error("Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  }
  const m = (g.__exhbtMem ??= newMem());
  const ownedIds = async (userId: string, ids: string[]) => new Set(ids.filter((id) => m.files.get(id)?.userId === userId));
  const ownDocOnly = async (doc: ExhbtDoc, userId: string): Promise<ExhbtDoc> => {
    const ids = fileIdsIn(doc);
    return ids.length ? withoutFiles(doc, await ownedIds(userId, ids)) : doc;
  };
  m.ideas ??= new Map(); // a store created before ideas existed (hot reload in development)
  m.profiles ??= new Map();
  m.usernameRedirects ??= new Map();
  m.exhbts ??= new Map();
  m.files ??= new Map();
  m.plans ??= new Map();
  m.subscriptions ??= new Map();
  m.jobLinks ??= new Map();
  m.savedIdeas ??= new Map();
  m.members ??= new Map();
  m.invites ??= new Map();
  m.matches ??= new Map();
  m.referralCodes ??= new Map();
  m.referrals ??= new Map();
  const files = () => m.files as Map<string, MemFile>;
  const isOpen = (i: TeamInvite) => !i.acceptedAt && !i.cancelledAt;
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
        ideasStartedAt: null,
        ideasFailedAt: null,
        ideasAttempts: 0,
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
      const claimed = [...m.roadmaps.values()].filter((r) => r.pendingEmail === email && !r.userId);
      for (const r of claimed) r.userId = userId;
      // As the Supabase store does: the newest name and LinkedIn from the gate fill the profile, without overwriting what's there.
      const newestFirst = [...claimed].sort((x, y) => y.createdAt.localeCompare(x.createdAt));
      const name = newestFirst.find((r) => r.pendingName)?.pendingName;
      const linkedin = newestFirst.find((r) => r.pendingLinkedin)?.pendingLinkedin;
      const mine = profile(userId);
      const fill = { ...(name && mine.name === null ? { name } : {}), ...(linkedin && mine.linkedin === null ? { linkedin } : {}) };
      if (Object.keys(fill).length) m.profiles.set(userId, { ...mine, ...fill });
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
      if (!r || r.output) return false;
      r.output = output;
      return true;
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
    async claimIdeasRun(roadmapId, opts) {
      const r = m.roadmaps.get(roadmapId);
      if (!r) return "limit";
      const blocked = ideasClaimBlock(r, opts);
      if (blocked) return blocked;
      r.ideasStartedAt = new Date().toISOString();
      r.ideasFailedAt = null;
      r.ideasAttempts += 1;
      return "claimed";
    },
    async failIdeasRun(roadmapId) {
      const r = m.roadmaps.get(roadmapId);
      if (r) r.ideasFailedAt = new Date().toISOString();
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
      m.aiCalls.push({ ...c, at: new Date().toISOString() });
    },
    async logEvent(name, userId, props = {}) {
      m.events.push({ name, userId, props, at: new Date().toISOString() });
    },
    async countRecentEvents(name, ipHash, hours) {
      const after = Date.now() - hours * 3_600_000;
      return m.events.filter((e) => e.name === name && e.props.ipHash === ipHash && Date.parse(e.at) >= after).length;
    },
    async createLead(lead) {
      m.leads.push({ ...lead, at: new Date().toISOString() });
    },
    async joinWaitlist(entry) {
      m.waitlist ??= [];
      if (!m.waitlist.some((w) => w.email === entry.email && w.interest === entry.interest)) m.waitlist.push({ ...entry, at: new Date().toISOString() });
    },
    async exportUserData(userId, email) {
      // The same parts as the Supabase export: profile (portfolio fields), exhbts with both copies,
      // file metadata (no bytes), subscriptions (no card data; we never hold any), and team data.
      const roadmaps = [...m.roadmaps.values()].filter((r) => r.userId === userId);
      const p = m.profiles.get(userId);
      const mine = new Set([...m.exhbts.values()].filter((e) => e.userId === userId).map((e) => e.id));
      const address = (email ?? (userId.startsWith("dev-") ? userId.slice(4) : "")).toLowerCase();
      // Everything but the token's hash, as the Supabase export.
      const inviteOut = (i: TeamInvite) => ({
        id: i.id,
        exhbtId: i.exhbtId,
        email: i.email,
        role: i.role,
        createdAt: i.createdAt,
        expiresAt: i.expiresAt,
        acceptedAt: i.acceptedAt,
        cancelledAt: i.cancelledAt,
      });
      const matches = [...m.matches.values()];
      const refs = [...m.referrals.values()];
      return {
        exportedAt: new Date().toISOString(),
        profile: p ? { ...p } : null,
        referralsYouMade: refs
          .filter((x) => x.referrerId === userId)
          .map((x) => ({ status: x.status, created_at: x.createdAt, earned_at: x.earnedAt, credited_at: x.creditedAt })),
        referralOnYourAccount: refs.filter((x) => x.referredId === userId).map((x) => ({ status: x.status, created_at: x.createdAt }))[0] ?? null,
        roadmaps,
        projectIdeas: roadmaps.flatMap((r) => m.ideas.get(r.id) ?? []),
        exhbts: [...m.exhbts.values()]
          .filter((e) => e.userId === userId)
          .sort((a, b) => a.position - b.position)
          .map((e) => structuredClone(e)),
        files: [...m.files.values()].filter((f) => f.userId === userId).map((f) => ({ ...f })),
        subscriptions: [...m.subscriptions.values()].filter((x) => x.userId === userId).map((x) => ({ ...x })),
        savedIdeas: [...m.savedIdeas.values()].filter((x) => x.userId === userId).map((x) => ({ ...x })),
        teamMemberships: [...m.members.values()].filter((x) => x.userId === userId).map((x) => ({ exhbtId: x.exhbtId, role: x.role, addedAt: x.addedAt })),
        teammatesOnYourExhbts: [...m.members.values()].filter((x) => mine.has(x.exhbtId)).map((x) => ({ ...x })),
        invitesYouSent: [...m.invites.values()].filter((i) => mine.has(i.exhbtId)).map(inviteOut),
        invitesToYou: address ? [...m.invites.values()].filter((i) => i.email.toLowerCase() === address).map(inviteOut) : [],
        // File matches: only this person's side of each one, never who the other account is.
        fileMatchesOnYourUploads: matches
          .filter((x) => x.uploaderId === userId)
          .map((x) => ({ sha256: x.sha256, uploaderFileId: x.uploaderFileId, outcome: x.outcome, role: x.role, createdAt: x.createdAt, answeredAt: x.answeredAt, decidedAt: x.decidedAt })),
        joinRequestsOnYourExhbts: matches
          .filter((x) => x.ownerId === userId && ["asked", "approved", "declined"].includes(x.outcome))
          .map((x) => ({ sha256: x.sha256, ownerFileId: x.ownerFileId, ownerExhbtId: x.ownerExhbtId, outcome: x.outcome, createdAt: x.createdAt, decidedAt: x.decidedAt })),
      };
    },
    async deleteUserData(userId, email) {
      for (const [id, r] of m.roadmaps) {
        if (r.userId === userId) {
          m.roadmaps.delete(id);
          m.ideas.delete(id);
        }
      }
      const gone = new Set<string>();
      for (const [id, e] of m.exhbts) {
        if (e.userId === userId) {
          m.exhbts.delete(id);
          gone.add(id);
        }
      }
      for (const [id, l] of m.jobLinks) if (l.userId === userId) m.jobLinks.delete(id);
      // As the database cascade does: subscriptions and file records go with the account.
      for (const [id, s] of m.subscriptions) if (s.userId === userId) m.subscriptions.delete(id);
      for (const [id, f] of m.files) if (f.userId === userId) m.files.delete(id);
      for (const [id, x] of m.savedIdeas) if (x.userId === userId) m.savedIdeas.delete(id);
      // Teams: their memberships, the teammates and invites on their exhbts, invites sent to their
      // address, and matches on either side. Others' exhbts made from theirs lose the link only.
      const address = (email ?? (userId.startsWith("dev-") ? userId.slice(4) : "")).toLowerCase();
      for (const [k, x] of m.members) if (x.userId === userId || gone.has(x.exhbtId)) m.members.delete(k);
      for (const [k, i] of m.invites) if (gone.has(i.exhbtId) || (address && i.email.toLowerCase() === address)) m.invites.delete(k);
      for (const [k, x] of m.matches) if (x.uploaderId === userId || x.ownerId === userId) m.matches.delete(k);
      for (const e of m.exhbts.values()) if (e.teamOf && gone.has(e.teamOf)) e.teamOf = null;
      // Referrals: as the database does. Pending ones on this person go; earned or credited ones keep
      // the referrer's record with the link to this person cleared; their own code and referrals go.
      for (const [k, x] of m.referrals) {
        if (x.referrerId === userId) m.referrals.delete(k);
        else if (x.referredId === userId) {
          if (x.status === "pending") m.referrals.delete(k);
          else x.referredId = null;
        }
      }
      m.referralCodes.delete(userId);
      m.profiles.delete(userId);
      m.plans.delete(userId);
      if (userId.startsWith("dev-") && userId.includes("@")) forgetDevPassword(userId.slice(4));
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
    async loginEmailForUsername(username) {
      for (const p of m.profiles.values()) if (p.username === username) return emailFromDevUser(p.userId);
      const red = m.usernameRedirects.get(username);
      if (red && red.expiresAt > Date.now()) return emailFromDevUser(red.userId);
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
    async createExhbt(userId, doc, opts) {
      doc = await ownDocOnly(doc, userId);
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
        teamOf: opts?.teamOf ?? null,
        hiddenOnPortfolio: false,
      });
      return id;
    },
    async getExhbt(id) {
      const e = m.exhbts.get(id);
      return e ? readCopies(e) : null;
    },
    async listExhbts(userId) {
      return [...m.exhbts.values()].filter((e) => e.userId === userId).sort((a, b) => a.position - b.position).map(readCopies);
    },
    async saveExhbtDraft(id, userId, doc) {
      const e = own(id, userId);
      if (!e) return false;
      doc = await ownDocOnly(doc, userId);
      e.doc = structuredClone(doc);
      e.updatedAt = new Date().toISOString();
      return true;
    },
    async publishExhbt(id, userId, slug, opts) {
      const e = own(id, userId);
      if (!e) return false;
      if (!opts?.unchecked && !publishable(e.doc)) return false;
      const now = new Date().toISOString();
      Object.assign(e, { published: publicDoc(structuredClone(e.doc)), status: "published", slug, confirmedAt: now, publishedAt: now });
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
    async savePortfolioLayout(userId, c) {
      m.profiles.set(userId, { ...profile(userId), layout: structuredClone(c.layout), featuredExhbtId: c.featuredExhbtId });
      const hidden = new Set(c.hiddenIds);
      for (const e of m.exhbts.values()) if (e.userId === userId) e.hiddenOnPortfolio = hidden.has(e.id);
      c.order.forEach((id, position) => {
        const e = own(id, userId);
        if (e) e.position = position;
      });
    },
    async deleteExhbt(id, userId) {
      if (!own(id, userId)) return false;
      m.exhbts.delete(id);
      // As the database does (on delete set null): the profile's featured exhbt clears.
      for (const p of m.profiles.values()) if (p.featuredExhbtId === id) p.featuredExhbtId = null;
      // As the database does: its teammates and invites go, teammates' own exhbts made from it
      // keep standing without the link, and file matches forget which exhbt it was.
      for (const [k, x] of m.members) if (x.exhbtId === id) m.members.delete(k);
      for (const [k, i] of m.invites) if (i.exhbtId === id) m.invites.delete(k);
      for (const e of m.exhbts.values()) if (e.teamOf === id) e.teamOf = null;
      for (const x of m.matches.values()) if (x.ownerExhbtId === id) x.ownerExhbtId = null;
      return true;
    },
    async ownedFileIds(userId, ids) {
      return ownedIds(userId, ids);
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
    async returnEvent(name, userId, claim) {
      const at = m.events.findIndex((e) => e.name === name && e.userId === userId && e.props.claim === claim);
      if (at >= 0) m.events.splice(at, 1);
    },
    async createFile(f) {
      files().set(f.id, { ...f, exhbtId: f.exhbtId ?? null, sha256: f.sha256 ?? null, createdAt: new Date().toISOString() });
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
      // As the database does (on delete set null): a match keeps its row and loses the file.
      for (const x of m.matches.values()) {
        if (x.uploaderFileId === id) x.uploaderFileId = null;
        if (x.ownerFileId === id) x.ownerFileId = null;
      }
      return f;
    },

    /* billing polish */
    async listFiles(userId, exhbtId) {
      return [...m.files.values()]
        .filter((f) => f.userId === userId && (!exhbtId || (f as StoredFile & { exhbtId?: string | null }).exhbtId === exhbtId))
        .map((f) => ({ ...f }));
    },

    /* draft tools */
    async countEventsForExhbt(name, userId, exhbtId) {
      return m.events.filter((e) => e.name === name && e.userId === userId && e.props.exhbtId === exhbtId).length;
    },

    /* job links */
    async createJobLink(l) {
      const id = crypto.randomUUID();
      m.jobLinks.set(id, { ...structuredClone(l), id, status: "live", viewCount: 0, createdAt: new Date().toISOString() });
      return id;
    },
    async listJobLinks(userId) {
      return [...m.jobLinks.values()]
        .filter((l) => l.userId === userId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((l) => structuredClone(l));
    },
    async getJobLink(id) {
      const l = m.jobLinks.get(id);
      return l ? structuredClone(l) : null;
    },
    async getJobLinkBySlug(userId, slug) {
      const l = [...m.jobLinks.values()].find((x) => x.userId === userId && x.slug === slug);
      return l ? structuredClone(l) : null;
    },
    async updateJobLink(id, userId, changes) {
      const l = m.jobLinks.get(id);
      if (!l || l.userId !== userId) return false;
      for (const [k, v] of Object.entries(changes)) if (v !== undefined) (l as Record<string, unknown>)[k] = structuredClone(v);
      return true;
    },
    async deleteJobLink(id, userId) {
      const l = m.jobLinks.get(id);
      return l && l.userId === userId ? m.jobLinks.delete(id) : false;
    },
    async countActiveJobLinks(userId) {
      return [...m.jobLinks.values()].filter((l) => l.userId === userId && l.status === "live").length;
    },
    async incrementJobLinkViews(id) {
      const l = m.jobLinks.get(id);
      if (l && l.status === "live") l.viewCount += 1;
    },

    /* saved ideas */
    async listRoadmapsFor(userId) {
      return [...m.roadmaps.values()]
        .filter((r) => r.userId === userId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((r) => ({ ...r }));
    },
    async saveIdea(userId, { roadmapId, targetRole, idea }) {
      const mine = [...m.savedIdeas.values()].filter((x) => x.userId === userId);
      if (mine.some((x) => x.roadmapId === roadmapId && x.title === idea.title)) return "already";
      if (mine.length >= SAVED_IDEAS_CAP) return "full";
      const id = crypto.randomUUID();
      m.savedIdeas.set(id, {
        id,
        userId,
        roadmapId,
        targetRole: targetRole.slice(0, 300),
        title: idea.title,
        brief: idea.brief,
        closesGaps: [...idea.closesGaps],
        deliverable: idea.deliverable,
        weeks: idea.weeks,
        createdAt: new Date().toISOString(),
      });
      return "saved";
    },
    async listSavedIdeas(userId) {
      // Map keeps insertion order; newest first is that, reversed.
      return [...m.savedIdeas.values()]
        .filter((x) => x.userId === userId)
        .reverse()
        .map((x) => ({ ...x, closesGaps: [...x.closesGaps] }));
    },
    async getSavedIdea(id, userId) {
      const x = m.savedIdeas.get(id);
      return x && x.userId === userId ? { ...x, closesGaps: [...x.closesGaps] } : null;
    },
    async savedTitlesForRoadmap(userId, roadmapId) {
      return [...m.savedIdeas.values()].filter((x) => x.userId === userId && x.roadmapId === roadmapId).map((x) => x.title);
    },
    async removeSavedIdea(id, userId) {
      const x = m.savedIdeas.get(id);
      return x && x.userId === userId ? m.savedIdeas.delete(id) : false;
    },

    /* teammates */
    async emailFor(userId) {
      // Development sign-in ids are `dev-<email>` (app/auth/dev).
      return userId.startsWith("dev-") ? userId.slice(4) : null;
    },
    async listMembers(exhbtId) {
      return [...m.members.values()].filter((x) => x.exhbtId === exhbtId).map((x) => ({ ...x }));
    },
    async listMembershipsFor(userId) {
      return [...m.members.values()].filter((x) => x.userId === userId).map((x) => ({ ...x }));
    },
    async addMember(x) {
      const key = `${x.exhbtId}:${x.userId}`;
      if (m.members.has(key)) return "already";
      m.members.set(key, { exhbtId: x.exhbtId, userId: x.userId, role: x.role.slice(0, 40), addedAt: new Date().toISOString() });
      return "added";
    },
    async removeMember(exhbtId, userId) {
      if (!m.members.delete(`${exhbtId}:${userId}`)) return false;
      for (const e of m.exhbts.values()) if (e.teamOf === exhbtId && e.userId === userId) e.teamOf = null;
      return true;
    },
    async listTeamVersions(rootId) {
      return [...m.exhbts.values()].filter((e) => e.teamOf === rootId).map(readCopies);
    },
    async createInvite(i) {
      m.invites.set(i.id, { ...i, email: i.email.toLowerCase(), role: i.role.slice(0, 40), createdAt: new Date().toISOString(), acceptedAt: null, cancelledAt: null });
    },
    async getInvite(id) {
      const i = m.invites.get(id);
      return i ? { ...i } : null;
    },
    async listInvites(exhbtId) {
      return [...m.invites.values()]
        .filter((i) => i.exhbtId === exhbtId && isOpen(i))
        .reverse()
        .map((i) => ({ ...i }));
    },
    async renewInvite(id, exhbtId, tokenHash, expiresAt) {
      const i = m.invites.get(id);
      if (!i || i.exhbtId !== exhbtId || !isOpen(i)) return false;
      Object.assign(i, { tokenHash, expiresAt });
      return true;
    },
    async cancelInvite(id, exhbtId) {
      const i = m.invites.get(id);
      if (!i || i.exhbtId !== exhbtId || !isOpen(i)) return false;
      i.cancelledAt = new Date().toISOString();
      return true;
    },
    async markInviteAccepted(id) {
      const i = m.invites.get(id);
      if (!i || !isOpen(i)) return false;
      i.acceptedAt = new Date().toISOString();
      return true;
    },

    /* private duplicate matching */
    async setFileHash(fileId, userId, sha256) {
      const f = m.files.get(fileId);
      if (f && f.userId === userId) f.sha256 = sha256;
    },
    async findFilesByHash(sha256, exceptUserId) {
      // Map order is insertion order, so oldest first.
      return [...files().values()]
        .filter((f) => f.sha256 === sha256 && f.userId !== exceptUserId && f.exhbtId)
        .slice(0, 20)
        .map(({ exhbtId, createdAt, ...file }) => ({ file: { ...file }, exhbtId: exhbtId!, createdAt: createdAt ?? "" }));
    },
    async createDuplicateMatch(x) {
      const id = crypto.randomUUID();
      m.matches.set(id, { ...x, id, role: null, createdAt: new Date().toISOString(), answeredAt: null, decidedAt: null });
      return id;
    },
    async getDuplicateMatch(id) {
      const x = m.matches.get(id);
      return x ? { ...x } : null;
    },
    async latestDuplicateMatch(uploaderId, ownerExhbtId) {
      const all = [...m.matches.values()].filter((x) => x.uploaderId === uploaderId && x.ownerExhbtId === ownerExhbtId);
      const last = all[all.length - 1];
      return last ? { ...last } : null;
    },
    async updateDuplicateMatch(id, from, to, role) {
      const x = m.matches.get(id);
      if (!x || x.outcome !== from) return false;
      const now = new Date().toISOString();
      x.outcome = to;
      if (to === "asked" || to === "mine") x.answeredAt = now;
      else x.decidedAt = now;
      if (role !== undefined) x.role = role ? role.slice(0, 40) : null;
      return true;
    },
    async listJoinRequests(ownerId, exhbtId) {
      return [...m.matches.values()]
        .filter((x) => x.ownerId === ownerId && x.outcome === "asked" && (!exhbtId || x.ownerExhbtId === exhbtId))
        .map((x) => ({ ...x }));
    },

    /* referrals */
    async getReferralCode(userId) {
      let code = m.referralCodes.get(userId);
      if (!code) {
        const taken = new Set(m.referralCodes.values());
        do code = newReferralCode();
        while (taken.has(code));
        m.referralCodes.set(userId, code);
      }
      return code;
    },
    async findUserByReferralCode(code) {
      for (const [userId, c] of m.referralCodes) if (c === code) return userId;
      return null;
    },
    async recordReferral(referrerId, referredId) {
      if (referrerId === referredId) return false;
      if ([...m.referrals.values()].some((x) => x.referredId === referredId)) return false;
      const id = crypto.randomUUID();
      m.referrals.set(id, { id, referrerId, referredId, status: "pending", createdAt: new Date().toISOString(), earnedAt: null, creditedAt: null, creditRef: null });
      return true;
    },
    async getReferralByReferred(referredId) {
      const r = [...m.referrals.values()].find((x) => x.referredId === referredId);
      return r ? { ...r } : null;
    },
    async markReferralEarned(referredId) {
      const r = [...m.referrals.values()].find((x) => x.referredId === referredId);
      if (!r) return null;
      if (r.status === "pending") {
        r.status = "earned";
        r.earnedAt = new Date().toISOString();
      }
      return r.status === "earned" ? { ...r } : null;
    },
    async listEarnedReferrals(referrerId) {
      return [...m.referrals.values()].filter((x) => x.referrerId === referrerId && x.status === "earned").map((x) => ({ ...x }));
    },
    async markReferralCredited(id, creditRef) {
      const r = m.referrals.get(id);
      if (!r || r.status !== "earned") return false;
      r.status = "credited";
      r.creditedAt = new Date().toISOString();
      r.creditRef = creditRef;
      return true;
    },
    async referralSummary(referrerId) {
      const mine = [...m.referrals.values()].filter((x) => x.referrerId === referrerId);
      return { credited: mine.filter((x) => x.status === "credited").length, waiting: mine.filter((x) => x.status !== "credited").length };
    },

    /* admin */
    async isAdmin(userId) {
      return (m.admins ??= new Set()).has(userId);
    },
    async adminRows(actorId, table, since) {
      if (!(m.admins ??= new Set()).has(actorId)) throw new Error("forbidden");
      return memAdminRows(m, table, since) as AdminRows<typeof table>;
    },
    async adminAccounts(actorId, opts) {
      if (!(m.admins ??= new Set()).has(actorId)) throw new Error("forbidden");
      return memAdminAccounts(m, opts);
    },
    async adminAccount(actorId, userId) {
      if (!(m.admins ??= new Set()).has(actorId)) throw new Error("forbidden");
      return memAdminAccount(m, userId);
    },
  };
}

/** Development and tests only: give a user a plan without Stripe (app/dev/plan). */
export function setPlanForDevelopment(userId: string, plan: Plan) {
  if (process.env.NODE_ENV === "production") throw new Error("Development only.");
  (g.__exhbtMem ??= newMem()).plans ??= new Map();
  g.__exhbtMem!.plans.set(userId, plan);
}

/**
 * Development only: sets an exhbt's two stored copies exactly as given, without reading them into
 * the current shape. app/dev/portfolio uses it to store an exhbt the way rows saved before
 * sections (decision 0015) sit in the database, so the path old exhbts take is seen and tested.
 */
export function setStoredCopiesForDevelopment(id: string, copies: { doc: unknown; published: unknown }) {
  if (process.env.NODE_ENV === "production") throw new Error("Development only.");
  const e = g.__exhbtMem?.exhbts.get(id);
  if (!e) throw new Error("No such exhbt.");
  Object.assign(e, { doc: structuredClone(copies.doc), published: structuredClone(copies.published) });
}

/** Read-only view of the in-memory store, for the dev pages and tests. */
export function memorySnapshot() {
  return g.__exhbtMem;
}

/* admin: the in-memory reads (development and tests). The Supabase ones are lib/admin-supabase.ts. */

type MemAccount = { id: string; email: string; createdAt: string };

/** Every account the in-memory store has seen a trace of, with the earliest time it appears. */
function memAccounts(m: Mem): MemAccount[] {
  const first = new Map<string, string>();
  const see = (id: string | null | undefined, at: string | undefined) => {
    if (!id) return;
    const t = at ?? new Date().toISOString();
    const old = first.get(id);
    if (!old || t < old) first.set(id, t);
  };
  for (const id of m.profiles.keys()) see(id, undefined);
  for (const id of m.plans.keys()) see(id, undefined);
  for (const id of m.admins ?? []) see(id, undefined);
  for (const r of m.roadmaps.values()) see(r.userId, r.createdAt);
  for (const e of m.exhbts.values()) see(e.userId, e.updatedAt);
  for (const s of m.subscriptions.values()) see(s.userId, s.lastEventAt ?? undefined);
  for (const e of m.events) if (e.userId && e.name !== "page_view") see(e.userId, e.at);
  return [...first.entries()].map(([id, createdAt]) => ({ id, email: emailFromDevUser(id) ?? id, createdAt }));
}

/** Subscriptions as admin sees them: the real ones, plus one per development plan override. */
function memSubs(m: Mem) {
  const subs = [...m.subscriptions.values()].map((s) => ({
    userId: s.userId,
    plan: s.plan,
    status: s.status,
    subscriptionId: s.subscriptionId as string | null,
    createdAt: s.lastEventAt ?? "1970-01-01T00:00:00.000Z",
  }));
  for (const [userId, plan] of m.plans) {
    if (plan !== "free") subs.push({ userId, plan, status: "active", subscriptionId: "dev-override", createdAt: new Date().toISOString() });
  }
  return subs;
}

function memAdminRows(m: Mem, table: AdminTable, since: string | null): AdminRows<AdminTable> {
  const after = (at: string | null | undefined) => !since || (at ?? "") >= since;
  const now = new Date().toISOString();
  const rows = ((): unknown[] => {
    switch (table) {
      case "profiles":
        return memAccounts(m).map((a) => ({ ...a, username: m.profiles.get(a.id)?.username ?? null, role: m.admins?.has(a.id) ? "exhbt_admin" : "user", institutionActive: false }));
      case "subscriptions":
        return memSubs(m);
      case "roadmaps":
        return [...m.roadmaps.values()]
          .filter((r) => after(r.createdAt))
          .map((r) => ({ id: r.id, userId: r.userId, createdAt: r.createdAt, ideasFailedAt: r.ideasFailedAt, swaps: r.projectSwapsUsed }));
      case "exhbts":
        // The in-memory exhbt keeps no created time, so its last save stands in for it.
        return [...m.exhbts.values()]
          .filter((e) => after(e.updatedAt) || after(e.publishedAt))
          .map((e) => ({ id: e.id, userId: e.userId, status: e.status, createdAt: e.updatedAt, publishedAt: e.publishedAt }));
      case "events":
        return m.events
          .filter((e) => e.name !== "page_view" && after(e.at))
          .map((e) => ({
            name: e.name,
            userId: e.userId,
            at: e.at,
            cached: typeof e.props.cached === "boolean" ? e.props.cached : null,
            reason: typeof e.props.reason === "string" ? e.props.reason : null,
            inputTokens: typeof e.props.inputTokens === "number" ? e.props.inputTokens : null,
            outputTokens: typeof e.props.outputTokens === "number" ? e.props.outputTokens : null,
          }));
      case "pageViews":
        return m.events
          .filter((e) => e.name === "page_view" && after(e.at))
          .map((e) => ({ at: e.at, path: String(e.props.path ?? "/"), referrer: String(e.props.referrer ?? ""), isPortfolio: e.props.is_portfolio === true }));
      case "aiCalls":
        return m.aiCalls
          .filter((c) => after(c.at ?? now))
          .map((c) => ({ userId: c.userId, step: c.step, model: c.model, inputTokens: c.inputTokens, outputTokens: c.outputTokens, costUsd: c.costUsd, at: c.at ?? now }));
      case "ideas":
        return [...m.ideas.entries()]
          .flatMap(([roadmapId, list]) => list.map((i) => ({ at: m.roadmaps.get(roadmapId)?.createdAt ?? now, source: i.source })))
          .filter((i) => after(i.at));
      case "savedIdeas":
        return [...m.savedIdeas.values()].filter((i) => after(i.createdAt)).map((i) => ({ at: i.createdAt }));
      case "referrals":
        return [...m.referrals.values()]
          .filter((r) => after(r.createdAt))
          .map((r) => ({ id: r.id, referrerId: r.referrerId, referredId: r.referredId, status: r.status, createdAt: r.createdAt }));
      case "waitlist":
        return m.waitlist.filter((w) => after(w.at ?? now)).map((w) => ({ email: w.email, interest: w.interest, source: w.source, at: w.at ?? null }));
      case "leads":
        return (m.leads as { name: string; email: string; institution: string; at?: string }[])
          .filter((l) => after(l.at ?? now))
          .map((l) => ({ name: l.name, email: l.email, institution: l.institution, at: l.at ?? null }));
      case "jobLinks":
        return [...m.jobLinks.values()].map((l) => ({ userId: l.userId, status: l.status, views: l.viewCount, createdAt: l.createdAt }));
      case "members":
        return [...m.members.values()].map((x) => ({ exhbtId: x.exhbtId, userId: x.userId, addedAt: x.addedAt }));
      case "invites":
        return [...m.invites.values()].map((i) => ({ accepted: Boolean(i.acceptedAt), cancelled: Boolean(i.cancelledAt), createdAt: i.createdAt }));
      case "files":
        return [...m.files.values()].map((f) => ({ bucket: f.bucket, bytes: f.bytes }));
      case "matches":
        return [...m.matches.values()].filter((x) => after(x.createdAt)).map((x) => ({ id: x.id, outcome: x.outcome, createdAt: x.createdAt }));
    }
  })();
  return { rows: rows as never, truncated: false };
}

function memAccountRow(m: Mem, a: MemAccount): AdminAccountRow {
  const mine = memSubs(m).filter((s) => s.userId === a.id).reverse();
  const { plan, comp } = accountPlan(mine, false, LIVE_SUBSCRIPTION_STATUSES);
  const roadmaps = [...m.roadmaps.values()].filter((r) => r.userId === a.id);
  const exhbts = [...m.exhbts.values()].filter((e) => e.userId === a.id);
  const times = [...roadmaps.map((r) => r.createdAt), ...exhbts.map((e) => e.updatedAt), ...m.events.filter((e) => e.userId === a.id).map((e) => e.at)];
  return {
    id: a.id,
    email: a.email,
    createdAt: a.createdAt,
    plan,
    comp,
    username: m.profiles.get(a.id)?.username ?? null,
    roadmaps: roadmaps.length,
    exhbts: exhbts.length,
    lastActive: times.sort().at(-1) ?? null,
  };
}

function memAdminAccounts(m: Mem, opts: { q: string; page: number; pageSize: number }): AdminAccountsPage {
  const q = cleanQuery(opts.q);
  const all = memAccounts(m)
    .filter((a) => !q || a.email.toLowerCase().includes(q) || (m.profiles.get(a.id)?.username ?? "").includes(q))
    .sort((x, y) => y.createdAt.localeCompare(x.createdAt) || x.id.localeCompare(y.id));
  const page = Math.max(1, opts.page);
  const slice = all.slice((page - 1) * opts.pageSize, page * opts.pageSize);
  return { rows: slice.map((a) => memAccountRow(m, a)), total: all.length, page, pageSize: opts.pageSize };
}

function memAdminAccount(m: Mem, userId: string): AdminAccountDetail | null {
  const a = memAccounts(m).find((x) => x.id === userId);
  if (!a) return null;
  const files = [...m.files.values()].filter((f) => f.userId === userId);
  const calls = m.aiCalls.filter((c) => c.userId === userId);
  return {
    ...memAccountRow(m, a),
    role: m.admins?.has(userId) ? "exhbt_admin" : "user",
    roadmapList: [...m.roadmaps.values()]
      .filter((r) => r.userId === userId)
      .map((r) => ({ id: r.id, createdAt: r.createdAt, ideasFailed: Boolean(r.ideasFailedAt) }))
      .sort((x, y) => y.createdAt.localeCompare(x.createdAt)),
    exhbtList: [...m.exhbts.values()].filter((e) => e.userId === userId).map((e) => ({ id: e.id, status: e.status, createdAt: e.updatedAt })),
    events: m.events
      .filter((e) => e.userId === userId && e.name !== "page_view")
      .map((e) => ({ name: e.name, at: e.at }))
      .sort((x, y) => y.at.localeCompare(x.at))
      .slice(0, 100),
    aiCalls: calls.length,
    aiCostUsd: calls.reduce((n, c) => n + c.costUsd, 0),
    files: files.length,
    fileBytes: files.reduce((n, f) => n + f.bytes, 0),
  };
}

/** Development and tests only: makes an account an exhbt_admin without touching the database (app/dev/admin). */
export function setAdminForDevelopment(userId: string, admin = true) {
  if (process.env.NODE_ENV === "production") throw new Error("Development only.");
  const mem = (g.__exhbtMem ??= newMem());
  mem.admins ??= new Set();
  if (admin) mem.admins.add(userId);
  else mem.admins.delete(userId);
}
