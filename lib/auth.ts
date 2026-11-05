import "server-only";
import { cookies, headers } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { isSupabaseConfigured } from "./store";

export type SessionUser = { id: string; email: string };

const DEV_COOKIE = "exhbt_dev_user";

export async function supabaseServer() {
  const store = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // Called from a Server Component: the middleware refreshes the session instead.
        }
      },
    },
  });
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  if (isSupabaseConfigured()) {
    const sb = await supabaseServer();
    const { data } = await sb.auth.getUser();
    return data.user?.email ? { id: data.user.id, email: data.user.email } : null;
  }
  const email = (await cookies()).get(DEV_COOKIE)?.value;
  return email ? { id: `dev-${email}`, email } : null;
}

export async function siteOrigin() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const h = await headers();
  return `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
}

/**
 * A sign-in link to put inside our own emails (e.g. the roadmap email), without
 * Supabase sending a separate email. Production: Supabase admin generateLink, whose
 * hashed token is verified by /auth/confirm. Development: the /auth/dev stand-in.
 */
export async function signInLinkFor(email: string, next: string): Promise<string> {
  const origin = await siteOrigin();
  const n = encodeURIComponent(next);
  if (!isSupabaseConfigured()) return `${origin}/auth/dev?email=${encodeURIComponent(email)}&next=${n}`;
  const { supabaseAdmin } = await import("./store");
  const { data, error } = await supabaseAdmin().auth.admin.generateLink({ type: "magiclink", email });
  if (error || !data.properties?.hashed_token) throw new Error(error?.message ?? "Could not create sign-in link");
  return `${origin}/auth/confirm?token_hash=${data.properties.hashed_token}&type=magiclink&next=${n}`;
}

/**
 * Sends a magic link. Returns a dev-only link when Supabase is not configured,
 * so the whole flow can be exercised locally without an email provider.
 */
export async function sendMagicLink(email: string, next: string): Promise<{ devLink?: string }> {
  const origin = await siteOrigin();
  const callback = `${origin}/auth/callback?next=${encodeURIComponent(next)}`;
  if (isSupabaseConfigured()) {
    const sb = await supabaseServer();
    const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: callback } });
    if (error) throw new Error(error.message);
    return {};
  }
  return { devLink: `/auth/dev?email=${encodeURIComponent(email)}&next=${encodeURIComponent(next)}` };
}

export const DEV_USER_COOKIE = DEV_COOKIE;

/** Only allow same-site relative redirects after login. */
export function safeNext(next: string | null | undefined, fallback = "/roadmap") {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : fallback;
}
