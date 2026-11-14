"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import type { Plan } from "@/lib/entitlements";
import { usernameProblem } from "@/lib/hosts";
import { canUseTheme, getPlan } from "@/lib/plan";
import { themeById } from "@/lib/portfolio-themes";
import { isPhase2Enabled } from "@/lib/site";
import { getStore } from "@/lib/store";
import { deleteFile } from "@/lib/uploads";
import { profileSchema, USERNAME_CLAIMS_PER_HOUR, type ProfileField } from "./rules";

export type UsernameState = { name?: string; error?: string; saved?: boolean } | undefined;
export type ProfileState = { error?: string; fieldErrors?: Partial<Record<ProfileField, string>>; saved?: boolean } | undefined;

const SIGNED_OUT = "Your session has ended. Sign in again to save.";

/** Claims or changes the username. The old one redirects for 30 days (the store keeps it). */
export async function claimUsernameAction(_prev: UsernameState, form: FormData): Promise<UsernameState> {
  if (!isPhase2Enabled()) return { error: "This isn't available yet." };
  const user = await getCurrentUser();
  if (!user) return { error: SIGNED_OUT };

  const name = String(form.get("username") ?? "").trim().toLowerCase();
  const problem = usernameProblem(name);
  if (problem) return { name, error: problem };

  const store = getStore();
  const current = (await store.getPortfolioProfile(user.id)).username;
  if (current === name) return { name, saved: true };

  // Rate limit: the user id stands in for the ipHash the event counter matches on.
  if ((await store.countRecentEvents("username_claimed", user.id, 1)) >= USERNAME_CLAIMS_PER_HOUR) {
    return { name, error: "You've changed your username several times in the last hour. Try again later." };
  }
  if ((await store.claimUsername(user.id, name)) === "taken") return { name, error: "That name is taken. Try another." };
  await store.logEvent("username_claimed", user.id, { ipHash: user.id, changed: Boolean(current) });
  revalidatePath("/account/portfolio");
  return { name, saved: true };
}

/** Name, headline, bio, LinkedIn and the search-engine setting. */
export async function saveProfileAction(_prev: ProfileState, form: FormData): Promise<ProfileState> {
  if (!isPhase2Enabled()) return { error: "This isn't available yet." };
  const user = await getCurrentUser();
  if (!user) return { error: SIGNED_OUT };

  const parsed = profileSchema.safeParse({
    name: String(form.get("name") ?? ""),
    headline: String(form.get("headline") ?? ""),
    bio: String(form.get("bio") ?? ""),
    linkedin: String(form.get("linkedin") ?? ""),
    hideFromSearch: form.get("hideFromSearch") === "yes",
  });
  if (!parsed.success) {
    const fieldErrors: Partial<Record<ProfileField, string>> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as ProfileField;
      fieldErrors[key] ??= issue.message;
    }
    return { fieldErrors };
  }

  const p = parsed.data;
  await getStore().updatePortfolioProfile(user.id, {
    name: p.name || null,
    headline: p.headline || null,
    bio: p.bio || null,
    linkedin: p.linkedin,
    hideFromSearch: p.hideFromSearch,
  });
  revalidatePath("/account/portfolio");
  return { saved: true };
}

export type PhotoState = { error?: string; saved?: boolean };

/**
 * Sets the profile photo to a file the person has just uploaded (kind "photo", through
 * /api/files/upload-url). The old photo's file is deleted, so replacing never leaves one behind.
 */
export async function savePhotoAction(fileId: string): Promise<PhotoState> {
  if (!isPhase2Enabled()) return { error: "This isn't available yet." };
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
  revalidatePath("/account/portfolio");
  return { saved: true };
}

/** Takes the photo off the profile and deletes its file. Initials show instead. */
export async function removePhotoAction(): Promise<PhotoState> {
  if (!isPhase2Enabled()) return { error: "This isn't available yet." };
  const user = await getCurrentUser();
  if (!user) return { error: SIGNED_OUT };
  const store = getStore();
  const old = (await store.getPortfolioProfile(user.id)).photoFileId;
  await store.updatePortfolioProfile(user.id, { photoFileId: null });
  if (old) await deleteFile(user.id, old);
  revalidatePath("/account/portfolio");
  return { saved: true };
}

export type ThemeState = { error?: string; upgradeTo?: Plan; saved?: boolean } | undefined;

/**
 * Saves the portfolio look. The plan is checked here, not in the picker: a look the plan doesn't
 * have is refused with the upgrade offer. A look already stored stays stored when the plan drops
 * it (themeFor shows the default meanwhile), so a later upgrade brings it back.
 */
export async function saveThemeAction(_prev: ThemeState, form: FormData): Promise<ThemeState> {
  if (!isPhase2Enabled()) return { error: "This isn't available yet." };
  const user = await getCurrentUser();
  if (!user) return { error: SIGNED_OUT };
  const theme = themeById(String(form.get("themeId") ?? ""));
  if (!theme) return { error: "Choose one of the looks in the list." };
  const verdict = canUseTheme(await getPlan(user.id), theme);
  if (!verdict.ok) return { error: verdict.reason, upgradeTo: verdict.upgradeTo };
  await getStore().updatePortfolioProfile(user.id, { themeId: theme.id });
  revalidatePath("/account/portfolio");
  return { saved: true };
}
