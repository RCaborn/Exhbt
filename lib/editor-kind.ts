/**
 * Which editor /exhbts/<id>/edit serves: the edit-on-page editor ("page") or the cards editor ("classic").
 *
 * This file is the rule and nothing else (decision 0026, "The classic editor: the switch, the fallback,
 * the escape"). It reads no request, so the tests run it exactly as it ships
 * (e2e/editor-admin-switch.spec.ts) and anyone can read what the one constant below does. What a request
 * says (its cookies, who is signed in) is read in lib/editor-kind-server.ts, which is server only.
 */
export type EditorKind = "page" | "classic";

/**
 * THE SWITCH: the editor everyone gets when nothing else says otherwise.
 *
 * "classic" keeps the new editor switched off: only an admin can turn it on, for themselves.
 * To switch the new editor on for everyone, change "classic" to "page" on the line below and deploy.
 * (One test pins this value so that a merge cannot change it unseen: e2e/editor-admin-switch.spec.ts,
 * SHIPPED_DEFAULT. Change it there too.)
 *
 * No deploy is needed for either direction: the runtime variable EXHBT_EDITOR, set on the Worker in the
 * Cloudflare dashboard, overrides this for everyone. "page" switches the new editor on, "classic" forces
 * the classic one (the emergency switch after launch); deleted, or set to anything else, this line decides.
 */
export const DEFAULT_EDITOR: EditorKind = "page";

/**
 * An admin's own choice, remembered in their browser for a year. It is honoured only while the signed-in
 * person is an admin, which is checked on every request: the same cookie sent by anyone else is ignored.
 * Set by POST /api/exhbts/editor.
 */
export const EDITOR_OWN_COOKIE = "exhbt-editor-own";

/**
 * Development only: stands in for the variable EXHBT_EDITOR, for one browser (app/dev/editor), so each
 * browser test has its own setting. "page" and "classic" are the variable's two values; "default" is the
 * variable not set at all. Never read in production.
 */
export const EDITOR_KIND_COOKIE = "exhbt-editor-kind";

export const isEditorKind = (v: unknown): v is EditorKind => v === "page" || v === "classic";

/** What decides, all of it. */
export type EditorFacts = {
  /** The runtime variable EXHBT_EDITOR as it is set, if it is. */
  variable: string | undefined;
  /** process.env.NODE_ENV is "production". */
  production: boolean;
  /** The development cookie (EDITOR_KIND_COOKIE), if the browser sent one. */
  devCookie?: string;
  /** Whether the signed-in person is an admin, as /admin recognises one, checked on this request. */
  admin?: boolean;
  /** The admin's own cookie (EDITOR_OWN_COOKIE), if the browser sent one. */
  own?: string;
};

/**
 * The editor an ordinary person gets, which is also what /api/health reports: EXHBT_EDITOR when it is
 * exactly "page" or "classic", and DEFAULT_EDITOR for anything else or nothing. In development the cookie
 * stands in for the variable when the browser has one.
 */
export function decideForEveryone({ variable, production, devCookie }: EditorFacts): EditorKind {
  const said = !production && (isEditorKind(devCookie) || devCookie === "default") ? devCookie : variable;
  return isEditorKind(said) ? said : DEFAULT_EDITOR;
}

/**
 * The editor this person gets. An admin's own choice comes first, over the variable and the default, so an
 * admin can always look at either editor. Everyone else gets what everyone gets.
 * (One thing outranks even this, in the edit page itself: an address that asks for the classic editor,
 * `?editor=classic`, which is how the crash fallback gets anyone out of a new editor that throws.)
 */
export function decideEditor(facts: EditorFacts): EditorKind {
  return facts.admin && isEditorKind(facts.own) ? facts.own : decideForEveryone(facts);
}
