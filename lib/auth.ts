import "server-only";
import { cookies, headers } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { APEX, APP_HOST, MARKETING_HOST } from "./hosts";
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
  // Production sets this to https://app.exhbt.co.uk so every email link lands on the tool host.
  // A workers.dev preview keeps its own URL: replacing it would point the link at production.
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const bare = host.toLowerCase().replace(/:\d+$/, "");
  if (bare === APEX || bare === MARKETING_HOST) return `https://${APP_HOST}`;
  return `${h.get("x-forwarded-proto") ?? "http"}://${host}`;
}

/**
 * A sign-in link to put inside our own emails (e.g. the roadmap email), without
 * Supabase sending a separate email. Production: Supabase admin generateLink, whose
 * hashed token is verified by /auth/confirm. Development: the /auth/dev stand-in.
 */
export async function signInLinkFor(email: string, next: string, via = "roadmap_email"): Promise<string> {
  const origin = await siteOrigin();
  const n = encodeURIComponent(next);
  if (!isSupabaseConfigured()) return `${origin}/auth/dev?email=${encodeURIComponent(email)}&next=${n}`;
  const { supabaseAdmin } = await import("./store");
  const admin = supabaseAdmin().auth.admin;
  let res = await admin.generateLink({ type: "magiclink", email });
  if (res.error) {
    // First contact: the visitor has no account yet. Create one (unconfirmed; clicking
    // the link proves they own the address), then ask for the link again.
    await admin.createUser({ email, email_confirm: false });
    res = await admin.generateLink({ type: "magiclink", email });
  }
  const props = res.data?.properties;
  if (res.error || !props?.hashed_token) throw new Error(res.error?.message ?? "Could not create sign-in link");
  const type = props.verification_type ?? "magiclink";
  return `${origin}/auth/confirm?token_hash=${props.hashed_token}&type=${type}&next=${n}&via=${encodeURIComponent(via)}`;
}

/**
 * Sends the /login sign-in email. We build the link ourselves (signInLinkFor) and send it
 * through Resend, rather than using Supabase's signInWithOtp: that one is a PKCE link, which
 * only works in the browser that asked for it, and it depends on Supabase's Site URL and SMTP
 * settings. Returns a dev-only link when Supabase is not configured, so the whole flow can be
 * exercised locally without an email provider.
 */
export async function sendMagicLink(email: string, next: string): Promise<{ devLink?: string }> {
  if (isSupabaseConfigured()) {
    const origin = await siteOrigin();
    const { sendEmail } = await import("./email/send");
    const { signInEmail } = await import("./email/templates/sign-in");
    const content = signInEmail({
      signInUrl: await signInLinkFor(email, next, "login"),
      privacyUrl: `${origin}/legal/privacy`,
      logoUrl: `${origin}/brand/exhbt-mark.png`,
    });
    await sendEmail({ to: email, ...content });
    return {};
  }
  return { devLink: `/auth/dev?email=${encodeURIComponent(email)}&next=${encodeURIComponent(next)}` };
}

export const DEV_USER_COOKIE = DEV_COOKIE;

/** Only allow same-site relative redirects after login. */
export function safeNext(next: string | null | undefined, fallback = "/roadmap") {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : fallback;
}
