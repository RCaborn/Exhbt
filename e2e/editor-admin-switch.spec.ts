// `test` from ./editor-test, as every editor spec takes it: on WebKit it keeps next dev's hot-reload client quiet, which
// otherwise reloads a page being left when the server builds a route for the first time ("Navigation … is interrupted by
// another navigation"). With Playwright's own, two tests here failed that way on WebKit on 25 Nov, at random.
import { devices, expect, test, type APIRequestContext, type Page } from "./editor-test";
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
// The admin's own switch is tested as an admin uses it: "Try the new editor" in the classic editor, "Use the
// classic editor" in the new one's menu, and POST /api/exhbts/editor behind both.
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
/** The admin's button in the classic editor, and the words of its line. */
const TRY = "Try the new editor";
const ADMINS_ONLY = "Admins only.";
/** The line a visit gets when its address asked for the classic editor. */
const LINE = "You're in the classic editor.";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { defaultBrowserType: _browser, ...PIXEL_7 } = devices["Pixel 7"];

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

/** The admin's button, wherever it is on the page. */
const tryButton = (page: Page) => page.getByRole("button", { name: TRY, exact: true });

/** Presses "Use the classic editor" in the new editor's own menu (on a phone the site's header has a Menu too) and waits for the classic editor. */
async function useClassic(page: Page) {
  await page.locator(`${NEW_READY} [data-topbar]`).getByRole("button", { name: "Menu", exact: true }).click();
  await page.getByRole("button", { name: "Use the classic editor" }).click();
  await expect(page.locator(CLASSIC_READY)).toBeAttached();
}

/** The admin's own cookie as this browser holds it, if it does. */
const ownCookie = async (page: Page) => (await page.context().cookies()).find((c) => c.name === EDITOR_OWN_COOKIE);

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
    await expect(page.getByText(LINE)).toHaveCount(0);
  });

  test("with the new editor off for everyone, a person who is not an admin gets the classic editor and is sent no Try the new editor", async ({ page }) => {
    const [edit] = await person(page, "ordinary", OFF);
    expect(await served(page, edit!)).toBe("classic");
    await expect(tryButton(page)).toHaveCount(0);
    await expect(page.getByText(ADMINS_ONLY)).toHaveCount(0);
    await expect(page.getByText(LINE)).toHaveCount(0);
    // It is not hidden from them: it is not in the page the server sends.
    const html = await (await page.request.get(edit!)).text();
    expect(html).toContain('data-editor="classic"');
    expect(html).not.toContain(TRY);
    expect(html).not.toContain("Admins only");
    expect(await healthSays(page.request)).toBe("classic");
  });
});

test.describe("an admin's own switch", () => {
  /** The address without its host: the path, and whatever follows it. */
  const address = (page: Page) => new URL(page.url()).pathname + new URL(page.url()).search;

  test("an admin sees Try the new editor, chooses it, gets the new editor on that exhbt and on the next one, and Use the classic editor takes them back", async ({ page }) => {
    const [first, second] = await person(page, "trial", OFF, { admin: true, slugs: ["queues", "tills"] });
    expect(await served(page, first!)).toBe("classic");
    await expect(page.getByText(ADMINS_ONLY)).toBeVisible();
    await tryButton(page).click();
    await expect(page.locator(NEW_READY)).toBeAttached();
    // The same exhbt, with nothing else in the address.
    expect(address(page)).toBe(first);
    // The next one they open is in the new editor too.
    expect(await served(page, second!)).toBe("page");
    // Nothing has changed for anyone else.
    expect(await healthSays(page.request)).toBe("classic");

    await useClassic(page);
    // It is stored as their choice, not asked for by the address: no line about a way back, and the button is there again.
    expect(address(page)).toBe(second);
    await expect(page.getByText(LINE)).toHaveCount(0);
    await expect(tryButton(page)).toBeVisible();
    expect((await ownCookie(page))?.value).toBe("classic");
    expect(await served(page, first!)).toBe("classic");
  });

  test("with the new editor on for everyone, an admin can still go back to the classic one, which is remembered, and forward again", async ({ page }) => {
    const [first, second] = await person(page, "back", "page", { admin: true, slugs: ["queues", "tills"] });
    expect(await served(page, first!)).toBe("page");
    await useClassic(page);
    expect(address(page)).toBe(first);
    expect(await served(page, second!)).toBe("classic");
    expect(await healthSays(page.request)).toBe("page");
    await tryButton(page).click();
    await expect(page.locator(NEW_READY)).toBeAttached();
    expect(address(page)).toBe(second);
    expect(await served(page, first!)).toBe("page");
  });

  test("everyone else's Use the classic editor is still for the visit, by the address, and stores nothing", async ({ page }) => {
    const [edit] = await person(page, "visit", "page");
    expect(await served(page, edit!)).toBe("page");
    await useClassic(page);
    expect(address(page)).toBe(`${edit}?editor=classic`);
    await expect(page.getByText(LINE)).toBeVisible();
    await expect(tryButton(page)).toHaveCount(0);
    expect(await ownCookie(page)).toBeUndefined();
    expect(await served(page, edit!)).toBe("page");
  });

  test("an admin who chose the new editor still lands in the classic one when it throws, and stays there on a reload", async ({ page }) => {
    const [edit] = await person(page, "thrown", OFF, { admin: true });
    expect(await served(page, edit!)).toBe("classic");
    await tryButton(page).click();
    await expect(page.locator(NEW_READY)).toBeAttached();

    await page.goto(`${edit}?crash=render`);
    await expect(page.locator(CLASSIC_READY)).toBeAttached();
    expect(address(page)).toBe(`${edit}?editor=classic`);
    await page.reload();
    await expect(page.locator(CLASSIC_READY)).toBeAttached();
    await expect(page.locator('[data-editor="page"]')).toHaveCount(0);
    // Their choice is still the new editor: the line has the way back to it, and there is no button to choose it again.
    await expect(tryButton(page)).toHaveCount(0);
    await page.getByRole("link", { name: "Back to the new editor" }).click();
    await expect(page.locator(NEW_READY)).toBeAttached();
  });

  test("it is checked on every request: an admin who stops being one gets what everyone gets on the next", async ({ page }) => {
    const [edit] = await person(page, "demoted", OFF, { admin: true });
    expect(await served(page, edit!)).toBe("classic");
    await tryButton(page).click();
    await expect(page.locator(NEW_READY)).toBeAttached();

    await admin(page, false);
    expect(await served(page, edit!)).toBe("classic");
    await expect(tryButton(page)).toHaveCount(0);
    // An admin again, with the same cookie still in the browser.
    await admin(page, true);
    expect(await served(page, edit!)).toBe("page");
  });

  test("the choice is stored only for an admin: anyone else's request is not found and leaves no cookie", async ({ page, request }) => {
    // Nobody signed in.
    const out = await request.post("/api/exhbts/editor", { form: { kind: "page" } });
    expect(out.status()).toBe(404);
    expect(out.headers()["set-cookie"] ?? "").not.toContain(EDITOR_OWN_COOKIE);

    // Signed in, and not an admin.
    const [edit] = await person(page, "refused", OFF);
    const id = edit!.split("/")[2]!;
    const refused = await page.request.post("/api/exhbts/editor", { form: { kind: "page", exhbt: id }, maxRedirects: 0 });
    expect(refused.status()).toBe(404);
    expect(refused.headers()["set-cookie"] ?? "").not.toContain(EDITOR_OWN_COOKIE);
    expect(await ownCookie(page)).toBeUndefined();
    expect(await served(page, edit!)).toBe("classic");

    // An admin: stored for a year, out of reach of the page's scripts, and sent back to that exhbt's edit page.
    await admin(page, true);
    const stored = await page.request.post("/api/exhbts/editor", { form: { kind: "page", exhbt: id }, maxRedirects: 0 });
    expect(stored.status()).toBe(303);
    const to = new URL(stored.headers()["location"]!, "http://localhost");
    expect(to.pathname + to.search).toBe(edit);
    const cookie = await ownCookie(page);
    expect(cookie).toMatchObject({ value: "page", httpOnly: true, sameSite: "Lax", path: "/" });
    expect(cookie!.expires - Date.now() / 1000).toBeGreaterThan(360 * 24 * 60 * 60);

    // It names an editor, or it is refused. Without an exhbt's id, or with something that is not one, it sends the browser nowhere.
    expect((await page.request.post("/api/exhbts/editor", { form: { kind: "new", exhbt: id }, maxRedirects: 0 })).status()).toBe(400);
    const nowhere = await page.request.post("/api/exhbts/editor", { form: { kind: "classic", exhbt: "//example.com/" }, maxRedirects: 0 });
    expect(nowhere.status()).toBe(200);
    expect(await nowhere.json()).toEqual({ editor: "classic" });
    expect((await ownCookie(page))?.value).toBe("classic");
  });
});

test.describe("an admin's own choice, by its cookie", () => {
  test("a person who is not an admin and carries the admin's cookie still gets the classic editor, and no button", async ({ page, baseURL }) => {
    const [edit] = await person(page, "carry", OFF);
    await carry(page, baseURL, "page");
    expect(await served(page, edit!)).toBe("classic");
    await expect(tryButton(page)).toHaveCount(0);
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

});

test.describe("on a phone", () => {
  test.use(PIXEL_7);

  test("the admin's button is in the first screenful of the classic editor, big enough for a thumb, and the way there and back works", async ({ page }) => {
    const [edit] = await person(page, "phone", OFF, { admin: true });
    expect(await served(page, edit!)).toBe("classic");
    const button = tryButton(page);
    await expect(button).toBeVisible();
    const screen = page.viewportSize()!;
    const box = (await button.boundingBox())!;
    expect(box.height, "a 44px press").toBeGreaterThanOrEqual(44);
    expect(box.y + box.height, "in the first screenful").toBeLessThanOrEqual(screen.height);
    // Its whole line fits the screen's width.
    const line = (await page.locator("[data-admin-switch] form").boundingBox())!;
    expect(line.x).toBeGreaterThanOrEqual(0);
    expect(line.x + line.width).toBeLessThanOrEqual(screen.width);

    await button.tap();
    await expect(page.locator(NEW_READY)).toBeAttached();
    // The new editor's own menu: on a phone the site's header has a Menu of its own.
    await page.locator(`${NEW_READY} [data-topbar]`).getByRole("button", { name: "Menu", exact: true }).tap();
    await page.getByRole("button", { name: "Use the classic editor" }).tap();
    await expect(page.locator(CLASSIC_READY)).toBeAttached();
    await expect(tryButton(page)).toBeVisible();
  });
});
