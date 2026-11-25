import { NextResponse, type NextRequest } from "next/server";
import { decideForEveryone, EDITOR_KIND_COOKIE, isEditorKind } from "@/lib/editor-kind";
import { isSupabaseConfigured } from "@/lib/store";

export const dynamic = "force-dynamic";

/**
 * Development only: stands in for the runtime variable EXHBT_EDITOR, for this browser alone, so each
 * browser test has its own setting and a failed test cannot leave one behind for the next.
 *   /dev/editor?kind=classic   as if EXHBT_EDITOR were "classic"
 *   /dev/editor?kind=page      as if it were "page"
 *   /dev/editor?kind=default   as if it were not set, so DEFAULT_EDITOR decides
 *   /dev/editor?kind=          clears the cookie: the server's own EXHBT_EDITOR again
 *   /dev/editor                changes nothing
 * It sets the cookie lib/editor-kind.ts reads in development, and answers with the editor an ordinary
 * person now gets in this browser, as JSON. An admin's own choice still comes first, as it does over the
 * variable. Disabled with Supabase or in production, like /dev/portfolio.
 */
export async function GET(req: NextRequest) {
  if (isSupabaseConfigured() || process.env.NODE_ENV === "production") return new NextResponse("Not found", { status: 404 });
  const kind = req.nextUrl.searchParams.get("kind");
  const set = isEditorKind(kind) || kind === "default" ? kind : null;
  const devCookie = set ?? (kind === "" ? undefined : req.cookies.get(EDITOR_KIND_COOKIE)?.value);
  const editor = decideForEveryone({ variable: process.env.EXHBT_EDITOR, production: false, devCookie });
  const res = NextResponse.json({ editor }, { headers: { "Cache-Control": "no-store" } });
  if (set) res.cookies.set(EDITOR_KIND_COOKIE, set, { path: "/", sameSite: "lax" });
  else if (kind === "") res.cookies.delete(EDITOR_KIND_COOKIE);
  return res;
}
