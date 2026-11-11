"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { DEV_USER_COOKIE, getCurrentUser, supabaseServer } from "@/lib/auth";
import { isSameOriginRequest } from "@/lib/same-origin";
import { getStore, isSupabaseConfigured } from "@/lib/store";

export type DeleteState = { error?: string } | undefined;

/** Deletes the signed-in account. Same-origin only, so a cross-site form cannot trigger it. */
export async function deleteAccount(_prev: DeleteState, form: FormData): Promise<DeleteState> {
  if (!(await isSameOriginRequest())) return { error: "This request could not be verified. Open Account and try again." };
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account");
  if (form.get("confirm") !== "yes") return { error: "Tick the box to confirm you want to delete everything." };

  await getStore().deleteUserData(user.id);
  if (isSupabaseConfigured()) await (await supabaseServer()).auth.signOut();
  else (await cookies()).delete(DEV_USER_COOKIE);
  redirect("/?deleted=1");
}
