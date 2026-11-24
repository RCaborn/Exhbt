import { NextResponse, type NextRequest } from "next/server";
import { isAdmin } from "@/lib/admin";
import { getCurrentUser } from "@/lib/auth";
import { EDITOR_OWN_COOKIE, isEditorKind } from "@/lib/editor-kind";
import { isPhase2Enabled } from "@/lib/site";

const YEAR = 60 * 60 * 24 * 365;
const EXHBT_ID = /^[0-9a-f-]{36}$/;

/**
 * An admin's own choice of editor (lib/editor-kind.ts; decision 0026, "The classic editor: the switch,
 * the fallback, the escape"): stores it in a cookie in this browser. Only for a signed-in admin, recognised
 * as /admin recognises one. Anyone else gets the plain 404 of a route that was never there, and no cookie.
 * The cookie decides nothing by itself: the edit page counts it only while the person signed in is an admin.
 *
 * A form post with `kind`, "page" or "classic".
 *  - With `exhbt`, an exhbt's id, it answers by sending the browser to that exhbt's edit page, with nothing
 *    else in the address. The classic editor's "Try the new editor" is a plain form, so the page loads afresh.
 *  - Without it, it answers with JSON. The new editor's menu posts "classic" and then loads the page itself.
 */
export async function POST(req: NextRequest) {
  if (!isPhase2Enabled() || !(await isAdmin(await getCurrentUser()))) return new NextResponse("Not found", { status: 404 });
  const form = await req.formData().catch(() => null);
  const kind = form?.get("kind");
  if (!isEditorKind(kind)) return new NextResponse("Say kind=page or kind=classic", { status: 400 });
  const exhbt = form?.get("exhbt");
  const res =
    typeof exhbt === "string" && EXHBT_ID.test(exhbt)
      ? NextResponse.redirect(new URL(`/exhbts/${exhbt}/edit`, req.url), 303)
      : NextResponse.json({ editor: kind }, { headers: { "Cache-Control": "no-store" } });
  res.cookies.set(EDITOR_OWN_COOKIE, kind, { path: "/", httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: YEAR });
  return res;
}
