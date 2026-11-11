import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { AI_MODEL, anthropicApiKey } from "@/lib/ai/model";
import { isSupabaseConfigured, supabaseAdmin } from "@/lib/store";

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
  "ANTHROPIC_API_KEY",
  "EXHBT_COOKIE_SECRET",
  "RESEND_API_KEY",
  "EMAIL_FROM",
] as const;

/** Near-miss names someone might type instead of a required one. */
const MISNAMED: Record<string, string> = {
  ANTHROPIC_API_KEYS: "ANTHROPIC_API_KEY (it works for now, but rename it when you can)",
  ANTHROPIC_KEY: "ANTHROPIC_API_KEY",
  CLAUDE_API_KEY: "ANTHROPIC_API_KEY",
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
  if (!apiKey) return { ok: false, detail: "ANTHROPIC_API_KEY is not set" };
  try {
    // Free call: confirms the key is valid and the model is available to it.
    await new Anthropic({ apiKey }).models.retrieve(AI_MODEL);
    return { ok: true };
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) return { ok: false, detail: "The API key was rejected" };
    if (e instanceof Anthropic.NotFoundError) return { ok: false, detail: `Model ${AI_MODEL} is not available to this key` };
    if (e instanceof Anthropic.APIError) return { ok: false, detail: `Anthropic API error ${e.status}` };
    return { ok: false, detail: "Could not reach the Anthropic API" };
  }
}

export async function GET() {
  const settings: Record<string, boolean> = Object.fromEntries(REQUIRED.map((k) => [k, Boolean(process.env[k])]));
  // The key also works under the old name (lib/ai/model.ts); the rename is reported below.
  settings.ANTHROPIC_API_KEY = Boolean(anthropicApiKey());
  const misnamed = Object.entries(MISNAMED)
    .filter(([wrong]) => process.env[wrong])
    .map(([wrong, right]) => `Rename ${wrong} to ${right}`);
  const [database, ai] = await Promise.all([checkDatabase(), checkAI()]);
  const ok = Object.values(settings).every(Boolean) && database.ok && ai.ok;
  return NextResponse.json(
    { ok, settings, misnamed, database, ai },
    { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
