"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod/v4";
import { hasIntroFacts, suggestIntro, type IntroFacts } from "@/lib/ai/portfolio-intro";
import { SITUATIONS } from "@/lib/ai/schemas";
import { getCurrentUser } from "@/lib/auth";
import { ENTITLEMENTS, type Plan } from "@/lib/entitlements";
import { usernameProblem } from "@/lib/hosts";
import { canClaimUsername, canUseTheme, customisableExhbts, getPlan } from "@/lib/plan";
import { CustomiseSchema, MAX_REQUEST_CHARS } from "@/lib/portfolio-customise";
import { EXTRA_SECTIONS, layoutFromSections, sectionsOf } from "@/lib/portfolio-layout";
import { ProfileDraftSchema } from "@/lib/portfolio-profile";
import { themeById, themeFor } from "@/lib/portfolio-themes";
import { isPhase2Enabled } from "@/lib/site";
import { getStore } from "@/lib/store";
import { recordAIFailure, tooManyFailures, TOO_MANY_FAILURES } from "@/lib/ai-failures";
import { deleteFile } from "@/lib/uploads";

/**
 * The portfolio builder's server side (decision 0016). The page shows the rules; every one is
 * checked again here: who they are, Phase 2 being on, the shape and size of each request, every
 * word limit and https link, every id being one of their own exhbts, and the plan (lib/plan-rules.ts)
 * for the address, the looks and the extra tiles.
 */

const SIGNED_OUT = "Your session has ended. Sign in again to save.";
const OFF = "This isn't available yet.";

/** Username claims (changes included) a person can make in an hour. */
const USERNAME_CLAIMS_PER_HOUR = 5;
/** "Suggest an intro" requests a person can make in a day. */
const INTRO_SUGGESTIONS_PER_DAY = 10;

function revalidate() {
  revalidatePath("/portfolio");
  revalidatePath("/exhbts");
}

/* ---------- the address ---------- */

export type UsernameState = { name?: string; error?: string; saved?: boolean; upgradeTo?: Plan } | undefined;

/**
 * Claims or changes the username, on a paid plan only (canClaimUsername). The old one redirects for
 * 30 days (the store keeps it). A username someone already has stays theirs on any plan.
 */
export async function claimUsernameAction(_prev: UsernameState, form: FormData): Promise<UsernameState> {
  if (!isPhase2Enabled()) return { error: OFF };
  const user = await getCurrentUser();
  if (!user) return { error: SIGNED_OUT };

  const name = String(form.get("username") ?? "").trim().toLowerCase();
  const store = getStore();
  const current = (await store.getPortfolioProfile(user.id)).username;
  if (current === name) return { name, saved: true };

  const verdict = canClaimUsername(await getPlan(user.id));
  if (!verdict.ok) return { name, error: verdict.reason, upgradeTo: verdict.upgradeTo };

  const problem = usernameProblem(name);
  if (problem) return { name, error: problem };

  // Rate limit: the user id stands in for the ipHash the event counter matches on.
  if ((await store.countRecentEvents("username_claimed", user.id, 1)) >= USERNAME_CLAIMS_PER_HOUR) {
    return { name, error: "You've changed your username several times in the last hour. Try again later." };
  }
  if ((await store.claimUsername(user.id, name)) === "taken") return { name, error: "That name is taken. Try another." };
  await store.logEvent("username_claimed", user.id, { ipHash: user.id, changed: Boolean(current) });
  revalidate();
  return { name, saved: true };
}

/* ---------- the photo ---------- */

export type PhotoState = { error?: string; saved?: boolean };

/**
 * Sets the profile photo to a file the person has just uploaded (kind "photo", through
 * /api/files/upload-url). The old photo's file is deleted, so replacing never leaves one behind.
 */
export async function savePhotoAction(fileId: string): Promise<PhotoState> {
  if (!isPhase2Enabled()) return { error: OFF };
  const user = await getCurrentUser();
  if (!user) return { error: SIGNED_OUT };
  const store = getStore();
  const file = await store.getFile(fileId);
  if (!file || file.userId !== user.id || file.kind !== "photo" || !file.mime.startsWith("image/")) {
    return { error: "We couldn't find that photo. Try uploading it again." };
  }
  const old = (await store.getPortfolioProfile(user.id)).photoFileId;
  await store.updatePortfolioProfile(user.id, { photoFileId: fileId });
  if (old && old !== fileId) await deleteFile(user.id, old);
  revalidate();
  return { saved: true };
}

/** Takes the photo off the profile and deletes its file. Initials show instead. */
export async function removePhotoAction(): Promise<PhotoState> {
  if (!isPhase2Enabled()) return { error: OFF };
  const user = await getCurrentUser();
  if (!user) return { error: SIGNED_OUT };
  const store = getStore();
  const old = (await store.getPortfolioProfile(user.id)).photoFileId;
  await store.updatePortfolioProfile(user.id, { photoFileId: null });
  if (old) await deleteFile(user.id, old);
  revalidate();
  return { saved: true };
}

/* ---------- everything else: autosaved ---------- */

export type BuilderSaveResult =
  | { ok: true; savedAt: string }
  | { ok: false; error: string; upgradeTo?: Plan; field?: string };

const BuilderSchema = z.object({ profile: ProfileDraftSchema, arrangement: CustomiseSchema });

/**
 * Saves the builder's whole state: the "You" fields and the arrangement (look, order, hidden,
 * featured, extra tiles, header bits). The page sends it about half a second after each change.
 *
 * The arrangement keeps the customiser's rules (decision 0014): only their exhbts the plan lists,
 * each once, any it missed on the end; extra tiles only on a plan that has them (saved ones are kept
 * where they were otherwise); the look only if the plan has it, and sending back the look already
 * showing never overwrites a stored choice that is held after a downgrade.
 */
export async function saveBuilderAction(raw: unknown): Promise<BuilderSaveResult> {
  if (!isPhase2Enabled()) return { ok: false, error: OFF };
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: SIGNED_OUT };
  if (JSON.stringify(raw ?? null).length > MAX_REQUEST_CHARS + 8_000) return { ok: false, error: "That's too much to save at once." };
  const parsed = BuilderSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, error: issue?.message ?? "We couldn't read that.", field: issue?.path[0] === "profile" ? String(issue.path[1]) : undefined };
  }
  const { profile: p, arrangement: input } = parsed.data;

  const store = getStore();
  const [plan, exhbts, profile] = await Promise.all([getPlan(user.id), store.listExhbts(user.id), store.getPortfolioProfile(user.id)]);
  const candidates = customisableExhbts(plan, exhbts);
  const candidateIds = new Set(candidates.map((e) => e.id));
  const extrasOk = ENTITLEMENTS[plan].extraTiles;

  // The exhbts: only their own that the plan lists, each once; any the page missed go on the end.
  const seen = new Set<string>();
  const order = input.order.filter((k) => {
    const ok = candidateIds.has(k) && !seen.has(k);
    if (ok) seen.add(k);
    return ok;
  });
  for (const e of candidates) if (!seen.has(e.id)) order.push(e.id);

  // The sections, each once (the schema allows only known keys). Experience and a quote come with
  // extra tiles; on a plan without them, ones saved before are kept, words and all, for when the plan returns.
  let sections = input.sections.filter((k, i) => input.sections.indexOf(k) === i);
  let tiles = input.tiles;
  if (!extrasOk) {
    const held = sectionsOf(profile.layout).filter((k) => EXTRA_SECTIONS.includes(k));
    sections = [...sections.filter((k) => !EXTRA_SECTIONS.includes(k)), ...held];
    tiles = { ...tiles, experience: profile.layout.tiles.experience, quote: profile.layout.tiles.quote };
  }

  const hidden = input.hidden.filter((id) => candidateIds.has(id));
  const keptHidden = exhbts.filter((e) => e.hiddenOnPortfolio && !candidateIds.has(e.id)).map((e) => e.id);
  const featured = input.featured && candidateIds.has(input.featured) && !hidden.includes(input.featured) ? input.featured : null;

  let themeId: string | undefined;
  if (input.themeId !== themeFor(profile, plan).id) {
    const theme = themeById(input.themeId);
    if (!theme) return { ok: false, error: "Choose one of the looks in the list." };
    const verdict = canUseTheme(plan, theme);
    if (!verdict.ok) return { ok: false, error: verdict.reason, upgradeTo: verdict.upgradeTo };
    themeId = theme.id;
  }

  // Their exhbts take the places the listed ones had, so drafts and anything else stay put.
  const queue = [...order];
  const sorted = [...exhbts].sort((a, b) => a.position - b.position).map((e) => e.id);
  const positions = sorted.map((id) => (candidateIds.has(id) ? queue.shift()! : id));

  await store.updatePortfolioProfile(user.id, {
    name: p.name || null,
    headline: p.headline || null,
    bio: p.bio || null,
    location: p.location || null,
    lookingFor: p.lookingFor || null,
    linkedin: p.linkedin,
    github: p.github,
    website: p.website,
    contactEmail: p.contactEmail || null,
    hideFromSearch: p.hideFromSearch,
    ...(themeId ? { themeId } : {}),
  });
  await store.savePortfolioLayout(user.id, {
    layout: layoutFromSections(sections, tiles, input.header),
    featuredExhbtId: featured,
    hiddenIds: [...hidden, ...keptHidden],
    order: positions,
  });
  revalidate();
  return { ok: true, savedAt: new Date().toISOString() };
}

/* ---------- "Suggest an intro" ---------- */

export type IntroSuggestion = { ok: true; intro: string } | { ok: false; error: string };

/**
 * Drafts an intro from what the person has told us: their newest roadmap's answers and CV, their
 * exhbts, and the "You" fields as they are on screen (`draft`, checked here). Nothing is saved: the
 * suggestion fills the field and the person edits it, then autosave keeps it.
 */
export async function suggestIntroAction(draft: unknown): Promise<IntroSuggestion> {
  if (!isPhase2Enabled()) return { ok: false, error: OFF };
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: SIGNED_OUT };
  const store = getStore();
  if ((await store.countRecentEvents("intro_suggested", user.id, 24)) >= INTRO_SUGGESTIONS_PER_DAY) {
    return { ok: false, error: "That's all the intro suggestions for today. Write it in your own words, or try again tomorrow." };
  }
  const p = ProfileDraftSchema.partial().safeParse(draft ?? {});
  const now = p.success ? p.data : {};
  const [profile, roadmap, exhbts] = await Promise.all([store.getPortfolioProfile(user.id), store.latestRoadmapFor(user.id), store.listExhbts(user.id)]);
  const input = roadmap?.input;
  const facts: IntroFacts = {
    name: now.name || profile.name || "",
    headline: now.headline || profile.headline || "",
    location: now.location || profile.location || "",
    lookingFor: now.lookingFor || profile.lookingFor || "",
    targetRole: input?.targetRole ?? "",
    situation: input ? SITUATIONS[input.situation] : "",
    education: input?.education ?? "",
    skills: input?.skills ?? "",
    cv: input?.cvText ?? "",
    projects: exhbts.slice(0, 8).map((e) => {
      const d = e.published ?? e.doc;
      return { title: d.title.trim(), context: d.context, skills: d.skills };
    }).filter((x) => x.title),
  };
  if (!hasIntroFacts(facts)) {
    return { ok: false, error: "There isn't enough to go on yet. Add a headline, build a roadmap with your CV, or start an exhbt, then try again." };
  }
  if (await tooManyFailures("portfolio_intro", { userId: user.id })) return { ok: false, error: TOO_MANY_FAILURES };
  let result;
  try {
    result = await suggestIntro(facts);
  } catch (e) {
    await recordAIFailure("portfolio_intro", { userId: user.id }, e);
    return { ok: false, error: "We couldn't write a suggestion just now. Try again in a moment." };
  }
  await store.logAICall({ userId: user.id, step: "portfolio_intro", model: result.model, inputTokens: result.inputTokens, outputTokens: result.outputTokens, costUsd: result.costUsd });
  await store.logEvent("intro_suggested", user.id, { ipHash: user.id, model: result.model });
  if (!result.intro.trim()) return { ok: false, error: "There isn't enough to go on yet. Write a line or two yourself." };
  return { ok: true, intro: result.intro };
}
