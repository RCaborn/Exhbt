import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { AI_MODEL, ANTHROPIC_API_KEYS_ENV, anthropicApiKey } from "@/lib/ai/model";
import { isSupabaseConfigured, supabaseAdmin } from "@/lib/store";
import { isStripeConfigured, priceForPlan, stripe, PAID_PLANS } from "@/lib/stripe";

export const dynamic = "force-dynamic";

/**
 * Says whether production is wired up: which settings are present (never their values), whether
 * the database has the tables and columns the app uses, and whether the AI key works.
 * Open /api/health after changing anything in Cloudflare.
 */

/** Settings the roadmap needs at runtime. Names must match exactly. */
const REQUIRED = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "EXHBT_COOKIE_SECRET",
  "RESEND_API_KEY",
  "EMAIL_FROM",
] as const;

/** Near-miss names someone might type instead of a required one. */
const MISNAMED: Record<string, string> = {
  ANTHROPIC_KEY: ANTHROPIC_API_KEYS_ENV,
  CLAUDE_API_KEY: ANTHROPIC_API_KEYS_ENV,
  SUPABASE_SERVICE_KEY: "SUPABASE_SERVICE_ROLE_KEY",
  SUPABASE_URL: "NEXT_PUBLIC_SUPABASE_URL",
  SUPABASE_ANON_KEY: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  COOKIE_SECRET: "EXHBT_COOKIE_SECRET",
  RESEND_KEY: "RESEND_API_KEY",
};

type Check = { ok: boolean; detail?: string };

async function checkDatabase(): Promise<Check> {
  if (!isSupabaseConfigured()) return { ok: false, detail: "Supabase settings missing" };
  const db = supabaseAdmin();
  // The columns the roadmap flow reads and writes, including the latest migration's.
  const probes = [
    db.from("roadmaps").select("id, pending_email, input_json, input_hash, output_json, creator_ip_hash, pending_name, pending_linkedin, projects_unlocked_at, project_swaps_used, plan_confirmed_at").limit(1),
    db.from("project_ideas").select("id").limit(1),
    db.from("events").select("id").limit(1),
    db.from("ai_call_logs").select("id").limit(1),
    db.from("job_profiles").select("id").limit(1),
  ];
  for (const res of await Promise.all(probes)) {
    if (res.error) return { ok: false, detail: res.error.message };
  }
  return { ok: true };
}

async function checkAI(): Promise<Check> {
  const apiKey = anthropicApiKey();
  if (!apiKey) return { ok: false, detail: `${ANTHROPIC_API_KEYS_ENV} is not set` };
  try {
    // Free call: confirms the key is valid and the model is available to it.
    await new Anthropic({ apiKey }).models.retrieve(AI_MODEL);
    return { ok: true };
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) return { ok: false, detail: "The API key was rejected" };
    if (e instanceof Anthropic.NotFoundError) return { ok: false, detail: `Model ${AI_MODEL} is not available to this key` };
    if (e instanceof Anthropic.APIError) return { ok: false, detail: `Anthropic API error ${e.status}: ${e.message.slice(0, 300)}` };
    return { ok: false, detail: "Could not reach the Anthropic API" };
  }
}

/** Phase 2 settings (docs/phase-2.md section 2): Stripe keys and the two price ids. Presence only. */
const PHASE2_SETTINGS = ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "STRIPE_PRICE_PREMIUM", "STRIPE_PRICE_MAX"] as const;

async function checkStripe(): Promise<Check> {
  if (!isStripeConfigured()) return { ok: false, detail: "Stripe keys not set" };
  const missing = PAID_PLANS.filter((p) => !priceForPlan(p));
  if (missing.length) return { ok: false, detail: `No price id for ${missing.join(", ")}` };
  try {
    // Read-only: confirms the key works and both price ids exist in the same Stripe mode.
    const client = stripe();
    await Promise.all(PAID_PLANS.map((p) => client.prices.retrieve(priceForPlan(p)!)));
    return { ok: true };
  } catch (e) {
    const status = (e as { statusCode?: number }).statusCode;
    if (status === 401) return { ok: false, detail: "The Stripe key was rejected" };
    if (status === 404) return { ok: false, detail: "A price id was not found (check test mode against live mode)" };
    return { ok: false, detail: status ? `Stripe API error ${status}` : "Could not reach Stripe" };
  }
}

export async function GET() {
  const settings: Record<string, boolean> = Object.fromEntries(REQUIRED.map((k) => [k, Boolean(process.env[k])]));
  // Read under either name (lib/ai/model.ts).
  settings[ANTHROPIC_API_KEYS_ENV] = Boolean(anthropicApiKey());
  const misnamed = Object.entries(MISNAMED)
    .filter(([wrong]) => process.env[wrong])
    .map(([wrong, right]) => `Rename ${wrong} to ${right}`);
  const [database, ai, stripeCheck] = await Promise.all([checkDatabase(), checkAI(), checkStripe()]);
  const ok = Object.values(settings).every(Boolean) && database.ok && ai.ok;
  // Phase 2 is reported but does NOT affect `ok` (or the 503) until payments are meant to be live:
  // when they are, fold phase2 into `ok` here.
  const phase2 = {
    settings: Object.fromEntries(PHASE2_SETTINGS.map((k) => [k, Boolean(process.env[k])])),
    stripe: stripeCheck,
  };
  return NextResponse.json(
    { ok, settings, misnamed, database, ai, phase2 },
    { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
