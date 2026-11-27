/** Any origin will do for safeNext's check: what matters is whether `next` keeps to it. */
const SAME = "https://same.invalid";

/**
 * Only allow same-site relative redirects after login: a path that, read against this site's origin, stays
 * on it. A browser and `new URL` read "\\" as "/", so "/\\evil.com" is "//evil.com", another site; and
 * control characters (a tab, a newline) are dropped from a URL, which can join the same two slashes. So
 * neither is allowed at all, and what is left must resolve to the same origin.
 */
export function safeNext(next: string | null | undefined, fallback = "/roadmap") {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return fallback;
  if (/[\\\u0000-\u001f\u007f]/.test(next)) return fallback;
  try {
    return new URL(next, SAME).origin === SAME ? next : fallback;
  } catch {
    return fallback;
  }
}
