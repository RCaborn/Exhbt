import { NextResponse, type NextRequest } from "next/server";
import { editorKindFromEnv, EDITOR_KIND_COOKIE } from "@/lib/editor-kind";
import { isSupabaseConfigured } from "@/lib/store";

export const dynamic = "force-dynamic";

/**
 * Development only: chooses the editor for this browser. /dev/editor?kind=classic (or page) sets the
 * cookie that lib/editor-kind.ts reads; /dev/editor?kind= clears it. Answers with the kind now in
 * force, as JSON. Disabled with Supabase or in production, like /dev/portfolio.
 */
export async function GET(req: NextRequest) {
  if (isSupabaseConfigured() || process.env.NODE_ENV === "production") return new NextResponse("Not found", { status: 404 });
  const kind = req.nextUrl.searchParams.get("kind");
  const set = kind === "page" || kind === "classic" ? kind : null;
  const current = set ?? (kind === "" ? editorKindFromEnv() : cookieKind(req) ?? editorKindFromEnv());
  const res = NextResponse.json({ editor: current }, { headers: { "Cache-Control": "no-store" } });
  if (set) res.cookies.set(EDITOR_KIND_COOKIE, set, { path: "/", sameSite: "lax" });
  else if (kind === "") res.cookies.delete(EDITOR_KIND_COOKIE);
  return res;
}

function cookieKind(req: NextRequest) {
  const v = req.cookies.get(EDITOR_KIND_COOKIE)?.value;
  return v === "page" || v === "classic" ? v : null;
}
