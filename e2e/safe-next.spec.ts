import { expect, test } from "@playwright/test";
import { safeNext } from "../lib/safe-next";

// Where a person is sent after signing in (lib/safe-next.ts, used by /auth/callback, /auth/confirm, the login
// forms and the development sign-in): only a path on this site, never another site, however it is spelt.

const ORIGIN = "https://exhbt.co.uk";
/** Where a browser would go if sent to `to` from this site. */
const lands = (to: string) => new URL(to, ORIGIN).origin;

test("a path on this site is kept as it is, query and hash included", () => {
  for (const ok of ["/portfolio?x=1#y", "/portfolio", "/exhbts/new?into=abc", "/", "/p/maya/lunch-queue"]) expect(safeNext(ok, "/fallback"), ok).toBe(ok);
});

test("another site, however it is spelt, gives the fallback", () => {
  for (const bad of ["/\\evil.com", "/\\evil.com/x", "//evil.com", "//evil.com/x", "\\\\evil.com", "https://evil.com", "evil.com", "/\t/evil.com", "/\n/evil.com", "/\u0000evil", ""]) {
    expect(safeNext(bad, "/fallback"), JSON.stringify(bad)).toBe("/fallback");
  }
  expect(safeNext(null, "/fallback")).toBe("/fallback");
  expect(safeNext(undefined)).toBe("/roadmap");
});

test("whatever it keeps stays on this site, an escaped backslash included", () => {
  for (const next of ["/%5Cevil.com", "/%5C%5Cevil.com", "/%2F%2Fevil.com", "/portfolio?next=//evil.com", "/\\evil.com", "//evil.com"]) {
    expect(lands(safeNext(next, "/fallback")), JSON.stringify(next)).toBe(ORIGIN);
  }
});
