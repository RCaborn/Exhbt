import { NextResponse, type NextRequest } from "next/server";
import { DEV_USER_COOKIE, getCurrentUser, supabaseServer } from "@/lib/auth";
import { getStore, isSupabaseConfigured } from "@/lib/store";
import { deleteAllFiles } from "@/lib/uploads";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.url), 303);
  const form = await req.formData();
  if (form.get("confirm") !== "yes") return NextResponse.redirect(new URL("/account", req.url), 303);

  // Stored files first: the database cascade removes their records, and with them the paths.
  await deleteAllFiles(user.id);
  await getStore().deleteUserData(user.id);
  const res = NextResponse.redirect(new URL("/?deleted=1", req.url), 303);
  if (isSupabaseConfigured()) await (await supabaseServer()).auth.signOut();
  else res.cookies.delete(DEV_USER_COOKIE);
  return res;
}
