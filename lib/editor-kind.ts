import "server-only";
import { cookies } from "next/headers";

/** Which editor /exhbts/<id>/edit serves: the edit-on-page editor ("page") or today's cards editor ("classic"). */
export type EditorKind = "page" | "classic";

/** The development cookie that overrides the variable, so each browser test has its own (app/dev/editor). */
export const EDITOR_KIND_COOKIE = "exhbt-editor-kind";

/** What the runtime variable says: "classic" only when EXHBT_EDITOR is "classic", anything else (or nothing) is "page". */
export const editorKindFromEnv = (): EditorKind => (process.env.EXHBT_EDITOR === "classic" ? "classic" : "page");

/**
 * Which editor /exhbts/<id>/edit serves. "classic" only when the runtime variable EXHBT_EDITOR is
 * "classic". Read on each request, so changing the variable in Cloudflare takes effect without a
 * build (it is not in wrangler.jsonc, whose vars are reset on every deploy, and not in
 * next.config.ts, which is fixed at build). In development only, the cookie `exhbt-editor-kind`
 * overrides it. In release 2 nothing but /api/health reads this; the edit page starts using it in
 * release 3. It lives here, not in lib/site.ts, because that file reaches client components and
 * `next/headers` must not.
 */
export async function editorKind(): Promise<EditorKind> {
  if (process.env.NODE_ENV !== "production") {
    const set = (await cookies()).get(EDITOR_KIND_COOKIE)?.value;
    if (set === "page" || set === "classic") return set;
  }
  return editorKindFromEnv();
}
