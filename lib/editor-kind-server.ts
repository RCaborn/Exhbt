import "server-only";
import { cookies } from "next/headers";
import { decideEditor, decideForEveryone, EDITOR_KIND_COOKIE, EDITOR_OWN_COOKIE, type EditorFacts, type EditorKind } from "./editor-kind";

/*
 * The request's side of the editor switch: what lib/editor-kind.ts decides from. It is a file of its own,
 * marked server only, because it reads the request's cookies (`next/headers`), which client code must not
 * import; the rule itself has no such need.
 *
 * EXHBT_EDITOR is read on each request, so changing it in the Cloudflare dashboard takes effect without a
 * build. It is not in wrangler.jsonc, whose vars are reset on every deploy, and not in next.config.ts,
 * which is fixed at build.
 */
async function facts(): Promise<EditorFacts> {
  const jar = await cookies();
  return {
    variable: process.env.EXHBT_EDITOR,
    production: process.env.NODE_ENV === "production",
    devCookie: jar.get(EDITOR_KIND_COOKIE)?.value,
    own: jar.get(EDITOR_OWN_COOKIE)?.value,
  };
}

/** The editor an ordinary person gets now. /api/health reports this, whoever asks. */
export async function editorForEveryone(): Promise<EditorKind> {
  return decideForEveryone(await facts());
}

/**
 * The editor the signed-in person gets. `admin` is whether they are one, checked on this request
 * (isAdmin in lib/admin.ts): only then does their own choice count.
 */
export async function editorKind(admin: boolean): Promise<EditorKind> {
  return decideEditor({ ...(await facts()), admin });
}
