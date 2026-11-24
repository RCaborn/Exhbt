import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { SCHEMA_VERSION, text, type ExhbtDoc } from "../lib/exhbt/blocks";
import { decideEditor, decideForEveryone, DEFAULT_EDITOR, EDITOR_OWN_COOKIE, type EditorFacts, type EditorKind } from "../lib/editor-kind";

// The new editor goes live switched off (Rory, 24 Nov 2026; decision 0026, "Going live: switched off, then
// on"): everyone gets the classic editor, an admin can turn the new one on for themselves, and the runtime
// variable EXHBT_EDITOR overrides the default for everyone, both ways.
//
// The variable cannot be changed inside one test run: the server reads it from its own environment, and
// playwright.config.ts starts the server with EXHBT_EDITOR=page, so that every other spec gets the new editor
// as people will once it is on for everyone. So this spec tests the switch twice:
//  - directly: the rule itself (lib/editor-kind.ts), run here as production runs it;
//  - in the browser: through /dev/editor?kind=, a development-only cookie that stands in for the variable for
//    one browser ("page", "classic", or "default" for a variable that is not set).
// Each test seeds its exhbts with POST /dev/parity for a fresh username, then signs in with /auth/dev;
// /dev/admin?role=admin makes the signed-in person an admin, as e2e/admin.spec.ts does.

/**
 * The default the live site ships with. This is the one line that pins it, so that a merge cannot switch the
 * new editor on for everyone unseen.
 * ON LAUNCH DAY, if the new editor is switched on in the code (DEFAULT_EDITOR in lib/editor-kind.ts becomes
 * "page"), change this to "page" as well. Nothing else in this file changes: every other expectation follows
 * DEFAULT_EDITOR. Switching it on with the variable (EXHBT_EDITOR=page) needs neither change.
 */
const SHIPPED_DEFAULT: EditorKind = "classic";

/** What the variable says, for one browser: "default" is a variable that is not set. */
type Variable = "page" | "classic" | "default";
/** The setting under which the new editor is off for everyone: today nothing set at all, as on the live site; once the default is "page", the variable set to "classic". */
const OFF: Variable = DEFAULT_EDITOR === "classic" ? "default" : "classic";

const CLASSIC = '[data-editor="classic"]';
/** The classic editor, hydrated. */
const CLASSIC_READY = `${CLASSIC} [data-ready=true]`;
/** The new editor, up: the loading view (drawn on the server) has no data-ready. */
const NEW_READY = '[data-editor="page"][data-ready="true"]';

const doc = (title: string): ExhbtDoc => ({
  schemaVersion: SCHEMA_VERSION,
  title,
  context: "Year 2 module",
  skills: ["Excel"],
  gap: text("Would a second till help?"),
  flow: [{ step: "Timed it" }, { step: "Added a till" }, { step: "Timed it again" }],
  sections: [{ id: "findings", kind: "findings", items: [text("Waits fell from 11 to 4 minutes."), text("Sales held steady.")] }],
});

/** Stores an exhbt for the development user of that username and returns its edit address. */
async function store(page: Page, username: string, slug: string): Promise<string> {
  const res = await page.request.post("/dev/parity", { data: { username, slug, doc: doc(`Shorter queues (${slug})`) } });
  expect(res.status(), await res.text()).toBe(200);
  return `/exhbts/${((await res.json()) as { id: string }).id}/edit`;
}

/** A fresh person with one exhbt (or one for each slug), signed in, with the variable set for this browser. Returns the edit addresses. */
async function person(page: Page, tag: string, variable: Variable, opts: { admin?: boolean; slugs?: string[] } = {}): Promise<string[]> {
  const username = `${tag}${Math.random().toString(36).slice(2, 7)}`;
  const edits: string[] = [];
  for (const slug of opts.slugs ?? ["queues"]) edits.push(await store(page, username, slug));
  await page.goto(`/auth/dev?email=${username}@example.com&next=/exhbts`);
  await expect(page.getByRole("heading", { level: 1, name: "Your exhbts" })).toBeVisible();
  if (opts.admin) await admin(page, true);
  await sayVariable(page, variable);
  return edits;
}

/** Makes the signed-in person an admin, or takes it back (the stand-in for profiles.role). */
async function admin(page: Page, on: boolean) {
  expect((await page.request.get(`/dev/admin?role=${on ? "admin" : "user"}`)).status()).toBe(200);
}

/** Sets what EXHBT_EDITOR says, for this browser, and returns the editor an ordinary person then gets. */
async function sayVariable(page: Page, variable: Variable): Promise<string> {
  return ((await (await page.request.get(`/dev/editor?kind=${variable}`)).json()) as { editor: string }).editor;
}

/** Puts the admin's own cookie in this browser by hand, as anyone could. */
const carry = (page: Page, baseURL: string | undefined, kind: EditorKind) => page.context().addCookies([{ name: EDITOR_OWN_COOKIE, value: kind, url: baseURL! }]);

/** Opens the address and says which editor it served, once that editor is up. */
async function served(page: Page, url: string): Promise<string | null> {
  await page.goto(url);
  const up = page.locator(`${CLASSIC_READY}, ${NEW_READY}`);
  await expect(up).toHaveCount(1);
  return up.evaluate((el) => el.closest("[data-editor]")?.getAttribute("data-editor") ?? null);
}

/** What /api/health says an ordinary person gets. It answers 503 here (no database), so read the body and ignore the status. */
const healthSays = async (request: APIRequestContext) => ((await (await request.get("/api/health?only=editor")).json()) as { editor: string }).editor;

test.describe("the rule that decides, run directly, as the live site runs it", () => {
  /** The live site: production, and no development cookie counts. */
  const live = (facts: Partial<EditorFacts> = {}) => decideEditor({ variable: undefined, production: true, ...facts });
  const other = (kind: EditorKind): EditorKind => (kind === "page" ? "classic" : "page");

  test("the default is the one pinned here: the classic editor until the new one is switched on for everyone", () => {
    expect(DEFAULT_EDITOR, "DEFAULT_EDITOR in lib/editor-kind.ts has changed. If this is the launch, change SHIPPED_DEFAULT at the top of this file to match; if not, change it back.").toBe(SHIPPED_DEFAULT);
  });

  test("with EXHBT_EDITOR not set, or set to anything but page or classic, everyone gets the default", () => {
    for (const variable of [undefined, "", "Page", "CLASSIC", " page", "classic ", "1", "on", "new", "default"]) {
      expect(live({ variable }), `EXHBT_EDITOR=${JSON.stringify(variable)}`).toBe(DEFAULT_EDITOR);
      expect(decideForEveryone({ variable, production: true })).toBe(DEFAULT_EDITOR);
    }
  });

  test("EXHBT_EDITOR overrides the default for everyone, both ways", () => {
    expect(live({ variable: "page" })).toBe("page");
    expect(live({ variable: "classic" })).toBe("classic");
    // Whatever the default is, the variable can say the other.
    expect(live({ variable: other(DEFAULT_EDITOR) })).toBe(other(DEFAULT_EDITOR));
  });

  test("an admin's own choice wins over the default and over EXHBT_EDITOR", () => {
    for (const variable of [undefined, "page", "classic", "nonsense"]) {
      expect(live({ variable, admin: true, own: "page" }), `EXHBT_EDITOR=${variable}`).toBe("page");
      expect(live({ variable, admin: true, own: "classic" }), `EXHBT_EDITOR=${variable}`).toBe("classic");
    }
  });

  test("the same cookie from a person who is not an admin counts for nothing", () => {
    for (const variable of [undefined, "page", "classic"]) {
      const everyone = decideForEveryone({ variable, production: true });
      for (const own of ["page", "classic"]) {
        expect(live({ variable, admin: false, own }), `EXHBT_EDITOR=${variable}, cookie ${own}`).toBe(everyone);
        expect(live({ variable, own }), `EXHBT_EDITOR=${variable}, cookie ${own}, nobody checked`).toBe(everyone);
      }
    }
  });

  test("an admin with no choice, or a cookie that says neither editor, gets what everyone gets", () => {
    for (const own of [undefined, "", "new", "Page", "default"]) {
      expect(live({ admin: true, own })).toBe(DEFAULT_EDITOR);
      expect(live({ variable: "page", admin: true, own })).toBe("page");
      expect(live({ variable: "classic", admin: true, own })).toBe("classic");
    }
  });

  test("what /api/health reports never follows an admin's own choice", () => {
    expect(decideForEveryone({ variable: undefined, production: true, admin: true, own: other(DEFAULT_EDITOR) })).toBe(DEFAULT_EDITOR);
    expect(decideForEveryone({ variable: "classic", production: true, admin: true, own: "page" })).toBe("classic");
    expect(decideForEveryone({ variable: "page", production: true, admin: true, own: "classic" })).toBe("page");
  });

  test("the development cookie is never read on the live site; in development it stands in for the variable, under an admin's choice", () => {
    for (const devCookie of ["page", "classic", "default"]) {
      expect(live({ devCookie })).toBe(DEFAULT_EDITOR);
      expect(live({ variable: "classic", devCookie })).toBe("classic");
      expect(live({ variable: "page", devCookie })).toBe("page");
    }
    const dev = (facts: Partial<EditorFacts>) => decideEditor({ variable: "page", production: false, ...facts });
    expect(dev({})).toBe("page");
    expect(dev({ devCookie: "classic" })).toBe("classic");
    expect(dev({ devCookie: "page" })).toBe("page");
    expect(dev({ devCookie: "default" })).toBe(DEFAULT_EDITOR);
    // A cookie that says none of the three leaves the variable in charge.
    expect(dev({ devCookie: "nonsense" })).toBe("page");
    expect(dev({ devCookie: "classic", admin: true, own: "page" })).toBe("page");
    expect(dev({ devCookie: "page", admin: true, own: "classic" })).toBe("classic");
    expect(dev({ devCookie: "classic", admin: false, own: "page" })).toBe("classic");
  });
});

test.describe("what everyone gets", () => {
  test("with EXHBT_EDITOR not set, a person gets the default, the classic editor until launch, and /api/health says the same", async ({ page }) => {
    const [edit] = await person(page, "unset", "default");
    expect(await sayVariable(page, "default")).toBe(SHIPPED_DEFAULT);
    expect(await served(page, edit!)).toBe(SHIPPED_DEFAULT);
    expect(await healthSays(page.request)).toBe(SHIPPED_DEFAULT);
  });

  test("EXHBT_EDITOR set to page gives an ordinary person the new editor, and set to classic the classic one; /api/health follows", async ({ page }) => {
    const [edit] = await person(page, "variable", "page");
    expect(await served(page, edit!)).toBe("page");
    expect(await healthSays(page.request)).toBe("page");

    expect(await sayVariable(page, "classic")).toBe("classic");
    expect(await served(page, edit!)).toBe("classic");
    expect(await healthSays(page.request)).toBe("classic");
    // Nobody asked for it by the address, so there is no line about a way back.
    await expect(page.getByText("You're in the classic editor.")).toHaveCount(0);
  });
});

test.describe("an admin's own choice, by its cookie", () => {
  test("a person who is not an admin and carries the admin's cookie still gets the classic editor", async ({ page, baseURL }) => {
    const [edit] = await person(page, "carry", OFF);
    await carry(page, baseURL, "page");
    expect(await served(page, edit!)).toBe("classic");
    expect(await healthSays(page.request)).toBe("classic");
  });

  test("an admin's choice is honoured both ways, over the variable, and never shows in /api/health", async ({ page, baseURL }) => {
    const [edit] = await person(page, "honoured", OFF, { admin: true });
    // No choice yet: what everyone gets.
    expect(await served(page, edit!)).toBe("classic");

    await carry(page, baseURL, "page");
    expect(await served(page, edit!)).toBe("page");
    expect(await healthSays(page.request)).toBe("classic");
    // Forced back for everyone: the admin can still look at the new editor.
    await sayVariable(page, "classic");
    expect(await served(page, edit!)).toBe("page");
    expect(await healthSays(page.request)).toBe("classic");

    // On for everyone: the admin can still look at the classic one.
    await sayVariable(page, "page");
    await carry(page, baseURL, "classic");
    expect(await served(page, edit!)).toBe("classic");
    expect(await healthSays(page.request)).toBe("page");
  });

  test("it is checked on every request: an admin who stops being one gets what everyone gets on the next", async ({ page, baseURL }) => {
    const [edit] = await person(page, "demoted", OFF, { admin: true });
    await carry(page, baseURL, "page");
    expect(await served(page, edit!)).toBe("page");
    await admin(page, false);
    expect(await served(page, edit!)).toBe("classic");
    // And an admin again, with the same cookie still in the browser.
    await admin(page, true);
    expect(await served(page, edit!)).toBe("page");
  });
});
